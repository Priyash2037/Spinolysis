"""
export_onnx_192.py
Re-exports the YOLOv8n-pose model as ONNX at imgsz=192 for faster inference.

Run once:
    python export_onnx_192.py

Output: yolov8n-pose.onnx  (overwrites the old 256px one next to this script)
"""
import os
import shutil

BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
PT_PATH   = os.path.join(BASE_DIR, "yolov8n-pose.pt")
ONNX_OUT  = os.path.join(BASE_DIR, "yolov8n-pose.onnx")
IMGSZ     = 192

print(f"[export] Loading {PT_PATH} ...")
from ultralytics import YOLO

model = YOLO(PT_PATH)

print(f"[export] Exporting to ONNX at imgsz={IMGSZ} ...")
# Export returns the path of the generated file (inside a runs/ subfolder)
exported = model.export(
    format="onnx",
    imgsz=IMGSZ,
    simplify=True,     # onnx-simplifier: removes dead nodes, slightly faster
    opset=17,          # modern opset supported by onnxruntime-directml
    half=False,        # DirectML doesn't support FP16 ONNX on all hardware
    dynamic=False,     # static input shape — required for DirectML
)

if exported and os.path.exists(str(exported)):
    shutil.copy(str(exported), ONNX_OUT)
    print(f"[export] Saved -> {ONNX_OUT}")
else:
    print("[export] ERROR: export() did not return a valid path. Check ultralytics output above.")
    raise SystemExit(1)

print("[export] Done! Restart d3.py to use the new 192px model.")
