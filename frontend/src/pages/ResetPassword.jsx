import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import PasswordField from "../components/PasswordField.jsx";
import { ErrorBox } from "../components/ui.jsx";
import { resetPassword } from "../services/authService.js";
import { getErrorMessage } from "../services/client.js";
import { passwordProblem } from "./Signup.jsx";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setApiError("");
    const v = {};
    const problem = passwordProblem(pw);
    if (problem) v.pw = problem;
    if (confirm !== pw) v.confirm = "Passwords do not match.";
    setErrors(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      setMessage((await resetPassword(token, pw)).message);
    } catch (err) {
      setApiError(getErrorMessage(err));
    } finally { setBusy(false); }
  };

  if (!token) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold">Reset link missing</h1>
        <p className="mt-2 text-sm text-sage">Open the link from your email, or request a new one.</p>
        <Link to="/forgot-password" className="btn-primary mt-5 w-full">Request a reset link</Link>
      </div>
    );
  }
  if (message) {
    return (
      <div className="py-4 text-center" role="status">
        <CheckCircle2 className="mx-auto h-10 w-10 text-forest" />
        <p className="mt-3 text-sm">{message}</p>
        <Link to="/login" className="btn-primary mt-5 w-full">Go to Sign In</Link>
      </div>
    );
  }
  return (
    <div>
      <h1 className="text-2xl font-extrabold">Choose a new password</h1>
      <form onSubmit={submit} noValidate className="mt-5 space-y-4">
        <PasswordField label="New password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} error={errors.pw} hint="At least 8 characters with a letter and a number." />
        <PasswordField label="Confirm new password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} />
        <ErrorBox message={apiError} />
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Saving..." : "Update password"}</button>
      </form>
      <p className="mt-5 text-center text-sm"><Link to="/login" className="font-semibold text-forest underline">Back to Login</Link></p>
    </div>
  );
}
