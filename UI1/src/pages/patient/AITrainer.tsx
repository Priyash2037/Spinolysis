import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, Play, Pause, Square, Brain,
  CheckCircle, XCircle, AlertCircle, Wifi, WifiOff, UserX,
  SkipForward, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { analyzePoseImage, saveSession, type PoseAnalysisResult } from "@/lib/api";
import { useNavigate } from "react-router-dom";

// ─── Exercise playlist ────────────────────────────────────────────────────────
const EXERCISES = [
  { name: "Mountain Pose", emoji: "🧘", desc: "Stand tall, feet together, arms at sides" },
  { name: "Neck Tilt", emoji: "🙆", desc: "Tilt head gently side to side" },
  { name: "Shoulder Roll", emoji: "💪", desc: "Roll shoulders in large circles" },
  { name: "Spinal Twist", emoji: "🔄", desc: "Rotate torso, keep hips forward" },
  { name: "Bridge Pose", emoji: "🌉", desc: "Lie flat, push hips toward ceiling" },
  { name: "Cat-Cow Pose", emoji: "🐱", desc: "On all fours, arch and round your back" },
];

// ─── COCO skeleton colours ────────────────────────────────────────────────────
const KPT_COLOR: Record<number, string> = {
  0: "#facc15", 1: "#facc15", 2: "#facc15", 3: "#facc15", 4: "#facc15",
  5: "#60a5fa", 6: "#f87171", 7: "#60a5fa", 8: "#f87171",
  9: "#60a5fa", 10: "#f87171",
  11: "#34d399", 12: "#34d399",
  13: "#a78bfa", 14: "#c084fc", 15: "#a78bfa", 16: "#c084fc",
};

const COCO_CONNECTIONS = [
  [0, 1], [0, 2], [1, 3], [2, 4],
  [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],
  [5, 11], [6, 12], [11, 12],
  [11, 13], [13, 15], [12, 14], [14, 16],
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  kpts: [number, number][],
  confs: number[],
  w: number, h: number,
  isCorrect: boolean,
) {
  if (!kpts || kpts.length < 17) return;
  const boneColor = isCorrect ? "rgba(74,222,128,0.9)" : "rgba(248,113,113,0.9)";
  ctx.lineCap = "round";
  for (const [a, b] of COCO_CONNECTIONS) {
    const pa = kpts[a], pb = kpts[b];
    if (!pa || !pb || (pa[0] === 0 && pa[1] === 0) || (pb[0] === 0 && pb[1] === 0)) continue;
    ctx.globalAlpha = Math.max(0.3, Math.min(confs[a] ?? 1, confs[b] ?? 1));
    ctx.strokeStyle = boneColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pa[0] * w, pa[1] * h);
    ctx.lineTo(pb[0] * w, pb[1] * h);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < kpts.length; i++) {
    const p = kpts[i];
    if (!p || (p[0] === 0 && p[1] === 0)) continue;
    ctx.globalAlpha = Math.max(0.3, confs[i] ?? 1);
    ctx.beginPath();
    ctx.arc(p[0] * w, p[1] * h, 5, 0, Math.PI * 2);
    ctx.fillStyle = KPT_COLOR[i] ?? "#fff";
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ─── Component ────────────────────────────────────────────────────────────────
const POLL_MS = 100;   // ~10fps attempts — busyRef guard prevents flooding
const LERP_T = 0.85;   // very snappy: skeleton tracks closely, minimal lag

interface ExerciseLog { name: string; score: number; reps: number; duration: number }

const AITrainer = () => {
  const navigate = useNavigate();

  // Exercise playlist state
  const [exIdx, setExIdx] = useState(0);
  const [exLog, setExLog] = useState<ExerciseLog[]>([]);

  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [yoloReady, setYoloReady] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState<PoseAnalysisResult | null>(null);
  const [personIn, setPersonIn] = useState(true);
  const [reps, setReps] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [sessionScore, setSessionScore] = useState(0);
  const [busy, setBusy] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const captureRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef = useRef(false);
  const busyRef = useRef(false);
  const lastCorr = useRef<boolean | null>(null);
  const exStartRef = useRef(0);  // when current exercise started
  const scoreAcc = useRef(0);
  const sampN = useRef(0);
  const lastFb = useRef<PoseAnalysisResult | null>(null);
  const prevKpts = useRef<[number, number][]>([]);
  const prevConfs = useRef<number[]>([]);
  const repsRef = useRef(0);
  const lastRepTime = useRef(0);  // ms timestamp of last rep — prevents flicker-reps

  const currentEx = EXERCISES[exIdx];

  // ── Health check ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("http://localhost:5001/api/health")
      .then(r => r.json())
      .then(d => { setBackendOk(true); setYoloReady(d.yolo ?? false); })
      .catch(() => { setBackendOk(false); setYoloReady(false); });
  }, []);

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isActive && !isPaused) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isActive, isPaused]);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // Keep repsRef in sync for stopSession / nextExercise
  useEffect(() => { repsRef.current = reps; }, [reps]);

  // ── Frame capture & analysis ──────────────────────────────────────────────
  const pollFrame = useCallback(async () => {
    if (pausedRef.current || busyRef.current) return;
    const video = videoRef.current;
    const capture = captureRef.current;
    const overlay = overlayRef.current;
    if (!video || !capture || video.readyState < 2) return;

    // 320px wide — GPU resizes to 256 anyway; smaller = faster encode + transfer
    const MAX_W = 320;
    const scale = Math.min(1, MAX_W / (video.videoWidth || 640));
    const vw = Math.round((video.videoWidth || 640) * scale);
    const vh = Math.round((video.videoHeight || 480) * scale);
    capture.width = vw;
    capture.height = vh;
    const capCtx = capture.getContext("2d");
    if (!capCtx) return;
    capCtx.drawImage(video, 0, 0, vw, vh);
    const b64 = capture.toDataURL("image/jpeg", 0.42);  // 0.42 quality — small payload, GPU upscales fine

    busyRef.current = true;
    setBusy(true);
    try {
      const result = await analyzePoseImage(b64, currentEx.name);
      lastFb.current = result;
      setFeedback(result);
      setPersonIn(result.person_detected ?? true);

      const rawKpts = result.keypoints as [number, number][];
      const rawConfs = (result.kpt_confidences as number[]) ?? new Array(17).fill(result.confidence);

      if (rawKpts && rawKpts.length >= 17) {
        const smoothed: [number, number][] = rawKpts.map((kpt, i) => {
          const prev = prevKpts.current[i];
          if (!prev || (prev[0] === 0 && prev[1] === 0)) return kpt;
          if (kpt[0] === 0 && kpt[1] === 0) return prev;
          return [lerp(prev[0], kpt[0], LERP_T), lerp(prev[1], kpt[1], LERP_T)];
        });
        const smoothConfs = rawConfs.map((c, i) => lerp(prevConfs.current[i] ?? c, c, LERP_T));
        prevKpts.current = smoothed;
        prevConfs.current = smoothConfs;

        if (overlay) {
          overlay.width = vw;
          overlay.height = vh;
          const octx = overlay.getContext("2d");
          if (octx) {
            octx.clearRect(0, 0, vw, vh);
            drawSkeleton(octx, smoothed, smoothConfs, vw, vh, result.is_correct);
          }
        }
      }

      sampN.current += 1;
      scoreAcc.current += result.score;
      setSessionScore(Math.round(scoreAcc.current / sampN.current));

      // Rep counting: fire on null→true OR false→true, with 1.5s cooldown
      if (result.is_correct && lastCorr.current !== true) {
        const now = Date.now();
        if (now - lastRepTime.current > 1500) {  // 1.5s minimum between reps
          setReps(r => r + 1);
          lastRepTime.current = now;
        }
      }
      lastCorr.current = result.is_correct;
    } catch { /* skip frame */ }
    finally { busyRef.current = false; setBusy(false); }
  }, []);

  // ── Next Exercise ─────────────────────────────────────────────────────────
  const nextExercise = useCallback(async () => {
    // Log current exercise stats
    const dur = Math.round((Date.now() - exStartRef.current) / 1000);
    const score = Math.round(scoreAcc.current / Math.max(sampN.current, 1));
    const log: ExerciseLog = { name: currentEx.name, score, reps: repsRef.current, duration: dur };
    setExLog(prev => [...prev, log]);

    // Save to backend
    try { await saveSession({ exercise: currentEx.name, score, reps: repsRef.current, duration: dur }); }
    catch { /* offline */ }

    // Reset for next exercise
    const nextIdx = (exIdx + 1) % EXERCISES.length;
    setExIdx(nextIdx);
    setReps(0);
    setElapsed(0);
    setSessionScore(0);
    setFeedback(null);
    setPersonIn(true);
    lastCorr.current = null;
    lastFb.current = null;
    sampN.current = 0;
    scoreAcc.current = 0;
    prevKpts.current = [];
    prevConfs.current = [];
    exStartRef.current = Date.now();

    // Clear skeleton overlay
    if (overlayRef.current) {
      overlayRef.current.getContext("2d")?.clearRect(0, 0, 9999, 9999);
    }
  }, [exIdx, currentEx, reps]);

  // ── Start ──────────────────────────────────────────────────────────────────
  const startSession = useCallback(async () => {
    setIsActive(true); setIsPaused(false);
    setReps(0); setElapsed(0); setSessionScore(0); setFeedback(null); setPersonIn(true);
    pausedRef.current = false; busyRef.current = false;
    lastCorr.current = null; lastFb.current = null;
    sampN.current = 0; scoreAcc.current = 0;
    prevKpts.current = []; prevConfs.current = [];
    exStartRef.current = Date.now();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (e) { console.warn("Camera:", e); }

    pollRef.current = setInterval(pollFrame, POLL_MS);
  }, [pollFrame]);

  // ── Stop & Save All ────────────────────────────────────────────────────────
  const stopSession = useCallback(async () => {
    pausedRef.current = true;
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;

    const dur = Math.round((Date.now() - exStartRef.current) / 1000);
    const score = Math.round(scoreAcc.current / Math.max(sampN.current, 1));
    // Save last exercise
    const log: ExerciseLog = { name: currentEx.name, score, reps: repsRef.current, duration: dur };
    const allLogs = [...exLog, log];

    setIsActive(false); setIsPaused(false);
    overlayRef.current?.getContext("2d")?.clearRect(0, 0, 9999, 9999);

    try { await saveSession({ exercise: currentEx.name, score, reps: repsRef.current, duration: dur }); }
    catch { /* offline */ }

    navigate("/patient/summary", { state: { exerciseLogs: allLogs } });
  }, [currentEx, exLog, navigate]);

  // ── Pause/Resume ──────────────────────────────────────────────────────────
  const togglePause = useCallback(() => {
    setIsPaused(p => {
      pausedRef.current = !p;
      if (!p) {
        if (pollRef.current) clearInterval(pollRef.current);
      } else {
        pollRef.current = setInterval(pollFrame, POLL_MS);
      }
      return !p;
    });
  }, [pollFrame]);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => () => {
    pausedRef.current = true;
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  const isCorrect = feedback?.is_correct ?? true;
  const scoreColor = feedback
    ? feedback.score >= 80 ? "text-success"
      : feedback.score >= 60 ? "text-primary"
        : "text-destructive"
    : "text-primary";

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">AI Trainer</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">YOLOv8 real-time pose analysis</p>
        </div>
        <div className="flex flex-col gap-1 items-end">
          <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${backendOk ? "bg-success/10 text-success" :
            backendOk === false ? "bg-destructive/10 text-destructive" :
              "bg-secondary text-muted-foreground"
            }`}>
            {backendOk ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {backendOk === null ? "Checking…" : backendOk ? "Backend Online" : "Offline"}
          </span>
          <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${yoloReady ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
            }`}>
            <Brain className="h-3 w-3" />
            {yoloReady === null ? "…" : yoloReady ? "YOLOv8 Active" : "YOLO Unavailable"}
          </span>
        </div>
      </div>

      {/* ── Exercise playlist strip ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {EXERCISES.map((ex, i) => (
          <button
            key={ex.name}
            onClick={() => !isActive && setExIdx(i)}
            className={`flex-none flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${i === exIdx
              ? "bg-primary text-primary-foreground shadow-card"
              : i < exIdx
                ? "bg-success/20 text-success"           // completed
                : "bg-secondary text-muted-foreground"
              }`}
          >
            <span>{ex.emoji}</span>
            <span className="whitespace-nowrap">{ex.name}</span>
            {i < exIdx && <CheckCircle className="h-3 w-3" />}
            {i === exIdx && isActive && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
          </button>
        ))}
      </div>

      {/* ── Current exercise instruction ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={exIdx}
          className="rounded-xl bg-primary/5 border border-primary/20 p-3 flex items-center gap-3"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
        >
          <span className="text-2xl">{currentEx.emoji}</span>
          <div>
            <p className="font-display font-semibold text-foreground">{currentEx.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{currentEx.desc}</p>
          </div>
          <div className="ml-auto text-xs text-muted-foreground font-medium">
            {exIdx + 1} / {EXERCISES.length}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* ── Camera area ── */}
      <motion.div
        className="rounded-2xl overflow-hidden relative bg-black"
        style={{ aspectRatio: "4/3" }}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" }}
          muted playsInline
        />
        <canvas ref={captureRef} className="hidden" />
        <canvas
          ref={overlayRef}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ transform: "scaleX(-1)" }}
        />

        {/* Start screen */}
        {!isActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-10 backdrop-blur-sm">
            <div className="h-20 w-20 rounded-full bg-gradient-primary flex items-center justify-center mb-4 shadow-glow">
              <Camera className="h-10 w-10 text-primary-foreground" />
            </div>
            <p className="font-display font-bold text-white mb-1 text-lg">Ready: {currentEx.name}</p>
            <p className="text-sm text-white/70 mb-5">{currentEx.desc}</p>
            <Button
              variant="hero"
              size="lg"
              onClick={startSession}
              disabled={backendOk === false}
            >
              <Play className="h-5 w-5" /> Start Training
            </Button>
            {backendOk === false && (
              <p className="text-xs text-destructive mt-3">Run <code>python d3.py</code> first</p>
            )}
          </div>
        )}

        {/* Top HUD */}
        {isActive && (
          <div className="absolute top-0 left-0 right-0 flex justify-between items-start p-3 z-20 pointer-events-none">
            <div className="glass rounded-xl px-3 py-2 min-w-[110px]">
              <p className="text-[10px] text-white/60 uppercase tracking-wide">Detected</p>
              <p className="font-semibold text-sm text-white leading-tight">
                {feedback?.label ?? "Detecting…"}
              </p>
            </div>
            <div className="glass rounded-xl px-4 py-2 text-center">
              <p className="text-[10px] text-white/60 uppercase tracking-wide">Timer</p>
              <p className="font-display font-bold text-white tabular-nums">{fmt(elapsed)}</p>
            </div>
            <div className="glass rounded-xl px-3 py-2 text-center min-w-[80px]">
              <p className="text-[10px] text-white/60 uppercase tracking-wide">Conf</p>
              <p className="font-display font-bold text-white">
                {feedback ? `${Math.round(feedback.confidence * 100)}%` : "—"}
              </p>
            </div>
          </div>
        )}

        {/* No-person warning */}
        {isActive && !personIn && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <div className="glass rounded-xl px-4 py-2 flex items-center gap-2">
              <UserX className="h-4 w-4 text-warning" />
              <p className="text-sm text-white font-medium">Step fully into frame</p>
            </div>
          </div>
        )}

        {/* Initialising indicator */}
        {isActive && !feedback && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className="flex flex-col items-center gap-3">
              <Brain className="h-14 w-14 text-primary/60 animate-pulse" />
              <p className="text-white/70 text-sm">Initialising YOLOv8…</p>
            </div>
          </div>
        )}

        {/* Request indicator dot */}
        {isActive && busy && (
          <div className="absolute top-3 right-3 z-30 pointer-events-none">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          </div>
        )}
      </motion.div>

      {/* ── Controls ── */}
      {isActive && (
        <motion.div
          className="flex flex-wrap gap-3 justify-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Button variant={isPaused ? "hero" : "secondary"} size="lg" onClick={togglePause}>
            {isPaused ? <><Play className="h-5 w-5" /> Resume</> : <><Pause className="h-5 w-5" /> Pause</>}
          </Button>

          <Button variant="outline" size="lg" onClick={nextExercise} title="Save this exercise and move to the next one">
            <SkipForward className="h-5 w-5" />
            Next Exercise
            <ChevronRight className="h-4 w-4 opacity-50" />
          </Button>

          <Button variant="destructive" size="lg" onClick={stopSession}>
            <Square className="h-5 w-5" /> Finish &amp; Save
          </Button>
        </motion.div>
      )}

      {/* ── Live feedback ── */}
      <AnimatePresence>
        {isActive && feedback && (
          <motion.div
            className="space-y-3"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            {/* Status */}
            <div className={`rounded-xl p-4 flex items-center gap-3 border ${isCorrect ? "bg-success/10 border-success/20" : "bg-destructive/10 border-destructive/20"
              }`}>
              {isCorrect
                ? <CheckCircle className="h-6 w-6 text-success shrink-0" />
                : <XCircle className="h-6 w-6 text-destructive shrink-0" />}
              <div>
                <p className="font-semibold text-sm text-foreground">
                  {isCorrect ? "Form is correct!" : "Needs adjustment"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{feedback.feedback}</p>
              </div>
            </div>

            {/* Score / Reps / Avg */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-card p-4 shadow-card flex flex-col items-center gap-1">
                <p className={`text-3xl font-display font-bold ${scoreColor}`}>{feedback.score}</p>
                <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-primary"
                    animate={{ width: `${feedback.score}%` }}
                    transition={{ type: "spring", stiffness: 80, damping: 20 }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Live Score</p>
              </div>
              <div className="rounded-xl bg-card p-4 shadow-card text-center">
                <p className="text-3xl font-display font-bold text-foreground">{reps}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Reps</p>
              </div>
              <div className="rounded-xl bg-card p-4 shadow-card flex flex-col items-center gap-1">
                <p className="text-3xl font-display font-bold text-primary">{sessionScore}</p>
                <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-primary/70"
                    animate={{ width: `${sessionScore}%` }}
                    transition={{ type: "spring", stiffness: 60, damping: 25 }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Avg Score</p>
              </div>
            </div>

            {/* Feedback tip */}
            <div className="rounded-xl bg-info/10 border border-info/20 p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-info mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">{feedback.feedback}</p>
            </div>

            {/* Exercise log so far */}
            {exLog.length > 0 && (
              <div className="rounded-xl bg-card p-4 shadow-card">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Completed Exercises
                </p>
                <div className="space-y-1.5">
                  {exLog.map((log, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-foreground font-medium">{log.name}</span>
                      <div className="flex gap-3 text-muted-foreground text-xs">
                        <span>{log.reps} reps</span>
                        <span className={`font-bold ${log.score >= 70 ? "text-success" : "text-destructive"}`}>
                          {log.score}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AITrainer;
