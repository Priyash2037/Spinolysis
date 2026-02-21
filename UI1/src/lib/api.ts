// src/lib/api.ts
// Typed client for the Flask backend (d3.py) on port 5001

const BASE_URL = "https://spinolysis.onrender.com";

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Landmark {
  x: number; y: number; z: number; visibility: number;
}

export interface PoseAnalysisResult {
  label: string;
  score: number;
  is_correct: boolean;
  feedback: string;
  confidence: number;
  person_detected: boolean;          // false when YOLO sees no person
  keypoints: [number, number][]; // 17 COCO [x, y] pairs, normalized 0-1
  kpt_confidences: number[];           // per-keypoint confidence 0-1
  connections: [number, number][]; // bone connections for skeleton drawing
}

export interface SessionSummary {
  exercise_score: number;
  off_exercise_score: number;
  completed: { name: string; score: number; time: string }[];
  sensor_insights: { spinal_alignment: string; forward_head_posture: string; slouching_duration: string };
  daily_goal: number;
  done_count: number;
}

export interface WeeklyPoint { day: string; score: number; exercises: number }
export interface MonthlyPoint { week: string; score: number; posture: number }
export interface Patient { name: string; progress: string; achievement: string; score: number; data: number[] }

// ─── API Functions ────────────────────────────────────────────────────────────

/** Send a base64-encoded JPEG frame + current exercise name to YOLO model.
 *  Passing exercise lets the backend skip the RandomForest classifier (~2ms saved). */
export async function analyzePoseImage(imageBase64: string, exercise?: string): Promise<PoseAnalysisResult> {
  return fetchAPI<PoseAnalysisResult>("/api/analyze-pose", {
    method: "POST",
    body: JSON.stringify({ image: imageBase64, exercise: exercise ?? "" }),
  });
}

/** Legacy: send MediaPipe landmarks (backward compat) */
export async function analyzePose(landmarks: Landmark[]): Promise<PoseAnalysisResult> {
  return fetchAPI<PoseAnalysisResult>("/api/analyze-pose", {
    method: "POST",
    body: JSON.stringify({ landmarks }),
  });
}

export async function saveSession(data: { exercise: string; score: number; reps: number; duration: number; patient?: string }): Promise<{ saved: boolean }> {
  return fetchAPI<{ saved: boolean }>("/api/save-session", { method: "POST", body: JSON.stringify(data) });
}

export async function getSessionSummary(): Promise<SessionSummary> {
  return fetchAPI<SessionSummary>("/api/session-summary");
}

export async function getHistory(period: "weekly" | "monthly"): Promise<WeeklyPoint[] | MonthlyPoint[]> {
  return fetchAPI<WeeklyPoint[] | MonthlyPoint[]>(`/api/history?period=${period}`);
}

export async function getPatients(): Promise<Patient[]> {
  return fetchAPI<Patient[]>("/api/patients");
}

export async function healthCheck(): Promise<{ status: string; yolo: boolean }> {
  return fetchAPI<{ status: string; yolo: boolean }>("/api/health");
}
