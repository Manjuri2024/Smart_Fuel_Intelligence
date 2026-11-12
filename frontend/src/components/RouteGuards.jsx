import { Link, Navigate, useLocation } from "react-router-dom";
import { Lock, ShieldAlert } from "lucide-react";
import { useAuth } from "./AuthContext.jsx";
import { Loading } from "./ui.jsx";

export const SAVE_MESSAGE = "Create a free FuelWise account to save your trips and vehicle information.";

export function AccountRequired({ feature = "This feature" }) {
  return (
    <div className="card mx-auto mt-10 max-w-lg p-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-tint text-deep"><Lock className="h-6 w-6" /></span>
      <h1 className="mt-4 text-xl font-extrabold">{feature} needs an account</h1>
      <p className="mt-2 text-sage">{SAVE_MESSAGE}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/signup" className="btn-primary">Create Account</Link>
        <Link to="/login" className="btn-outline">Sign In</Link>
      </div>
    </div>
  );
}

export function Forbidden() {
  return (
    <div className="card mx-auto mt-10 max-w-lg p-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-beige/30 text-deep"><ShieldAlert className="h-6 w-6" /></span>
      <h1 className="mt-4 text-xl font-extrabold">You do not have access to this page</h1>
      <p className="mt-2 text-sage">This area is only for administrators.</p>
      <Link to="/dashboard" className="btn-primary mt-6">Back to Dashboard</Link>
    </div>
  );
}

/**
 * level "demo":    signed-in users AND guests (Home, Dashboard, calculators, comparison, maps)
 * level "account": signed-in users only (guests see the "create an account" page)
 * level "admin":   administrators only
 * This only controls what is SHOWN. The backend enforces the same rules on every request.
 */
export function RequireAccess({ level = "demo", feature, children }) {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === "loading") return <Loading text="Checking your session..." />;
  if (status === "anonymous") return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (level === "account" && status === "guest") return <AccountRequired feature={feature} />;
  if (level === "admin" && user?.role !== "admin") return <Forbidden />;
  return children;
}
