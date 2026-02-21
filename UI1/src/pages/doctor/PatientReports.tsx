import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Search, Download, ChevronRight, LineChart as LineChartIcon,
  Loader2, FileText, CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getPatients, type Patient } from "@/lib/api";

const FALLBACK: Patient[] = [
  { name: "John Doe", progress: "On Track", score: 87, achievement: "Gold", data: [70, 75, 80, 85, 87] },
  { name: "Sarah Lee", progress: "Needs Work", score: 52, achievement: "Bronze", data: [60, 55, 50, 48, 52] },
  { name: "Mike Chen", progress: "Excellent", score: 91, achievement: "Platinum", data: [78, 82, 86, 89, 91] },
  { name: "Emma Wilson", progress: "Improving", score: 74, achievement: "Silver", data: [60, 65, 68, 71, 74] },
  { name: "Raj Patel", progress: "Needs Work", score: 45, achievement: "Bronze", data: [50, 48, 46, 44, 45] },
];

const ACHIEVEMENT_COLOR: Record<string, string> = {
  Platinum: "#e2e8f0", Gold: "#facc15", Silver: "#94a3b8", Bronze: "#b45309",
};

// ── PDF generator (no external package — draws with native browser APIs) ──────
async function exportPDF(patient: Patient) {
  // Dynamic import jsPDF from CDN (works without npm)
  // @ts-expect-error — loaded at runtime
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

  const PW = 210;   // page width mm
  const ML = 18;    // left margin
  const MR = PW - 18;
  const now = new Date().toLocaleDateString("en-IN", {
    day: "2-digit", month: "long", year: "numeric"
  });

  // ── Gradient header bar ──────────────────────────────────────────────────
  doc.setFillColor(22, 163, 140);   // teal
  doc.rect(0, 0, PW, 35, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("PhysioAI — Patient Report", ML, 16);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${now}`, ML, 24);
  doc.text("Confidential — For Medical Use Only", ML, 30);

  // ── Patient info block ───────────────────────────────────────────────────
  let y = 48;
  doc.setTextColor(15, 23, 42);
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(ML, y - 6, MR - ML, 38, 3, 3, "F");

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(patient.name, ML + 6, y + 4);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`Status: ${patient.progress}`, ML + 6, y + 12);
  doc.text(`Achievement: ${patient.achievement}`, ML + 6, y + 19);
  doc.text(`Overall Score: ${patient.score}/100`, ML + 6, y + 26);

  // Score badge (right side)
  const scoreColor = patient.score >= 70 ? [22, 163, 140] : [220, 38, 38];
  doc.setFillColor(...(scoreColor as [number, number, number]));
  doc.circle(MR - 18, y + 13, 16, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(String(patient.score), MR - 25, y + 18);

  // ── Stats grid ───────────────────────────────────────────────────────────
  y += 50;
  const improvement = patient.data[patient.data.length - 1] - patient.data[0];
  const avgScore = Math.round(patient.data.reduce((a, b) => a + b, 0) / patient.data.length);
  const peak = Math.max(...patient.data);

  const stats = [
    { label: "Current Score", val: patient.score },
    { label: "Avg Score", val: avgScore },
    { label: "Peak Score", val: peak },
    { label: "Improvement", val: `+${improvement}%` },
  ];
  const colW = (MR - ML) / 4;
  stats.forEach((s, i) => {
    const x = ML + i * colW;
    doc.setFillColor(22, 163, 140, 0.07);
    doc.setFillColor(240, 253, 250);
    doc.roundedRect(x, y - 4, colW - 3, 26, 2, 2, "F");
    doc.setTextColor(22, 163, 140);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(String(s.val), x + 4, y + 10);
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(s.label, x + 4, y + 17);
  });

  // ── Progress table ────────────────────────────────────────────────────────
  y += 38;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Progress Over Time", ML, y);
  y += 6;

  // Table header
  const headers = ["Week", "Score", "Change", "Status"];
  const colWidths = [30, 30, 35, 60];
  doc.setFillColor(22, 163, 140);
  doc.rect(ML, y, MR - ML, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  let cx = ML;
  headers.forEach((h, i) => {
    doc.text(h, cx + 3, y + 5.5);
    cx += colWidths[i];
  });
  y += 8;

  // Table rows
  patient.data.forEach((score, i) => {
    const isEven = i % 2 === 0;
    doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
    doc.rect(ML, y, MR - ML, 7, "F");

    const change = i === 0 ? "—" : `${score - patient.data[i - 1] >= 0 ? "+" : ""}${score - patient.data[i - 1]}`;
    const status = score >= 80 ? "Excellent" : score >= 65 ? "On Track" : "Needs Work";
    const vals = [`Week ${i + 1}`, String(score), change, status];

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    cx = ML;
    vals.forEach((v, j) => {
      if (j === 3) {
        const c = status === "Excellent" ? [22, 163, 140] : status === "On Track" ? [59, 130, 246] : [220, 38, 38];
        doc.setTextColor(...(c as [number, number, number]));
      }
      doc.text(v, cx + 3, y + 4.8);
      cx += colWidths[j];
      doc.setTextColor(15, 23, 42);
    });
    y += 7;
  });

  // ── Clinical notes ────────────────────────────────────────────────────────
  y += 10;
  doc.setFillColor(255, 251, 235);
  doc.roundedRect(ML, y - 4, MR - ML, 35, 3, 3, "F");
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Clinical Observations", ML + 6, y + 4);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  const notes = [
    `• Patient shows ${improvement >= 0 ? "positive" : "negative"} trend over the tracking period.`,
    `• Peak performance of ${peak}/100 recorded. Current score: ${patient.score}/100.`,
    `• Achievement tier: ${patient.achievement}. Recommend ${patient.score < 65 ? "intensified" : "maintained"} therapy.`,
    `• Continue monitoring with AI-assisted sessions for accuracy.`,
  ];
  notes.forEach((n, i) => { doc.text(n, ML + 6, y + 13 + i * 5.5); });

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setFillColor(22, 163, 140);
  doc.rect(0, 285, PW, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("PhysioAI — Powered by YOLOv8 + D3 RandomForest", ML, 292);
  doc.text(`Page 1 of 1  |  ${now}`, MR - 45, 292);

  doc.save(`PhysioAI_${patient.name.replace(/\s+/g, "_")}_Report.pdf`);
}

// ─────────────────────────────────────────────────────────────────────────────

const PatientReports = () => {
  const [patients, setPatients] = useState<Patient[]>(FALLBACK);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Patient | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  useEffect(() => {
    getPatients()
      .then(setPatients)
      .catch(() => setPatients(FALLBACK))
      .finally(() => setLoading(false));
  }, []);

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = async () => {
    if (!selected) return;
    setExporting(true);
    setExported(false);
    try {
      await exportPDF(selected);
      setExported(true);
      setTimeout(() => setExported(false), 3000);
    } catch (e) {
      console.error("PDF export failed:", e);
      alert("PDF export failed. Check your internet connection.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Patient Reports</h1>
        <p className="text-muted-foreground mt-1">View detailed analytics and export PDF reports</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search patients…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full h-11 pl-11 pr-4 rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : !selected ? (
        <div className="space-y-2">
          {filtered.map((p, i) => (
            <motion.button
              key={p.name}
              onClick={() => setSelected(p)}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-card shadow-card hover:shadow-elevated transition-all text-left"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center shrink-0">
                <span className="text-primary-foreground font-display font-bold text-sm">{p.name[0]}</span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">{p.name}</p>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">{p.progress}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: `${ACHIEVEMENT_COLOR[p.achievement]}22`, color: ACHIEVEMENT_COLOR[p.achievement] }}>
                    {p.achievement}
                  </span>
                </div>
              </div>
              <span className={`text-lg font-display font-bold ${p.score >= 70 ? "text-primary" : "text-destructive"}`}>
                {p.score}
              </span>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </motion.button>
          ))}
        </div>
      ) : (
        <motion.div className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <button
            onClick={() => { setSelected(null); setExported(false); }}
            className="text-sm text-primary font-medium hover:underline"
          >
            ← Back to list
          </button>

          <div className="rounded-xl bg-card p-5 shadow-card">
            {/* Header row */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-gradient-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-display font-bold">{selected.name[0]}</span>
                </div>
                <div>
                  <h2 className="font-display font-bold text-foreground text-lg">{selected.name}</h2>
                  <p className="text-sm text-muted-foreground">{selected.progress} · {selected.achievement}</p>
                </div>
              </div>

              {/* PDF Export button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={exporting}
                className="gap-1.5 min-w-[110px]"
              >
                {exporting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
                ) : exported ? (
                  <><CheckCircle className="h-4 w-4 text-success" /> Saved!</>
                ) : (
                  <><FileText className="h-4 w-4" /><Download className="h-3.5 w-3.5" /> Export PDF</>
                )}
              </Button>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { label: "Score", val: selected.score },
                { label: "Peak", val: Math.max(...selected.data) },
                { label: "Avg", val: Math.round(selected.data.reduce((a, b) => a + b, 0) / selected.data.length) },
                { label: "Growth", val: `+${selected.data[selected.data.length - 1] - selected.data[0]}%` },
              ].map(s => (
                <div key={s.label} className="rounded-lg bg-secondary p-3 text-center">
                  <p className="text-2xl font-display font-bold text-primary">{s.val}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Chart */}
            <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2">
              <LineChartIcon className="h-4 w-4 text-primary" /> Progress Over Time
            </h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={selected.data.map((v, i) => ({ week: `W${i + 1}`, score: v }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(180,15%,90%)" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="hsl(200,10%,50%)" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(200,10%,50%)" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "none", background: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                />
                <Bar dataKey="score" fill="hsl(174,62%,40%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            {/* PDF hint */}
            {exported && (
              <motion.p
                className="text-xs text-success text-center mt-3"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              >
                ✅ PDF saved to your Downloads folder
              </motion.p>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default PatientReports;
