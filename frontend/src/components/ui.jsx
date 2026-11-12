import { AlertTriangle, Loader2 } from "lucide-react";

export function Loading({ text = "Loading..." }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-sage" role="status">
      <Loader2 className="h-4 w-4 animate-spin" /> {text}
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-beige bg-beige/20 p-3 text-sm text-ink">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-deep" />
      <div className="flex-1">{message}</div>
      {onRetry && (
        <button onClick={onRetry} className="font-semibold text-forest underline">Try again</button>
      )}
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-surface px-6 py-10 text-center">
      <p className="font-semibold text-ink">{title}</p>
      <p className="max-w-md text-sm text-sage">{children}</p>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-sage">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="card flex items-center gap-4 p-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-tint text-deep">
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-sage">{label}</p>
        <p className="truncate text-xl font-extrabold text-ink">{value}</p>
        {hint && <p className="text-xs text-sage">{hint}</p>}
      </div>
    </div>
  );
}

export function Field({ label, unit, error, hint, id, ...props }) {
  const fieldId = id || `f-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div>
      <label htmlFor={fieldId} className="label">{label}</label>
      <div className="relative">
        <input id={fieldId} className={`input ${unit ? "pr-14" : ""} ${error ? "border-deep ring-2 ring-beige" : ""}`} {...props} />
        {unit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-sage">{unit}</span>}
      </div>
      {hint && !error && <p className="mt-1 text-xs text-sage">{hint}</p>}
      {error && <p className="mt-1 text-xs font-medium text-deep">{error}</p>}
    </div>
  );
}

/** Returns an error message for a required positive number, or "" when valid. */
export function checkPositive(value, name) {
  if (value === "" || value === null || value === undefined) return `${name} is required.`;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return `${name} must be greater than 0.`;
  return "";
}

/** Optional number: "" is fine, otherwise it must be within [min, max]. */
export function checkOptional(value, name, min = 0, max = Infinity) {
  if (value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return `${name} must be between ${min} and ${max === Infinity ? "any value" : max}.`;
  return "";
}

/** Convert "" to undefined and strings to numbers, for API payloads. */
export const toNum = (v) => (v === "" || v === null || v === undefined ? undefined : Number(v));
