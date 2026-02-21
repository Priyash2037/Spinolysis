import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity, Brain, Bluetooth, CheckCircle2, Loader2,
  FileText, Download, Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSessionSummary, type SessionSummary } from "@/lib/api";

// ── PDF export via jsPDF CDN ────────────────────────────────────────────────
async function exportSummaryPDF(data: SessionSummary, exerciseLogs?: { name: string; score: number; reps: number; duration: number }[]) {
  // @ts-expect-error — loaded at runtime from CDN
  if (!window.jspdf) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load jsPDF"));
      document.head.appendChild(s);
    });
  }
  // @ts-expect-error — runtime
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const PW = 210;
  const ML = 18;
  const MR = PW - 18;
  const now = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  const timeStr = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFillColor(22, 163, 140);
  doc.rect(0, 0, PW, 38, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("PhysioAI — Session Report", ML, 16);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${now} at ${timeStr}`, ML, 24);
  doc.text("Patient Session Summary", ML, 30);

  // ── Score banner ──────────────────────────────────────────────────────────
  let y = 50;
  const exerciseColor: [number, number, number] = data.exercise_score >= 80 ? [22, 163, 140] : data.exercise_score >= 60 ? [59, 130, 246] : [220, 38, 38];
  const offColor: [number, number, number] = [251, 146, 60];

  const halfW = (MR - ML - 4) / 2;
  // Exercise score card
  doc.setFillColor(...exerciseColor);
  doc.roundedRect(ML, y, halfW, 30, 4, 4, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(26);
  doc.setFont("helvetica", "bold");
  doc.text(String(data.exercise_score || "–"), ML + halfW / 2 - 8, y + 16);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Exercise Score (Camera ML)", ML + 4, y + 24);

  // Off-exercise score card
  const x2 = ML + halfW + 4;
  doc.setFillColor(...offColor);
  doc.roundedRect(x2, y, halfW, 30, 4, 4, "F");
  doc.text(String(data.off_exercise_score || "–"), x2 + halfW / 2 - 8, y + 16);
  doc.setFontSize(26);
  doc.setFont("helvetica", "bold");
  doc.text(String(data.off_exercise_score || "–"), x2 + halfW / 2 - 8, y + 16);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Off-Exercise Score (IMU)", x2 + 4, y + 24);

  // ── Goal badge ────────────────────────────────────────────────────────────
  y += 38;
  doc.setFillColor(240, 253, 250);
  doc.roundedRect(ML, y, MR - ML, 14, 3, 3, "F");
  doc.setTextColor(22, 163, 140);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Daily Goal: ${data.done_count} / ${data.daily_goal} exercises completed`, ML + 6, y + 9);

  // ── Sensor insights ───────────────────────────────────────────────────────
  y += 22;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Sensor Insights", ML, y);
  y += 6;

  const insights = [
    { label: "Spinal Alignment", value: data.sensor_insights.spinal_alignment, color: [22, 163, 140] as [number, number, number] },
    { label: "Forward Head Posture", value: data.sensor_insights.forward_head_posture, color: [59, 130, 246] as [number, number, number] },
    { label: "Slouching Duration", value: data.sensor_insights.slouching_duration, color: [251, 146, 60] as [number, number, number] },
  ];
  insights.forEach((s, i) => {
    const isEven = i % 2 === 0;
    doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
    doc.rect(ML, y, MR - ML, 8, "F");
    doc.setFillColor(...s.color);
    doc.circle(ML + 4, y + 4, 2, "F");
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(s.label, ML + 9, y + 5.5);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text(String(s.value), MR - doc.getTextWidth(String(s.value)) - 2, y + 5.5);
    y += 8;
  });

  // ── Completed exercises ───────────────────────────────────────────────────
  y += 10;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Completed Exercises", ML, y);
  y += 6;

  // Table header
  doc.setFillColor(22, 163, 140);
  doc.rect(ML, y, MR - ML, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Exercise", ML + 3, y + 5.5);
  doc.text("Time", ML + 80, y + 5.5);
  doc.text("Score", MR - 20, y + 5.5);
  y += 8;

  const exercises = exerciseLogs && exerciseLogs.length > 0
    ? exerciseLogs.map((l, i) => ({ name: l.name, time: `${l.duration}s`, score: l.score }))
    : data.completed;

  exercises.forEach((ex, i) => {
    doc.setFillColor(i % 2 === 0 ? 248 : 255, i % 2 === 0 ? 250 : 255, i % 2 === 0 ? 252 : 255);
    doc.rect(ML, y, MR - ML, 7, "F");
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(ex.name, ML + 3, y + 4.8);
    doc.text(String(ex.time ?? ""), ML + 80, y + 4.8);
    // Colour-code score
    const sc = Number(ex.score);
    const sc3: [number, number, number] = sc >= 80 ? [22, 163, 140] : sc >= 60 ? [59, 130, 246] : [220, 38, 38];
    doc.setTextColor(...sc3);
    doc.setFont("helvetica", "bold");
    doc.text(String(ex.score), MR - 20, y + 4.8);
    doc.setTextColor(15, 23, 42);
    y += 7;
  });

  // ── AI recommendation ──────────────────────────────────────────────────────
  y += 10;
  const avgScore = exercises.length
    ? Math.round(exercises.reduce((a, e) => a + Number(e.score), 0) / exercises.length)
    : data.exercise_score;
  doc.setFillColor(255, 251, 235);
  doc.roundedRect(ML, y, MR - ML, 40, 3, 3, "F");
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("AI Recommendations", ML + 5, y + 8);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  const recs = [
    `• Session average score: ${avgScore}/100 — ${avgScore >= 80 ? "Excellent form maintained." : avgScore >= 60 ? "Good progress, minor corrections needed." : "Focus on form before adding difficulty."}`,
    `• ${data.done_count < data.daily_goal ? `${data.daily_goal - data.done_count} exercise(s) remaining to hit today's goal.` : "Daily goal achieved! Well done."}`,
    `• Slouching detected: ${data.sensor_insights.slouching_duration}. Try posture reminders every 30 minutes.`,
    `• Recommend next session: focus on spinal alignment (currently ${data.sensor_insights.spinal_alignment}).`,
  ];
  recs.forEach((r, i) => doc.text(r, ML + 5, y + 16 + i * 6));

  // ── Footer ─────────────────────────────────────────────────────────────────
  doc.setFillColor(22, 163, 140);
  doc.rect(0, 285, PW, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("PhysioAI — Powered by YOLOv8 ONNX + RTX 3050 DirectML", ML, 292);
  doc.text(`${now}  |  Page 1`, MR - 35, 292);

  doc.save(`PhysioAI_Session_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────

const SummaryPage = () => {
  const location = useLocation();
  const exerciseLogs = (location.state as { exerciseLogs?: { name: string; score: number; reps: number; duration: number }[] } | null)?.exerciseLogs;

  const [data, setData] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  useEffect(() => {
    getSessionSummary()
      .then(setData)
      .catch(() =>
        setData({
          exercise_score: 87,
          off_exercise_score: 74,
          completed: [
            { name: "Bridge Pose", score: 92, time: "09:15 AM" },
            { name: "Cat-Cow Pose", score: 85, time: "09:30 AM" },
            { name: "Neck Tilt", score: 78, time: "10:00 AM" },
            { name: "Mountain Pose", score: 90, time: "10:20 AM" },
          ],
          sensor_insights: {
            spinal_alignment: "82%",
            forward_head_posture: "Low",
            slouching_duration: "12 min",
          },
          daily_goal: 6,
          done_count: 4,
        })
      )
      .finally(() => setLoading(false));
  }, []);

  const handleExport = async () => {
    if (!data) return;
    setExporting(true);
    try {
      await exportSummaryPDF(data, exerciseLogs);
      setExported(true);
      setTimeout(() => setExported(false), 3000);
    } catch (e) {
      console.error(e);
      alert("PDF export failed. Check internet connection.");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return null;

  const avgScore = exerciseLogs && exerciseLogs.length > 0
    ? Math.round(exerciseLogs.reduce((a, e) => a + e.score, 0) / exerciseLogs.length)
    : data.exercise_score;

  return (
    <div className="space-y-5">

      {/* ── Header + Export ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Today's Summary</h1>
          <p className="text-muted-foreground mt-1">
            {data.done_count} of {data.daily_goal} exercises completed
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exporting}
          className="gap-1.5 shrink-0"
        >
          {exporting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
          ) : exported ? (
            <><Share2 className="h-4 w-4 text-success" /> Saved!</>
          ) : (
            <><FileText className="h-4 w-4" /><Download className="h-3.5 w-3.5" /> Export PDF</>
          )}
        </Button>
      </div>

      {/* ── Score Cards ── */}
      <div className="grid grid-cols-2 gap-3">
        <motion.div
          className="rounded-2xl bg-gradient-primary p-5 shadow-elevated"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Brain className="h-8 w-8 text-primary-foreground/80 mb-3" />
          <p className="text-4xl font-display font-bold text-primary-foreground">
            {avgScore || "—"}
          </p>
          <p className="text-xs text-primary-foreground/70 mt-1">Exercise Score</p>
          <p className="text-[10px] text-primary-foreground/50 mt-0.5">Camera ML-based</p>
        </motion.div>
        <motion.div
          className="rounded-2xl bg-gradient-accent p-5 shadow-elevated"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Bluetooth className="h-8 w-8 text-accent-foreground/80 mb-3" />
          <p className="text-4xl font-display font-bold text-accent-foreground">
            {data.off_exercise_score || "—"}
          </p>
          <p className="text-xs text-accent-foreground/70 mt-1">Off-Exercise</p>
          <p className="text-[10px] text-accent-foreground/50 mt-0.5">ESP + IMU sensor</p>
        </motion.div>
      </div>

      {/* ── Sensor Insights ── */}
      <motion.div
        className="rounded-xl bg-card p-4 shadow-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-5 w-5 text-primary" />
          <h3 className="font-display font-semibold text-foreground">Sensor Insights</h3>
        </div>
        <div className="space-y-3">
          {[
            { label: "Spinal Alignment", value: data.sensor_insights.spinal_alignment, color: "bg-primary" },
            { label: "Forward Head Posture", value: data.sensor_insights.forward_head_posture, color: "bg-success" },
            { label: "Slouching Duration", value: data.sensor_insights.slouching_duration, color: "bg-warning" },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${color}`} />
                <span className="text-sm text-muted-foreground">{label}</span>
              </div>
              <span className="text-sm font-semibold text-foreground">{value}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Completed Exercises ── */}
      <motion.div
        className="rounded-xl bg-card p-4 shadow-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h3 className="font-display font-semibold text-foreground mb-3">Completed Exercises</h3>
        {(exerciseLogs ?? data.completed).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No exercises recorded today yet.
          </p>
        ) : (
          <div className="space-y-3">
            {(exerciseLogs
              ? exerciseLogs.map((l, i) => ({ name: l.name, score: l.score, time: `${l.reps} reps · ${l.duration}s` }))
              : data.completed
            ).map((ex, i) => (
              <div key={i} className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{ex.name}</p>
                  {ex.time && <p className="text-xs text-muted-foreground">{ex.time}</p>}
                </div>
                <span className={`text-sm font-display font-bold ${Number(ex.score) >= 70 ? "text-primary" : "text-destructive"}`}>
                  {ex.score}
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* ── PDF success hint ── */}
      {exported && (
        <motion.p
          className="text-xs text-success text-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        >
          ✅ PDF saved to your Downloads folder
        </motion.p>
      )}
    </div>
  );
};

export default SummaryPage;
