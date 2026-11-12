import { useState } from "react";
import { Link } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { ErrorBox, Field } from "../components/ui.jsx";
import { forgotPassword } from "../services/authService.js";
import { getErrorMessage } from "../services/client.js";
import { EMAIL_RE } from "./Login.jsx";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [apiError, setApiError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setApiError("");
    if (!email.trim()) return setError("Email is required.");
    if (!EMAIL_RE.test(email.trim())) return setError("Enter a valid email address.");
    setError("");
    setBusy(true);
    try {
      setMessage((await forgotPassword(email.trim())).message);
    } catch (err) {
      setApiError(getErrorMessage(err));
    } finally { setBusy(false); }
  };

  return (
    <div>
      <h1 className="text-2xl font-extrabold">Forgot your password?</h1>
      <p className="mt-1 text-sm text-sage">Enter your email and we will send you a link to choose a new one.</p>
      {message ? (
        <div className="mt-5 rounded-xl bg-tint p-4 text-sm" role="status">
          <MailCheck className="mb-2 h-6 w-6 text-forest" /> {message}
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="mt-5 space-y-4">
          <Field label="Email address" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
          <ErrorBox message={apiError} />
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Sending..." : "Send Reset Link"}</button>
        </form>
      )}
      <p className="mt-5 text-center text-sm"><Link to="/login" className="font-semibold text-forest underline">Back to Login</Link></p>
    </div>
  );
}
