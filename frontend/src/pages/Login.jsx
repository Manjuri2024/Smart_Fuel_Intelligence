import { useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useAuth } from "../components/AuthContext.jsx";
import PasswordField, { GoogleMark } from "../components/PasswordField.jsx";
import { ErrorBox, Field } from "../components/ui.jsx";
import { getErrorMessage } from "../services/client.js";
import { googleLoginUrl } from "../services/authService.js";

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const GOOGLE_ERRORS = {
  google_not_configured: "Google sign-in is not set up on this server yet. Use your email and password, or ask the administrator to add the Google credentials (see the README).",
  google_cancelled: "Google sign-in was cancelled. You can try again or use your email and password.",
  google_failed: "Google sign-in failed. Please try again.",
  google_email_exists: "An account with this email already exists. Please sign in with your email and password.",
  account_disabled: "This account has been disabled. Please contact the administrator.",
  registration_closed: "New registrations are currently closed.",
};

export default function Login() {
  const { signIn, continueAsGuest, notice, bootError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [busy, setBusy] = useState(false);

  const urlError = GOOGLE_ERRORS[params.get("error")] || "";

  const submit = async (e) => {
    e.preventDefault();
    setApiError("");
    const v = {};
    if (!email.trim()) v.email = "Email is required.";
    else if (!EMAIL_RE.test(email.trim())) v.email = "Enter a valid email address.";
    if (!password) v.password = "Password is required.";
    setErrors(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      await signIn(email.trim(), password, remember);
      navigate(location.state?.from || "/dashboard", { replace: true });
    } catch (err) {
      setApiError(getErrorMessage(err));
      setBusy(false);
    }
  };

  const guest = () => { continueAsGuest(); navigate("/", { replace: true }); };

  return (
    <div>
      <h1 className="text-2xl font-extrabold">Welcome Back!</h1>
      <p className="mt-1 text-sm text-sage">Sign in to manage your vehicle expenses.</p>

      <div className="mt-4 space-y-3">
        <ErrorBox message={urlError || notice || bootError} />
      </div>

      <form onSubmit={submit} noValidate className="mt-4 space-y-4">
        <Field label="Email address" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} placeholder="you@example.com" />
        <PasswordField label="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
        <div className="flex items-center justify-between text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-[#545E56]" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me
          </label>
          <Link to="/forgot-password" className="font-semibold text-forest underline">Forgot password?</Link>
        </div>
        <ErrorBox message={apiError} />
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Signing in..." : <>Sign In <ArrowRight className="h-4 w-4" /></>}</button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-sage"><span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" /></div>

      <div className="space-y-3">
        <a href={googleLoginUrl} className="btn-outline w-full"><GoogleMark /> Sign in with Google</a>
        <button type="button" onClick={guest} className="btn-outline w-full">Continue as Guest</button>
      </div>
      <p className="mt-5 text-center text-sm text-sage">New to FuelWise? <Link to="/signup" className="font-semibold text-forest underline">Create Account</Link></p>
    </div>
  );
}
