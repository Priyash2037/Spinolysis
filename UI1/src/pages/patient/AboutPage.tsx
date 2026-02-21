import { motion } from "framer-motion";
import { Heart, Brain, Shield, AlertTriangle } from "lucide-react";

const AboutPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">About Spinolysis</h1>
        <p className="text-muted-foreground mt-1">AI-powered posture correction platform</p>
      </div>

      <motion.div className="rounded-2xl bg-gradient-primary p-6 shadow-elevated" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Heart className="h-8 w-8 text-primary-foreground/80 mb-3" />
        <h2 className="text-xl font-display font-bold text-primary-foreground mb-2">Our Mission</h2>
        <p className="text-primary-foreground/80 text-sm leading-relaxed">
          Spinolysis combines artificial intelligence and physiotherapy expertise to help individuals improve their posture, 
          prevent spinal issues, and maintain a healthy lifestyle through guided exercises and real-time feedback.
        </p>
      </motion.div>

      <div className="grid gap-4">
        {[
          { icon: Brain, title: "AI-Powered Analysis", desc: "Real-time ML pose estimation detects your body keypoints and evaluates exercise form instantly." },
          { icon: Shield, title: "Sensor Integration", desc: "ESP + IMU sensors provide off-exercise posture monitoring via Bluetooth for comprehensive tracking." },
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
            <p className="font-semibold text-sm text-foreground mb-1">Disclaimer</p>
            <p className="text-sm text-muted-foreground">
              Spinolysis is an educational and posture assistance tool only. It is not a replacement for professional 
              medical diagnosis or treatment. Always consult a qualified healthcare provider for medical advice.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AboutPage;
