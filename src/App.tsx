import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import TaskDetail from "./pages/TaskDetail";
import Attendance from "./pages/Attendance";
import AdminUsers from "./pages/admin/Users";
import AdminAttendance from "./pages/admin/Attendance";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

const Shell = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute><AppShell>{children}</AppShell></ProtectedRoute>
);
const AdminShell = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute requireRole="admin"><AppShell>{children}</AppShell></ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Shell><Dashboard /></Shell>} />
          <Route path="/projects" element={<Shell><Projects /></Shell>} />
          <Route path="/projects/:id" element={<Shell><ProjectDetail /></Shell>} />
          <Route path="/tasks/:id" element={<Shell><TaskDetail /></Shell>} />
          <Route path="/attendance" element={<Shell><Attendance /></Shell>} />
          <Route path="/admin/users" element={<AdminShell><AdminUsers /></AdminShell>} />
          <Route path="/admin/attendance" element={<AdminShell><AdminAttendance /></AdminShell>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
