import { motion } from "framer-motion";
import { Heart, Brain, Shield, AlertTriangle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

const DoctorAbout = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">About & Documentation</h1>
        <p className="text-muted-foreground mt-1">Platform overview and clinical guidelines</p>
      </div>

      <motion.div className="rounded-2xl bg-gradient-hero p-6 shadow-elevated" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Heart className="h-8 w-8 text-primary-foreground/80 mb-3" />
        <h2 className="text-xl font-display font-bold text-primary-foreground mb-2">Spinolysis for Clinicians</h2>
        <p className="text-primary-foreground/80 text-sm leading-relaxed">
          Spinolysis provides AI-assisted posture analysis and exercise monitoring tools. Use patient reports to track 
          progress, prescribe exercises, and monitor compliance remotely.
        </p>
      </motion.div>

      <div className="grid gap-4">
        {[
          { icon: Brain, title: "ML Exercise Analysis", desc: "Real-time pose estimation provides objective exercise scoring. Use these metrics alongside clinical judgment." },
          { icon: Shield, title: "Sensor Data Integration", desc: "ESP + IMU sensors track off-exercise posture habits. Data is available in patient summary reports." },
          { icon: FileText, title: "Report Export", desc: "Download patient reports as PDF for clinical records and referral documentation." },
        ].map(({ icon: Icon, title, desc }, i) => (
          <motion.div key={title} className="rounded-xl bg-card p-5 shadow-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Icon className="h-6 w-6 text-primary mb-2" />
            <h3 className="font-display font-semibold text-foreground mb-1">{title}</h3>
            <p className="text-sm text-muted-foreground">{desc}</p>
          </motion.div>
        ))}
      </div>

      <motion.div className="rounded-xl bg-warning/10 border border-warning/20 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-sm text-foreground mb-1">Clinical Disclaimer</p>
            <p className="text-sm text-muted-foreground">
              Spinolysis is a supplementary tool. ML scores should not replace clinical assessment. 
              Always apply professional judgment when interpreting patient data.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default DoctorAbout;
