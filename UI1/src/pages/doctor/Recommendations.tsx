import { useState } from "react";
import { motion } from "framer-motion";
import { Brain, Send, CheckCircle, User } from "lucide-react";
import { Button } from "@/components/ui/button";

const patients = [
  { name: "John Doe", condition: "Mild kyphosis", currentExercises: ["Bridge Pose", "Cat-Cow"] },
  { name: "Sarah Lee", condition: "Forward head posture", currentExercises: ["Neck Tilt", "Mountain Pose"] },
  { name: "Emma Wilson", condition: "Lumbar lordosis", currentExercises: ["Bridge Pose", "Hand Raise"] },
];

const suggestedExercises = [
  { name: "Bridge Pose", reason: "Strengthens lower back" },
  { name: "Cat-Cow Pose", reason: "Improves spine flexibility" },
  { name: "Hand Raise", reason: "Opens chest and shoulders" },
  { name: "Mountain Pose", reason: "Full body alignment" },
  { name: "Neck Tilt", reason: "Relieves neck tension" },
  { name: "Wrist Rotation", reason: "Wrist joint mobility" },
];

const Recommendations = () => {
  const [selectedPatient, setSelectedPatient] = useState(0);
  const [chosen, setChosen] = useState<string[]>(patients[0].currentExercises);
  const [notes, setNotes] = useState("");
  const [sent, setSent] = useState(false);

  const patient = patients[selectedPatient];

  const toggleExercise = (name: string) => {
    setChosen((prev) => prev.includes(name) ? prev.filter((e) => e !== name) : [...prev, name]);
  };

  const handleSend = () => {
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Recommendations</h1>
        <p className="text-muted-foreground mt-1">ML-assisted exercise prescription</p>
      </div>

      {/* Patient Selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {patients.map((p, i) => (
          <button
            key={p.name}
            onClick={() => { setSelectedPatient(i); setChosen(p.currentExercises); setSent(false); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap transition-all ${
              selectedPatient === i ? "bg-primary text-primary-foreground shadow-card" : "bg-secondary text-secondary-foreground"
            }`}
          >
            <User className="h-4 w-4" />
            <span className="text-sm font-medium">{p.name}</span>
          </button>
        ))}
      </div>

      {/* Patient Info */}
      <motion.div className="rounded-xl bg-card p-4 shadow-card" key={selectedPatient} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center">
            <span className="text-primary-foreground font-display font-bold text-sm">{patient.name[0]}</span>
          </div>
          <div>
            <p className="font-medium text-foreground">{patient.name}</p>
            <p className="text-xs text-muted-foreground">{patient.condition}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <Brain className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">ML Suggested Exercises</p>
        </div>
      </motion.div>

      {/* Exercise Selection */}
      <div className="grid grid-cols-2 gap-3">
        {suggestedExercises.map((ex) => (
          <button
            key={ex.name}
            onClick={() => toggleExercise(ex.name)}
            className={`p-3 rounded-xl border-2 text-left transition-all ${
              chosen.includes(ex.name) ? "border-primary bg-primary/5" : "border-border bg-card"
            }`}
          >
            <p className="text-sm font-medium text-foreground">{ex.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{ex.reason}</p>
          </button>
        ))}
      </div>

      {/* Notes */}
      <textarea
        placeholder="Add prescription notes..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="w-full h-24 p-3 rounded-xl border border-input bg-card text-foreground placeholder:text-muted-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
      />

      {/* Send */}
      {sent ? (
        <motion.div className="flex items-center gap-2 justify-center py-3 text-success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
          <CheckCircle className="h-5 w-5" />
          <span className="font-semibold">Sent to {patient.name}!</span>
        </motion.div>
      ) : (
        <Button variant="hero" size="lg" className="w-full" onClick={handleSend}>
          <Send className="h-5 w-5" /> Send to Patient
        </Button>
      )}
    </div>
  );
};

export default Recommendations;
