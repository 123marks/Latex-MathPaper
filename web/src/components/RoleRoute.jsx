import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";

export default function RoleRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <div className="spinner" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "owner" && user.role !== "admin") {
    return <Navigate to="/app" replace />;
  }
  return children;
}
