import { motion } from "framer-motion";
import { Users, AlertCircle, TrendingUp, ClipboardList } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const patients = [
  { name: "John Doe", status: "On Track", score: 87, alert: false },
  { name: "Sarah Lee", status: "Needs Attention", score: 52, alert: true },
  { name: "Mike Chen", status: "On Track", score: 91, alert: false },
  { name: "Emma Wilson", status: "Improving", score: 74, alert: false },
  { name: "Raj Patel", status: "Needs Attention", score: 45, alert: true },
];

const DoctorHome = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Welcome, {user?.name} 👋</h1>
        <p className="text-muted-foreground mt-1">Patient overview for today</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Users, label: "Total Patients", value: "24", color: "text-primary" },
          { icon: AlertCircle, label: "Need Attention", value: "5", color: "text-destructive" },
          { icon: TrendingUp, label: "Avg Score", value: "78", color: "text-success" },
        ].map(({ icon: Icon, label, value, color }, i) => (
          <motion.div key={label} className="rounded-xl bg-card p-4 shadow-card text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Icon className={`h-6 w-6 mx-auto mb-2 ${color}`} />
            <p className="text-2xl font-display font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Patient List */}
      <motion.div className="rounded-xl bg-card p-4 shadow-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="flex items-center gap-2 mb-4">
          <ClipboardList className="h-5 w-5 text-primary" />
          <h3 className="font-display font-semibold text-foreground">Recent Patients</h3>
        </div>
        <div className="space-y-3">
          {patients.map((p, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors">
              <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center shrink-0">
                <span className="text-primary-foreground font-display font-bold text-sm">{p.name[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{p.name}</p>
                <p className={`text-xs ${p.alert ? "text-destructive" : "text-muted-foreground"}`}>{p.status}</p>
              </div>
              <span className={`text-sm font-display font-bold ${p.score >= 70 ? "text-primary" : "text-destructive"}`}>
                {p.score}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default DoctorHome;
