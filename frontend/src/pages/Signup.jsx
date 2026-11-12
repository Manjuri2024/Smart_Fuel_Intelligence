import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "../components/AuthContext.jsx";
import PasswordField, { GoogleMark } from "../components/PasswordField.jsx";
import { ErrorBox, Field } from "../components/ui.jsx";
import { getErrorMessage } from "../services/client.js";
import { googleLoginUrl } from "../services/authService.js";
import { EMAIL_RE } from "./Login.jsx";

const PHONE_RE = /^[0-9+()\-\s]{7,20}$/;

export function passwordProblem(pw) {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Password must contain at least one letter and one number.";
  return "";
}

export default function Signup() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const timer = useRef(null);
  const [f, setF] = useState({ name: "", email: "", password: "", confirm: "", phone: "", terms: false });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  useEffect(() => () => clearTimeout(timer.current), []);

  const submit = async (e) => {
    e.preventDefault();
    setApiError("");
    const v = {};
    if (!f.name.trim()) v.name = "Full name is required.";
    if (!f.email.trim()) v.email = "Email is required.";
    else if (!EMAIL_RE.test(f.email.trim())) v.email = "Enter a valid email address.";
    const pw = passwordProblem(f.password);
    if (pw) v.password = pw;
    if (!f.confirm) v.confirm = "Please confirm your password.";
    else if (f.confirm !== f.password) v.confirm = "Passwords do not match.";
    if (f.phone.trim() && !PHONE_RE.test(f.phone.trim())) v.phone = "Enter a valid phone number (digits, +, spaces, brackets or dashes).";
    if (!f.terms) v.terms = "You must accept the Terms and Privacy Policy.";
    setErrors(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      await signUp({ name: f.name.trim(), email: f.email.trim(), password: f.password, confirm_password: f.confirm,
        phone: f.phone.trim() || undefined, accept_terms: true });
      setDone(true);
      timer.current = setTimeout(() => navigate("/settings?tab=vehicle", { replace: true }), 1200);
    } catch (err) {
      setApiError(getErrorMessage(err));
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="py-6 text-center" role="status">
        <CheckCircle2 className="mx-auto h-10 w-10 text-forest" />
        <h1 className="mt-3 text-xl font-extrabold">Account created!</h1>
        <p className="mt-1 text-sm text-sage">Taking you to vehicle setup...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold">Create your account</h1>
      <p className="mt-1 text-sm text-sage">Save trips, add vehicles and get personal recommendations.</p>
      <form onSubmit={submit} noValidate className="mt-5 space-y-4">
        <Field label="Full name" autoComplete="name" value={f.name} onChange={set("name")} error={errors.name} maxLength={100} />
        <Field label="Email address" type="email" autoComplete="email" value={f.email} onChange={set("email")} error={errors.email} />
        <PasswordField label="Password" autoComplete="new-password" value={f.password} onChange={set("password")} error={errors.password}
          hint="At least 8 characters with a letter and a number." />
        <PasswordField label="Confirm password" autoComplete="new-password" value={f.confirm} onChange={set("confirm")} error={errors.confirm} />
        <Field label="Phone number (optional)" type="tel" autoComplete="tel" value={f.phone} onChange={set("phone")} error={errors.phone} />
        <div>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#545E56]" checked={f.terms} onChange={set("terms")} />
            <span>I accept the Terms of Use and Privacy Policy.</span>
          </label>
          <details className="mt-1 text-xs text-sage">
            <summary className="cursor-pointer font-semibold text-forest">Read the summary</summary>
            <p className="mt-1">FuelWise stores your account details, vehicles and trips in its database to show your statistics. Passwords are stored only as secure hashes. Your data is not sold. (Template text: replace it with your own policy before public use.)</p>
          </details>
          {errors.terms && <p className="mt-1 text-xs font-medium text-deep">{errors.terms}</p>}
        </div>
        <ErrorBox message={apiError} />
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Creating account..." : "Create Account"}</button>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs text-sage"><span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" /></div>
      <a href={googleLoginUrl} className="btn-outline w-full"><GoogleMark /> Continue with Google</a>
      <p className="mt-5 text-center text-sm text-sage">Already have an account? <Link to="/login" className="font-semibold text-forest underline">Sign In</Link></p>
    </div>
  );
}
