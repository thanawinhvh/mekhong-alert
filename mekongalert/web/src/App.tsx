import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import AlertDetail from "./pages/AlertDetail";
import Alerts from "./pages/Alerts";
import LiffOnboard from "./pages/LiffOnboard";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import PublicStatus from "./pages/PublicStatus";
import Reports from "./pages/Reports";
import Sitrep from "./pages/Sitrep";
import WarRoom from "./pages/WarRoom";

function RequireAuth({ children }: { children: ReactElement }) {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/liff" element={<LiffOnboard />} />
      <Route path="/status/:tenantSlug" element={<PublicStatus />} />
      <Route
        path="/warroom"
        element={
          <RequireAuth>
            <WarRoom />
          </RequireAuth>
        }
      />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<Overview />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/alerts/:id" element={<AlertDetail />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/sitrep" element={<Sitrep />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
