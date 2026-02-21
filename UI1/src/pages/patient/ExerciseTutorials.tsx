import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Clock, RotateCcw, AlertTriangle, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const exercises = [
  { id: "bridge", name: "Bridge Pose", duration: "30s", reps: "10 reps", file: "bridge_pose.mp4", difficulty: "Easy", muscle: "Lower Back" },
  { id: "catcow", name: "Cat-Cow Pose", duration: "45s", reps: "8 reps", file: "cat-cow-pose.mp4", difficulty: "Easy", muscle: "Spine" },
  { id: "handraise", name: "Hand Raise", duration: "20s", reps: "12 reps", file: "hand-raise-exercise.mp4", difficulty: "Easy", muscle: "Shoulders" },
  { id: "mountain", name: "Mountain Pose", duration: "60s", reps: "Hold", file: "mountain-pose.mp4", difficulty: "Medium", muscle: "Full Body" },
  { id: "necktilt", name: "Neck Tilt", duration: "15s", reps: "10 reps", file: "neck-tilt-exercise.mp4", difficulty: "Easy", muscle: "Neck" },
  { id: "wrist", name: "Wrist Rotation", duration: "20s", reps: "15 reps", file: "wrist-rotation-exercise.mp4", difficulty: "Easy", muscle: "Wrists" },
];

const ExerciseTutorials = () => {
  const [selected, setSelected] = useState<typeof exercises[0] | null>(null);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Exercise Tutorials</h1>
        <p className="text-muted-foreground mt-1">Learn proper form for each exercise</p>
      </div>

      <div className="grid gap-3">
        {exercises.map((ex, i) => (
          <motion.button
            key={ex.id}
            onClick={() => setSelected(ex)}
            className="w-full flex items-center gap-4 rounded-xl bg-card p-4 shadow-card hover:shadow-elevated transition-all text-left"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <div className="h-14 w-14 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0">
              <Play className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">{ex.name}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {ex.duration}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <RotateCcw className="h-3 w-3" /> {ex.reps}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{ex.muscle}</span>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
          </motion.button>
        ))}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-foreground/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
          >
            <motion.div
              className="w-full max-w-lg bg-card rounded-2xl shadow-elevated overflow-hidden"
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Video Placeholder */}
              <div className="aspect-video bg-foreground/5 flex items-center justify-center relative">
                <div className="text-center">
                  <div className="h-16 w-16 rounded-full bg-gradient-primary flex items-center justify-center mx-auto mb-3 animate-pulse-glow">
                    <Play className="h-8 w-8 text-primary-foreground ml-1" />
                  </div>
                  <p className="text-sm text-muted-foreground">{selected.file}</p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="absolute top-3 right-3 h-8 w-8 rounded-full bg-card/80 backdrop-blur flex items-center justify-center"
                >
                  <X className="h-4 w-4 text-foreground" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <h2 className="text-xl font-display font-bold text-foreground">{selected.name}</h2>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-4 w-4" /> {selected.duration}
                    </span>
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <RotateCcw className="h-4 w-4" /> {selected.reps}
                    </span>
                    <span className="text-sm px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-medium">{selected.difficulty}</span>
                  </div>
                </div>
                <div className="rounded-xl bg-warning/10 border border-warning/20 p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Stop immediately if you feel sharp pain. Consult your physiotherapist before starting new exercises.
                  </p>
                </div>
                <Button variant="hero" size="lg" className="w-full">
                  <Play className="h-5 w-5" /> Start Exercise
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExerciseTutorials;
