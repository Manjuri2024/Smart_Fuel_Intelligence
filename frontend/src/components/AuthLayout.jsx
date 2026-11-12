import { Navigate, Outlet } from "react-router-dom";
import { Fuel } from "lucide-react";
import { useAuth } from "./AuthContext.jsx";
import { Loading } from "./ui.jsx";

/** Shared frame for the login, signup and password pages. Signed-in users are sent to the dashboard. */
export default function AuthLayout() {
  const { status } = useAuth();
  if (status === "loading") return <Loading text="Checking your session..." />;
  if (status === "authenticated") return <Navigate to="/dashboard" replace />;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-white to-tint px-4 py-10">
      <div className="mb-6 flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-deep text-white"><Fuel className="h-6 w-6" /></span>
        <span className="text-2xl font-extrabold text-ink">FuelWise</span>
      </div>
      <div className="card w-full max-w-md p-7"><Outlet /></div>
      <p className="mt-6 text-xs text-sage">Track. Calculate. Compare. Save.</p>
    </div>
  );
}
