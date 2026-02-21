# -*- coding: utf-8 -*-
"""
d3.py - Physio App Backend
YOLOv8 pose detection + D3-style RandomForest exercise classifier
Flask REST API for the PhysioAI React frontend (UI1)
"""

import sys
import os
import re

# Force UTF-8 stdout so Windows cp1252 terminals don't crash
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except AttributeError:
    pass

import math
import json
import base64
import sqlite3
import datetime
import random
import io
from collections import deque
from threading import Lock
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import joblib

from flask import Flask, request, jsonify
from flask_cors import CORS
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

# ── Optional: YOLOv8 ─────────────────────────────────────────────────────────
try:
    from ultralytics import YOLO
    from PIL import Image
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    print("[d3] WARNING: ultralytics/pillow not installed. Run: pip install ultralytics pillow")

# =============================================================================
#  Constants
# =============================================================================
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model_yolo.pkl")   # new model for COCO keypoints
YOLO_PATH  = os.path.join(BASE_DIR, "yolov8n-pose.pt")
DB_PATH    = os.path.join(BASE_DIR, "physio.db")
PORT = int(os.environ.get("PORT", 5001))

EXERCISES = [
    "Bridge Pose",
    "Cat-Cow Pose",
    "Neck Tilt",
    "Mountain Pose",
    "Shoulder Roll",
    "Spinal Twist",
]

# COCO 17 keypoint indices
COCO = {
    "nose": 0, "left_eye": 1, "right_eye": 2,
    "left_ear": 3, "right_ear": 4,
    "left_shoulder": 5,  "right_shoulder": 6,
    "left_elbow": 7,     "right_elbow": 8,
    "left_wrist": 9,     "right_wrist": 10,
    "left_hip": 11,      "right_hip": 12,
    "left_knee": 13,     "right_knee": 14,
    "left_ankle": 15,    "right_ankle": 16,
}

# Skeleton connections for frontend drawing
COCO_CONNECTIONS = [
    [0, 1], [0, 2], [1, 3], [2, 4],          # head
    [5, 6],                                    # shoulders
    [5, 7], [7, 9],                            # left arm
    [6, 8], [8, 10],                           # right arm
    [5, 11], [6, 12], [11, 12],               # torso
    [11, 13], [13, 15],                        # left leg
    [12, 14], [14, 16],                        # right leg
]

# =============================================================================
#  YOLOv8 model loader
# =============================================================================
# ONNX Runtime + DirectML GPU inference (works on RTX 3050 without CUDA PyTorch)
onnx_session  = None
yolo_model    = None   # always defined; set to session on successful load
_YOLO_IMGSZ   = 192   # matches export_onnx_192.py — run that script first!
_YOLO_ONNX    = os.path.join(BASE_DIR, "yolov8n-pose.onnx")
_USING_GPU    = False

def load_yolo():
    """Load YOLOv8 pose ONNX model; prefer DirectML GPU, fall back to CPU."""
    global onnx_session, yolo_model, _USING_GPU
    if not YOLO_AVAILABLE:
        return None
    if not os.path.exists(_YOLO_ONNX):
        print(f"[d3] WARNING: {_YOLO_ONNX} not found - YOLO disabled")
        return None
    try:
        import onnxruntime as ort

        available = ort.get_available_providers()
        print(f"[d3] ORT providers available: {available}")

        if "DmlExecutionProvider" in available:
            providers = ["DmlExecutionProvider", "CPUExecutionProvider"]
            _USING_GPU = True
            device_label = "RTX 3050 via DirectML"
        else:
            providers = ["CPUExecutionProvider"]
            _USING_GPU = False
            device_label = "CPU"

        opts = ort.SessionOptions()
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        opts.intra_op_num_threads = os.cpu_count() or 4
        opts.inter_op_num_threads = 2   # parallelise across graph nodes

        onnx_session = ort.InferenceSession(_YOLO_ONNX, sess_options=opts, providers=providers)
        used = onnx_session.get_providers()
        print(f"[d3] ONNX Runtime loaded on {device_label} (providers: {used})")

        # Pre-warm — allocates GPU memory and JIT-compiles kernels
        dummy = np.zeros((1, 3, _YOLO_IMGSZ, _YOLO_IMGSZ), dtype=np.float32)
        inp_name = onnx_session.get_inputs()[0].name
        onnx_session.run(None, {inp_name: dummy})
        print(f"[d3] ONNX session pre-warmed at imgsz={_YOLO_IMGSZ}")

        yolo_model = onnx_session   # keep reference so health check sees it
        return onnx_session
    except Exception as e:
        print(f"[d3] WARNING: Could not load ONNX/DirectML: {e}")
        return None


# =============================================================================
#  Feature extraction from 17 COCO keypoints
# =============================================================================
def angle_3pts(a, b, c):
    """Angle at vertex b given 2D points a, b, c."""
    ba = np.array(a) - np.array(b)
    bc = np.array(c) - np.array(b)
    cos_a = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-8)
    return math.degrees(math.acos(float(np.clip(cos_a, -1.0, 1.0))))


def kpts_to_features(kpts):
    """
    kpts: np.ndarray shape (17, 2) normalized x,y  OR  (17, 3) with confidence
    Returns flat feature vector: raw xy + 9 joint angles
    """
    n_raw    = 17 * 2
    n_angles = 9
    features = np.zeros(n_raw + n_angles)

    if kpts is None or kpts.shape[0] < 17:
        return features

    # Raw x, y
    for i in range(17):
        features[i * 2]     = float(kpts[i, 0])
        features[i * 2 + 1] = float(kpts[i, 1])

    def pt(name):
        return (float(kpts[COCO[name], 0]), float(kpts[COCO[name], 1]))

    try:
        ls  = pt("left_shoulder");  rs  = pt("right_shoulder")
        le  = pt("left_elbow");     re  = pt("right_elbow")
        lw  = pt("left_wrist");     rw  = pt("right_wrist")
        lh  = pt("left_hip");       rh  = pt("right_hip")
        lk  = pt("left_knee");      rk  = pt("right_knee")
        la  = pt("left_ankle");     ra  = pt("right_ankle")
        nos = pt("nose")

        features[n_raw + 0] = angle_3pts(lh,  ls, le)   # left shoulder
        features[n_raw + 1] = angle_3pts(rs,  re, rw)   # right elbow
        features[n_raw + 2] = angle_3pts(ls,  lh, lk)   # left hip
        features[n_raw + 3] = angle_3pts(rs,  rh, rk)   # right hip
        features[n_raw + 4] = angle_3pts(lh,  lk, la)   # left knee
        features[n_raw + 5] = angle_3pts(rh,  rk, ra)   # right knee
        features[n_raw + 6] = angle_3pts(ls,  le, lw)   # left elbow
        features[n_raw + 7] = angle_3pts(ls,  rs, rh)   # spine tilt
        # Head tilt: nose y relative to shoulder midpoint
        mid_y = (ls[1] + rs[1]) / 2
        features[n_raw + 8] = nos[1] - mid_y
    except Exception:
        pass

    return features


# =============================================================================
#  Synthetic COCO-format training data (17 keypoints x,y)
# =============================================================================
def make_coco_kpts(
    nose_y=0.08, shoulder_y=0.25, hip_y=0.55,
    knee_y=0.72, ankle_y=0.90,
    shoulder_x_spread=0.15,
    elbow_drop=0.12, wrist_drop=0.10,
    head_tilt=0.0, noise=0.025,
    spine_lean=0.0,
):
    rng = np.random.default_rng()

    def n(v): return float(v + rng.normal(0, noise))

    kpts = np.zeros((17, 2))
    cx = 0.5 + spine_lean

    # Head
    kpts[0]  = [n(cx + head_tilt), n(nose_y)]           # nose
    kpts[1]  = [n(cx - 0.03), n(nose_y + 0.03)]         # left_eye
    kpts[2]  = [n(cx + 0.03), n(nose_y + 0.03)]         # right_eye
    kpts[3]  = [n(cx - 0.05), n(nose_y + 0.05)]         # left_ear
    kpts[4]  = [n(cx + 0.05), n(nose_y + 0.05)]         # right_ear
    # Shoulders
    lsx = cx - shoulder_x_spread; rsx = cx + shoulder_x_spread
    kpts[5]  = [n(lsx), n(shoulder_y)]
    kpts[6]  = [n(rsx), n(shoulder_y)]
    # Elbows
    kpts[7]  = [n(lsx - 0.05), n(shoulder_y + elbow_drop)]
    kpts[8]  = [n(rsx + 0.05), n(shoulder_y + elbow_drop)]
    # Wrists
    kpts[9]  = [n(lsx - 0.06), n(shoulder_y + elbow_drop + wrist_drop)]
    kpts[10] = [n(rsx + 0.06), n(shoulder_y + elbow_drop + wrist_drop)]
    # Hips
    kpts[11] = [n(cx - 0.10), n(hip_y)]
    kpts[12] = [n(cx + 0.10), n(hip_y)]
    # Knees
    kpts[13] = [n(cx - 0.10), n(knee_y)]
    kpts[14] = [n(cx + 0.10), n(knee_y)]
    # Ankles
    kpts[15] = [n(cx - 0.09), n(ankle_y)]
    kpts[16] = [n(cx + 0.09), n(ankle_y)]

    return kpts


EXERCISE_CONFIGS = {
    "Mountain Pose":  dict(shoulder_y=0.27, hip_y=0.55, knee_y=0.72, ankle_y=0.92, head_tilt=0.0,  spine_lean=0.0),
    "Neck Tilt":      dict(shoulder_y=0.27, hip_y=0.55, knee_y=0.72, ankle_y=0.92, head_tilt=0.07, spine_lean=0.0),
    "Shoulder Roll":  dict(shoulder_y=0.22, hip_y=0.55, knee_y=0.72, ankle_y=0.92, head_tilt=0.0,  spine_lean=0.0, elbow_drop=0.05),
    "Spinal Twist":   dict(shoulder_y=0.27, hip_y=0.55, knee_y=0.72, ankle_y=0.92, head_tilt=0.0,  spine_lean=0.06),
    "Bridge Pose":    dict(shoulder_y=0.60, hip_y=0.35, knee_y=0.65, ankle_y=0.85, head_tilt=0.0,  spine_lean=0.0),
    "Cat-Cow Pose":   dict(shoulder_y=0.40, hip_y=0.42, knee_y=0.72, ankle_y=0.90, head_tilt=0.05, elbow_drop=0.20, wrist_drop=0.25),
}


def generate_training_data(samples_per_class=500):
    X, y = [], []
    for label, cfg in EXERCISE_CONFIGS.items():
        for _ in range(samples_per_class):
            kpts  = make_coco_kpts(**cfg, noise=0.035)
            feat  = kpts_to_features(kpts)
            X.append(feat)
            y.append(label)
    return np.array(X), np.array(y)


# =============================================================================
#  D3-style RandomForest model
# =============================================================================
def train_model():
    print("[d3] Generating COCO-format training data ...")
    X, y = generate_training_data(samples_per_class=600)

    model = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", RandomForestClassifier(
            n_estimators=150,
            max_depth=8,
            min_samples_split=4,
            max_features="sqrt",
            random_state=42,
            n_jobs=-1,
        ))
    ])
    model.fit(X, y)
    joblib.dump(model, MODEL_PATH)
    print(f"[d3] Model trained and saved -> {MODEL_PATH}")
    return model


def load_or_train_model():
    if os.path.exists(MODEL_PATH):
        try:
            m = joblib.load(MODEL_PATH)
            # Quick sanity check: predict on a zero vector
            n_features = 17 * 2 + 9
            m.predict(np.zeros((1, n_features)))
            print(f"[d3] RF model loaded from {MODEL_PATH}")
            return m
        except Exception as e:
            print(f"[d3] Stale model, retraining: {e}")
    return train_model()


# =============================================================================
#  Pose scoring & feedback
# =============================================================================
IDEAL = {
    "Mountain Pose":  {"hip": 175, "knee": 175, "shoulder": 85},
    "Neck Tilt":      {"hip": 170, "knee": 170, "shoulder": 85},
    "Shoulder Roll":  {"hip": 170, "knee": 170, "shoulder": 55},
    "Spinal Twist":   {"hip": 160, "knee": 160, "shoulder": 95},
    "Bridge Pose":    {"hip": 130, "knee": 95,  "shoulder": 170},
    "Cat-Cow Pose":   {"hip": 105, "knee": 90,  "shoulder": 90},
}

FEEDBACK_OK = {
    "Mountain Pose":  "Excellent posture! Stand tall and breathe deep.",
    "Neck Tilt":      "Good neck alignment! Keep shoulders relaxed.",
    "Shoulder Roll":  "Smooth shoulder roll! Keep your neck long.",
    "Spinal Twist":   "Great twist! Keep both hips grounded.",
    "Bridge Pose":    "Perfect bridge! Keep your core engaged.",
    "Cat-Cow Pose":   "Great spinal flex! Move slowly and breathe.",
}

FEEDBACK_BAD = {
    "Mountain Pose":  "Straighten your back and engage your core.",
    "Neck Tilt":      "Slightly lower your right shoulder for alignment.",
    "Shoulder Roll":  "Roll your shoulders further back and down.",
    "Spinal Twist":   "Rotate more from the torso, not just shoulders.",
    "Bridge Pose":    "Lift your hips higher and press feet into the ground.",
    "Cat-Cow Pose":   "Round your back more on the cat phase.",
}


def compute_score(label, kpts, confidence):
    if kpts is None or kpts.shape[0] < 17:
        return {"score": 0, "is_correct": False,
                "feedback": "Step into frame — hold position steady."}

    ideal = IDEAL.get(label, {"hip": 160, "knee": 160, "shoulder": 85})

    def pt(name):
        idx = COCO[name]
        x, y = float(kpts[idx, 0]), float(kpts[idx, 1])
        if x == 0.0 and y == 0.0:          # filtered-out low-confidence point
            raise ValueError(f"{name} not visible")
        return (x, y)

    errors = []
    try:
        ls = pt("left_shoulder");  lh = pt("left_hip")
        lk = pt("left_knee");      la = pt("left_ankle")
        rs = pt("right_shoulder"); rh = pt("right_hip")
        rk = pt("right_knee")

        hip_ang  = (angle_3pts(ls, lh, lk) + angle_3pts(rs, rh, rk)) / 2
        knee_ang = (angle_3pts(lh, lk, la) + angle_3pts(rh, rk, pt("right_ankle"))) / 2
        shld_ang = angle_3pts(lh, ls, pt("left_elbow"))

        hip_err  = abs(hip_ang  - ideal["hip"])      / 180 * 100
        knee_err = abs(knee_ang - ideal["knee"])     / 180 * 100
        shld_err = abs(shld_ang - ideal["shoulder"]) / 180 * 100

        if hip_err  > 25: errors.append("hips")
        if knee_err > 25: errors.append("knees")
        if shld_err > 30: errors.append("shoulders")

        pose_score = max(0, 100 - (hip_err * 0.4 + knee_err * 0.35 + shld_err * 0.25))
    except Exception:
        pose_score = max(30, confidence * 60)  # partial visibility — trust confidence

    score = int(0.6 * pose_score + 0.4 * confidence * 100)
    score = max(0, min(100, score))
    is_correct = score >= 62

    if is_correct:
        feedback = FEEDBACK_OK[label]
    elif errors:
        part = " and ".join(errors)
        feedback = f"Adjust your {part}. " + FEEDBACK_BAD[label]
    else:
        feedback = FEEDBACK_BAD[label]

    return {"score": score, "is_correct": is_correct, "feedback": feedback}


# =============================================================================
#  Image decoding + YOLO inference
# =============================================================================
def run_yolo(b64_image: str):
    """
    Run YOLOv8 pose on a base64-encoded JPEG/PNG image.
    Returns (kpts np.ndarray (17,2), confidence float) or (None, 0.0)
    """
    if onnx_session is None:
        return None, 0.0

    try:
        # ── Decode & pre-process ──────────────────────────────────────────────
        if "," in b64_image:
            b64_image = b64_image.split(",", 1)[1]
        img_bytes = base64.b64decode(b64_image)
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")

        img_resized = img.resize((_YOLO_IMGSZ, _YOLO_IMGSZ), Image.BILINEAR)
        inp = np.array(img_resized, dtype=np.float32).transpose(2, 0, 1)[None] / 255.0

        orig_w, orig_h = img.size   # for keypoint scale-back

        # ── ONNX inference on GPU (DirectML) ──────────────────────────────────
        inp_name = onnx_session.get_inputs()[0].name
        raw = onnx_session.run(None, {inp_name: inp})[0]  # (1, 56, 1344)
        preds = raw[0].T   # (1344, 56): each row = one anchor

        # YOLOv8 pose output format per anchor:
        # cols 0-3: cx, cy, w, h  (in imgsz pixels)
        # col 4:    box confidence
        # cols 5-55: 17 keypoints × (x, y, conf)  in imgsz pixels
        CONF_THRESH = 0.30
        box_conf = preds[:, 4]
        mask     = box_conf > CONF_THRESH
        if not mask.any():
            return None, 0.0

        preds    = preds[mask]
        best_idx = int(np.argmax(preds[:, 4]))
        conf     = float(preds[best_idx, 4])
        row      = preds[best_idx]   # (56,)

        # Parse 17 keypoints — normalize to 0-1
        kpt_data = row[5:].reshape(17, 3)          # (17, x/y/conf)
        kpts     = kpt_data[:, :2] / _YOLO_IMGSZ   # normalize
        kpt_conf = kpt_data[:, 2]

        # Zero out low-confidence keypoints
        low = kpt_conf < 0.40
        kpts[low] = 0.0
        run_yolo._last_kpt_conf = kpt_conf

        return kpts, conf

    except Exception as e:
        print(f"[d3] ONNX inference error: {e}")
        return None, 0.0


# =============================================================================
#  SQLite helpers
# =============================================================================
def init_db():
    con = sqlite3.connect(DB_PATH)
    con.executescript("""
        CREATE TABLE IF NOT EXISTS sessions (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            patient   TEXT    DEFAULT 'John Doe',
            exercise  TEXT    NOT NULL,
            score     INTEGER NOT NULL,
            reps      INTEGER NOT NULL DEFAULT 0,
            duration  INTEGER NOT NULL DEFAULT 0,
            created   TEXT    NOT NULL
        );
        CREATE TABLE IF NOT EXISTS patients (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL,
            progress    TEXT    DEFAULT 'On Track',
            achievement TEXT    DEFAULT 'Silver',
            score       INTEGER DEFAULT 70
        );
    """)
    con.execute("SELECT COUNT(*) FROM patients").fetchone()
    count = con.execute("SELECT COUNT(*) FROM patients").fetchone()[0]
    if count == 0:
        con.executemany(
            "INSERT INTO patients(name,progress,achievement,score) VALUES(?,?,?,?)",
            [("John Doe","On Track","Gold",87),("Sarah Lee","Needs Work","Bronze",52),
             ("Mike Chen","Excellent","Platinum",91),("Emma Wilson","Improving","Silver",74),
             ("Raj Patel","Needs Work","Bronze",45)]
        )
    con.commit()
    con.close()


def get_db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


# =============================================================================
#  Flask App
# =============================================================================
app = Flask(__name__)
# CORS: allow FRONTEND_URL env var on Render, or any localhost port locally
_frontend_url = os.environ.get("FRONTEND_URL", "")
_cors_origins = _frontend_url if _frontend_url else r"http://(localhost|127\.0\.0\.1)(:\d+)?"
CORS(app, resources={r"/api/*": {
    "origins": _cors_origins,
    "supports_credentials": False,
}})

rf_model = None

# ── Prediction smoothing state ────────────────────────────────────────────────
_label_history = deque(maxlen=5)
_score_ema     = 0.0
_ALPHA         = 0.35
_history_lock  = Lock()

# ── Lazy init (runs on first request, not at import time) ─────────────────────
# This lets gunicorn bind the port immediately so Render doesn't time out.
_init_lock = Lock()
_initialized = False

def _lazy_init():
    global rf_model, _initialized
    if _initialized:
        return
    with _init_lock:
        if _initialized:   # double-checked locking
            return
        print("[d3] Lazy init: loading YOLOv8 ...")
        load_yolo()
        print("[d3] Lazy init: loading RF classifier ...")
        rf_model = load_or_train_model()
        print(f"[d3] Lazy init complete. YOLO: {'ENABLED' if yolo_model else 'DISABLED'}")
        _initialized = True

# DB init is fast — safe to do at module level
print("[d3] Initialising database ...")
init_db()


@app.before_request
def _ensure_model():
    _lazy_init()


# ── Health ──────────────────────────────────────────────────────────────────
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "model":  "YOLOv8+RandomForest(D3)",
        "yolo":   yolo_model is not None,
    })


# ── Analyze Pose ─────────────────────────────────────────────────────────────
@app.route("/api/analyze-pose", methods=["POST"])
def analyze_pose():
    data = request.get_json(silent=True) or {}

    kpts       = None
    confidence = 0.0
    kpts_list  = []   # returned to frontend for skeleton drawing

    # ── Path 1: base64 image from webcam (YOLOv8 path) ──────────────────────
    b64 = data.get("image", "")
    if b64:
        kpts, confidence = run_yolo(b64)
        if kpts is not None:
            kpts_list = kpts.tolist()   # [[x,y], ...] length 17

    # ── Path 2: fallback MediaPipe-style landmarks (backward compat) ─────────
    if kpts is None:
        raw = data.get("landmarks", [])
        if raw and len(raw) >= 17:
            # Convert MediaPipe format to COCO subset (best-effort mapping)
            mp_to_coco = [0, 2, 5, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
            arr = []
            for ci in mp_to_coco:
                if ci < len(raw):
                    lm = raw[ci]
                    arr.append([lm.get("x", 0.5), lm.get("y", 0.5)])
                else:
                    arr.append([0.5, 0.5])
            kpts = np.array(arr)
            confidence = 0.5

    person_detected = kpts is not None

    # Filter out low-confidence keypoints (set to [0,0] so they're skipped)
    kpt_confs = []
    if kpts is not None:
        # run_yolo returns (17,2) -- try to get per-kpt conf from YOLO results cache
        # We re-use the last stored confidence for all joints (safe approximation)
        CONF_THRESH = 0.4
        if hasattr(run_yolo, "_last_kpt_conf"):
            kpt_conf_arr = run_yolo._last_kpt_conf        # shape (17,)
            kpt_confs    = kpt_conf_arr.tolist()
            for i in range(17):
                if kpt_conf_arr[i] < CONF_THRESH:
                    kpts[i] = [0.0, 0.0]                  # zero out uncertain joints
        else:
            kpt_confs = [confidence] * 17
        kpts_list = kpts.tolist()

    # ── Classify (skip RF when frontend sends the active exercise) ────────────
    global _score_ema
    exercise_hint = data.get("exercise", "").strip()   # sent by UI since it knows
    if exercise_hint and exercise_hint in EXERCISES:
        # Frontend already knows which exercise is active — no need for RF
        label = exercise_hint
        if kpts is not None and confidence == 0.0:
            confidence = 0.5
    elif kpts is not None:
        feat    = kpts_to_features(kpts).reshape(1, -1)
        raw_lbl = rf_model.predict(feat)[0]
        proba   = rf_model.predict_proba(feat)[0]
        confidence = max(confidence, float(np.max(proba)))
        with _history_lock:
            _label_history.append(raw_lbl)
            label = max(set(_label_history), key=list(_label_history).count)
    else:
        label      = "Mountain Pose"
        confidence = 0.0

    scoring = compute_score(label, kpts, confidence)

    # EMA score smoothing
    with _history_lock:
        _score_ema = _ALPHA * scoring["score"] + (1 - _ALPHA) * _score_ema
        smooth_score = int(round(_score_ema))

    return jsonify({
        "label":           label,
        "score":           smooth_score,
        "is_correct":      scoring["is_correct"],
        "feedback":        scoring["feedback"],
        "confidence":      round(confidence, 3),
        "person_detected": person_detected,
        "keypoints":       kpts_list,
        "kpt_confidences": kpt_confs,
        "connections":     COCO_CONNECTIONS,
    })


# ── Save Session ─────────────────────────────────────────────────────────────
@app.route("/api/save-session", methods=["POST"])
def save_session():
    data     = request.get_json(silent=True) or {}
    exercise = data.get("exercise", "Unknown")
    score    = int(data.get("score", 0))
    reps     = int(data.get("reps", 0))
    duration = int(data.get("duration", 0))
    patient  = data.get("patient", "John Doe")
    now      = datetime.datetime.now().isoformat()

    con = get_db()
    con.execute(
        "INSERT INTO sessions(patient,exercise,score,reps,duration,created) VALUES(?,?,?,?,?,?)",
        (patient, exercise, score, reps, duration, now)
    )
    con.commit()
    con.close()
    return jsonify({"saved": True})


# ── Session Summary ───────────────────────────────────────────────────────────
@app.route("/api/session-summary", methods=["GET"])
def session_summary():
    today = datetime.date.today().isoformat()
    con   = get_db()
    rows  = con.execute(
        "SELECT exercise, score, reps, duration FROM sessions WHERE created LIKE ?",
        (f"{today}%",)
    ).fetchall()
    con.close()

    if not rows:
        return jsonify({
            "exercise_score": 0, "off_exercise_score": 0,
            "completed": [], "daily_goal": 6, "done_count": 0,
            "sensor_insights": {
                "spinal_alignment": "N/A",
                "forward_head_posture": "N/A",
                "slouching_duration": "N/A",
            }
        })

    scores    = [r["score"] for r in rows]
    avg_score = int(sum(scores) / len(scores))
    completed = [{"name": r["exercise"], "score": r["score"], "time": ""} for r in rows]
    off_score = max(0, avg_score - random.randint(10, 20))

    return jsonify({
        "exercise_score": avg_score, "off_exercise_score": off_score,
        "completed": completed, "daily_goal": 6, "done_count": len(rows),
        "sensor_insights": {
            "spinal_alignment":     f"{min(99, avg_score + 5)}%",
            "forward_head_posture": "Low" if avg_score > 70 else "High",
            "slouching_duration":   f"{max(0, 30 - len(rows) * 3)} min",
        }
    })


# ── History ───────────────────────────────────────────────────────────────────
@app.route("/api/history", methods=["GET"])
def history():
    period = request.args.get("period", "weekly")
    con    = get_db()
    today  = datetime.date.today()

    if period == "weekly":
        days   = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        result = []
        for i, day in enumerate(days):
            d   = (today - datetime.timedelta(days=6 - i)).isoformat()
            row = con.execute(
                "SELECT AVG(score) as s, COUNT(*) as c FROM sessions WHERE created LIKE ?",
                (f"{d}%",)
            ).fetchone()
            score = int(row["s"]) if row["s"] else random.randint(60, 95)
            exs   = int(row["c"]) if row["c"] else random.randint(2, 6)
            result.append({"day": day, "score": score, "exercises": exs})
        con.close()
        return jsonify(result)
    else:
        result = []
        for w in range(4):
            start = (today - datetime.timedelta(weeks=3 - w)).isoformat()
            row   = con.execute(
                "SELECT AVG(score) as s FROM sessions WHERE created >= ?", (start,)
            ).fetchone()
            score   = int(row["s"]) if row["s"] else random.randint(60, 90)
            posture = max(0, score - random.randint(3, 10))
            result.append({"week": f"W{w+1}", "score": score, "posture": posture})
        con.close()
        return jsonify(result)


# ── Patients ──────────────────────────────────────────────────────────────────
@app.route("/api/patients", methods=["GET"])
def patients():
    con  = get_db()
    rows = con.execute("SELECT name, progress, achievement, score FROM patients").fetchall()
    con.close()
    result = []
    for r in rows:
        s    = r["score"]
        data = [max(0, s - random.randint(8, 15) + i * 3) for i in range(5)]
        data[-1] = s
        result.append({"name": r["name"], "progress": r["progress"],
                        "achievement": r["achievement"], "score": r["score"], "data": data})
    return jsonify(result)


# =============================================================================
#  Entry point (local dev only — Render uses gunicorn)
# =============================================================================
if __name__ == "__main__":
    print(f"[d3] Starting Flask API on http://localhost:{PORT}")
    app.run(host="0.0.0.0", port=PORT, debug=False)
