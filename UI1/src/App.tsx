import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import PatientLayout from "./components/layouts/PatientLayout";
import DoctorLayout from "./components/layouts/DoctorLayout";
import PatientHome from "./pages/patient/PatientHome";
import ExerciseTutorials from "./pages/patient/ExerciseTutorials";
import AITrainer from "./pages/patient/AITrainer";
import SummaryPage from "./pages/patient/SummaryPage";
import AnalysisPage from "./pages/patient/AnalysisPage";
import AboutPage from "./pages/patient/AboutPage";
import DoctorHome from "./pages/doctor/DoctorHome";
import PatientReports from "./pages/doctor/PatientReports";
import Recommendations from "./pages/doctor/Recommendations";
import DoctorAbout from "./pages/doctor/DoctorAbout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children, requiredRole }: { children: React.ReactNode; requiredRole: "patient" | "doctor" }) => {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (role !== requiredRole) return <Navigate to={`/${role}`} replace />;
  return <>{children}</>;
};

const AppRoutes = () => {
  const { isAuthenticated, role } = useAuth();

  return (
    <Routes>
      <Route path="/" element={isAuthenticated ? <Navigate to={`/${role}`} replace /> : <LoginPage />} />

      <Route path="/patient" element={<ProtectedRoute requiredRole="patient"><PatientLayout /></ProtectedRoute>}>
        <Route index element={<PatientHome />} />
        <Route path="exercises" element={<ExerciseTutorials />} />
        <Route path="ai-trainer" element={<AITrainer />} />
        <Route path="summary" element={<SummaryPage />} />
        <Route path="analysis" element={<AnalysisPage />} />
        <Route path="about" element={<AboutPage />} />
      </Route>

      <Route path="/doctor" element={<ProtectedRoute requiredRole="doctor"><DoctorLayout /></ProtectedRoute>}>
        <Route index element={<DoctorHome />} />
        <Route path="reports" element={<PatientReports />} />
        <Route path="recommendations" element={<Recommendations />} />
        <Route path="about" element={<DoctorAbout />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
