import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { getHistory, type WeeklyPoint, type MonthlyPoint } from "@/lib/api";

const FALLBACK_WEEKLY: WeeklyPoint[] = [
  { day: "Mon", score: 72, exercises: 4 },
  { day: "Tue", score: 85, exercises: 5 },
  { day: "Wed", score: 68, exercises: 3 },
  { day: "Thu", score: 90, exercises: 6 },
  { day: "Fri", score: 82, exercises: 5 },
  { day: "Sat", score: 94, exercises: 6 },
  { day: "Sun", score: 87, exercises: 4 },
];

const FALLBACK_MONTHLY: MonthlyPoint[] = [
  { week: "W1", score: 65, posture: 60 },
  { week: "W2", score: 72, posture: 68 },
  { week: "W3", score: 80, posture: 76 },
  { week: "W4", score: 87, posture: 84 },
];

const AnalysisPage = () => {
  const [tab, setTab] = useState<"weekly" | "monthly">("weekly");
  const [weekly, setWeekly] = useState<WeeklyPoint[]>(FALLBACK_WEEKLY);
  const [monthly, setMonthly] = useState<MonthlyPoint[]>(FALLBACK_MONTHLY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getHistory(tab)
      .then(d => {
        if (tab === "weekly") setWeekly(d as WeeklyPoint[]);
        else setMonthly(d as MonthlyPoint[]);
      })
      .catch(() => { /* keep fallback */ })
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Analysis</h1>
        <p className="text-muted-foreground mt-1">Track your improvement over time</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-secondary rounded-xl p-1">
        {(["weekly", "monthly"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${tab === t ? "bg-card text-foreground shadow-card" : "text-muted-foreground"
              }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : tab === "weekly" ? (
        <>
          <motion.div className="rounded-xl bg-card p-4 shadow-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h3 className="font-display font-semibold text-foreground mb-4">Exercise Consistency</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weekly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(180,15%,90%)" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(200,10%,50%)" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(200,10%,50%)" />
                <Tooltip />
                <Bar dataKey="exercises" fill="hsl(174,62%,40%)" radius={[4, 4, 0, 0]} name="Exercises" />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
          <motion.div className="rounded-xl bg-card p-4 shadow-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
            <h3 className="font-display font-semibold text-foreground mb-4">Posture Score Trend</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weekly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(180,15%,90%)" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(200,10%,50%)" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(200,10%,50%)" />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="hsl(14,90%,62%)" strokeWidth={2.5} dot={{ fill: "hsl(14,90%,62%)" }} name="Score" />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        </>
      ) : (
        <>
          <motion.div className="rounded-xl bg-card p-4 shadow-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h3 className="font-display font-semibold text-foreground mb-4">Monthly Progress</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(180,15%,90%)" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="hsl(200,10%,50%)" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(200,10%,50%)" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="score" stroke="hsl(174,62%,40%)" strokeWidth={2.5} name="Exercise Score" />
                <Line type="monotone" dataKey="posture" stroke="hsl(14,90%,62%)" strokeWidth={2.5} name="Posture Score" />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
          <motion.div className="rounded-xl bg-card p-4 shadow-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
            <h3 className="font-display font-semibold text-foreground mb-4">Improvement Breakdown</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(180,15%,90%)" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="hsl(200,10%,50%)" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(200,10%,50%)" />
                <Tooltip />
                <Legend />
                <Bar dataKey="score" fill="hsl(174,62%,40%)" radius={[4, 4, 0, 0]} name="Exercise" />
                <Bar dataKey="posture" fill="hsl(14,90%,62%)" radius={[4, 4, 0, 0]} name="Posture" />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </>
      )}
    </div>
  );
};

export default AnalysisPage;
