import { motion } from "framer-motion";
import { Target, TrendingUp, Lightbulb, Activity, Flame, Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";

const tips = [
  "Keep your shoulders back and relaxed while sitting.",
  "Take a posture break every 30 minutes.",
  "Strengthen your core to support your spine.",
  "Avoid looking down at your phone for extended periods.",
];

const PatientHome = () => {
  const { user } = useAuth();
  const dailyGoal = 6;
  const completed = 4;
  const progress = Math.round((completed / dailyGoal) * 100);

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">
          Hi, {user?.name?.split(" ")[0]} 👋
        </h1>
        <p className="text-muted-foreground mt-1">Let's keep your spine healthy today!</p>
      </div>

      {/* Daily Goal Card */}
      <motion.div
        className="rounded-2xl bg-gradient-primary p-6 shadow-elevated"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-primary-foreground/80 text-sm font-medium">Daily Exercise Goal</p>
            <p className="text-3xl font-display font-bold text-primary-foreground mt-1">
              {completed}/{dailyGoal}
            </p>
          </div>
          <div className="h-16 w-16 rounded-2xl bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center">
            <Target className="h-8 w-8 text-primary-foreground" />
          </div>
        </div>
        <Progress value={progress} className="h-2.5 bg-primary-foreground/20" />
        <p className="text-primary-foreground/70 text-xs mt-2">{progress}% completed</p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Flame, label: "Streak", value: "5 days", color: "text-accent" },
          { icon: Zap, label: "Score", value: "87/100", color: "text-primary" },
          { icon: Activity, label: "Posture", value: "Good", color: "text-success" },
        ].map(({ icon: Icon, label, value, color }, i) => (
          <motion.div
            key={label}
            className="rounded-xl bg-card p-4 shadow-card text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Icon className={`h-6 w-6 mx-auto mb-2 ${color}`} />
            <p className="text-lg font-bold font-display text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Progress Summary */}
      <motion.div
        className="rounded-xl bg-card p-5 shadow-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h3 className="font-display font-semibold text-foreground">Weekly Progress</h3>
        </div>
        <div className="flex items-end gap-1.5 h-24">
          {[40, 65, 55, 80, 70, 90, progress].map((val, i) => (
            <motion.div
              key={i}
              className="flex-1 rounded-t-md bg-gradient-primary"
              style={{ height: `${val}%` }}
              initial={{ height: 0 }}
              animate={{ height: `${val}%` }}
              transition={{ delay: 0.4 + i * 0.05, duration: 0.4 }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
      </motion.div>

      {/* Tip */}
      <motion.div
        className="rounded-xl bg-accent/10 border border-accent/20 p-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="flex items-start gap-3">
          <Lightbulb className="h-5 w-5 text-accent mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-sm text-foreground mb-1">Posture Tip</p>
            <p className="text-sm text-muted-foreground">{tips[Math.floor(Math.random() * tips.length)]}</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PatientHome;
