import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/** Password input with a Show/Hide button. */
export default function PasswordField({ label, error, hint, id, autoComplete, ...props }) {
  const [visible, setVisible] = useState(false);
  const fieldId = id || `f-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div>
      <label htmlFor={fieldId} className="label">{label}</label>
      <div className="relative">
        <input id={fieldId} type={visible ? "text" : "password"} autoComplete={autoComplete}
          className={`input pr-11 ${error ? "border-deep ring-2 ring-beige" : ""}`} {...props} />
        <button type="button" onClick={() => setVisible((v) => !v)} aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-sage hover:bg-tint">
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint && !error && <p className="mt-1 text-xs text-sage">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-deep">{error}</p>}
    </div>
  );
}

export const GoogleMark = () => (
  <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full border border-line bg-white text-xs font-extrabold text-forest">G</span>
);
