import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Home, Dumbbell, Brain, BarChart3, LineChart, Info, LogOut, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import logo from "@/assets/logo.jpeg";

const navItems = [
  { to: "/patient", icon: Home, label: "Home" },
  { to: "/patient/exercises", icon: Dumbbell, label: "Exercises" },
  { to: "/patient/ai-trainer", icon: Brain, label: "AI Trainer" },
  { to: "/patient/summary", icon: BarChart3, label: "Summary" },
  { to: "/patient/analysis", icon: LineChart, label: "Analysis" },
];

const PatientLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 glass border-b border-border/50 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Spinolysis" className="h-9 object-contain" />
          </div>
          <div className="flex items-center gap-3">
            <NavLink to="/patient/about" className="text-muted-foreground hover:text-foreground transition-colors">
              <Info className="h-5 w-5" />
            </NavLink>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{user?.name}</span>
            </div>
            <button onClick={handleLogout} className="text-muted-foreground hover:text-destructive transition-colors">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Outlet />
        </motion.div>
      </main>

      {/* Bottom Nav */}
      <nav className="sticky bottom-0 z-50 glass border-t border-border/50">
        <div className="max-w-5xl mx-auto flex items-center justify-around py-2">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/patient"}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all duration-200 ${
                  isActive ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default PatientLayout;
