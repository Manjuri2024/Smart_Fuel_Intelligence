import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bell, Database, Eye, Palette, Save, Truck, User } from "lucide-react";
import { getSettings, saveSettings } from "../services/settingsService.js";
import { createVehicle, listVehicles, updateVehicle } from "../services/vehicleService.js";
import { getErrorMessage } from "../services/client.js";
import useFetch from "../services/useFetch.js";
import { checkOptional, checkPositive, EmptyState, ErrorBox, Field, Loading, PageHeader, toNum } from "../components/ui.jsx";
import { cap } from "../services/format.js";
import { useAuth } from "../components/AuthContext.jsx";

const TABS = [
  { id: "profile", label: "Profile", icon: User }, { id: "vehicle", label: "Vehicle info", icon: Truck },
  { id: "notifications", label: "Notifications", icon: Bell }, { id: "appearance", label: "Appearance", icon: Palette },
  { id: "privacy", label: "Privacy", icon: Eye }, { id: "data", label: "Data preferences", icon: Database },
];

function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-line p-3">
      <span><span className="block text-sm font-semibold">{label}</span>{hint && <span className="text-xs text-sage">{hint}</span>}</span>
      <input type="checkbox" role="switch" className="h-5 w-5 accent-[#545E56]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function VehicleSection() {
  const { data: vehicles, loading, error, reload } = useFetch(listVehicles, []);
  const blank = { name: "", vehicle_type: "petrol", efficiency: "", tank: "", battery: "", level: "" };
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState(null);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const edit = (v) => { setEditId(v.id); setForm({ name: v.name, vehicle_type: v.vehicle_type, efficiency: String(v.efficiency),
    tank: v.tank_capacity_litres ?? "", battery: v.battery_capacity_kwh ?? "", level: v.current_level_percent ?? "" }); };

  const submit = async (ev) => {
    ev.preventDefault();
    const e = { efficiency: checkPositive(form.efficiency, "Efficiency"), level: checkOptional(String(form.level), "Level", 0, 100) };
    if (!form.name.trim()) e.name = "Vehicle name is required.";
    Object.keys(e).forEach((k) => !e[k] && delete e[k]);
    setErrors(e);
    if (Object.keys(e).length) return;
    const body = { name: form.name.trim(), vehicle_type: form.vehicle_type, efficiency: toNum(form.efficiency),
      tank_capacity_litres: form.vehicle_type === "petrol" ? toNum(String(form.tank)) : undefined,
      battery_capacity_kwh: form.vehicle_type === "electric" ? toNum(String(form.battery)) : undefined,
      current_level_percent: toNum(String(form.level)) };
    try {
      editId ? await updateVehicle(editId, body) : await createVehicle(body);
      setForm(blank); setEditId(null); setApiError(""); reload();
    } catch (err) { setApiError(getErrorMessage(err)); }
  };

  return (
    <div className="space-y-5">
      <h2 className="font-bold">Your vehicles</h2>
      {loading && <Loading />}
      <ErrorBox message={error} onRetry={reload} />
      {vehicles?.length === 0 && <EmptyState title="No vehicles yet">Add a vehicle below to see its fuel or battery level on the dashboard.</EmptyState>}
      <ul className="space-y-2">
        {vehicles?.map((v) => (
          <li key={v.id} className="flex items-center justify-between rounded-xl border border-line p-3 text-sm">
            <span><b>{v.name}</b> · {cap(v.vehicle_type)} · {v.efficiency} {v.vehicle_type === "petrol" ? "km/L" : "km/kWh"}
              {v.remaining_range_km != null && ` · range ${v.remaining_range_km} km`}</span>
            <button className="font-semibold text-forest underline" onClick={() => edit(v)}>Edit</button>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="space-y-3 rounded-xl bg-surface p-4" noValidate>
        <h3 className="text-sm font-bold">{editId ? "Edit vehicle" : "Add a vehicle"}</h3>
        <Field label="Vehicle name" value={form.name} onChange={set("name")} error={errors.name} maxLength={100} />
        <div>
          <label htmlFor="v-type" className="label">Vehicle type</label>
          <select id="v-type" className="input" value={form.vehicle_type} onChange={set("vehicle_type")}><option value="petrol">Petrol</option><option value="electric">Electric</option></select>
        </div>
        <Field label="Efficiency" unit={form.vehicle_type === "petrol" ? "km/L" : "km/kWh"} type="number" step="any" value={form.efficiency} onChange={set("efficiency")} error={errors.efficiency} />
        {form.vehicle_type === "petrol"
          ? <Field label="Tank capacity (optional)" unit="L" type="number" step="any" value={form.tank} onChange={set("tank")} />
          : <Field label="Battery capacity (optional)" unit="kWh" type="number" step="any" value={form.battery} onChange={set("battery")} />}
        <Field label="Current fuel/battery level (optional)" unit="%" type="number" step="any" value={form.level} onChange={set("level")} error={errors.level} />
        <ErrorBox message={apiError} />
        <div className="flex gap-2">
          <button className="btn-primary">{editId ? "Save vehicle" : "Add vehicle"}</button>
          {editId && <button type="button" className="btn-outline" onClick={() => { setEditId(null); setForm(blank); }}>Cancel</button>}
        </div>
      </form>
    </div>
  );
}

export default function Settings() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "profile";
  const { refreshUser } = useAuth();
  const { data, loading, error, reload } = useFetch(getSettings, []);
  const [s, setS] = useState(null);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (data) setS(data); }, [data]);
  const up = (k, v) => { setS({ ...s, [k]: v }); setSaved(false); };

  const save = async () => {
    const e = {};
    if (!s.full_name.trim()) e.full_name = "Name is required.";
    if (!EMAIL.test(s.email)) e.email = "Enter a valid email address.";
    if (s.phone && !/^[0-9+()\-\s]{7,20}$/.test(s.phone)) e.phone = "Enter a valid phone number.";
    for (const [k, n] of [["default_petrol_price", "Petrol price"], ["default_electricity_tariff", "Electricity tariff"], ["default_petrol_mileage", "Petrol mileage"], ["default_ev_efficiency", "EV efficiency"]]) {
      const m = checkPositive(s[k], n); if (m) e[k] = m;
    }
    const loss = checkOptional(String(s.charging_loss_percent), "Charging loss", 0, 59);
    if (loss) e.charging_loss_percent = loss;
    setErrors(e);
    if (Object.keys(e).length) { setApiError("Please fix the highlighted fields."); return; }
    setBusy(true); setApiError("");
    try {
      const body = { ...s, city: s.city || null, phone: s.phone || null };
      ["default_petrol_price", "default_electricity_tariff", "default_petrol_mileage", "default_ev_efficiency", "charging_loss_percent"].forEach((k) => (body[k] = Number(body[k])));
      setS(await saveSettings(body)); setSaved(true); refreshUser();
    } catch (err) { setApiError(getErrorMessage(err)); } finally { setBusy(false); }
  };

  if (loading && !s) return <Loading text="Loading settings..." />;
  if (error) return <><PageHeader title="Settings" /><ErrorBox message={error} onRetry={reload} /></>;
  if (!s) return null;

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your profile, vehicles and preferences." />
      <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Settings sections" className="card flex gap-1 overflow-x-auto p-2 lg:flex-col">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setParams({ tab: id })} aria-current={tab === id ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${tab === id ? "bg-deep text-white" : "text-charcoal hover:bg-tint"}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </nav>

        <section className="card space-y-4 p-5">
          {tab === "profile" && (<>
            <h2 className="font-bold">Profile information</h2>
            <Field label="Full name" value={s.full_name} onChange={(e) => up("full_name", e.target.value)} error={errors.full_name} maxLength={100} />
            <Field label="Email" type="email" value={s.email} onChange={(e) => up("email", e.target.value)} error={errors.email} />
            <Field label="Phone number (optional)" type="tel" value={s.phone || ""} onChange={(e) => up("phone", e.target.value)} error={errors.phone} />
            <Field label="City (optional)" value={s.city || ""} onChange={(e) => up("city", e.target.value)} maxLength={100} />
          </>)}
          {tab === "vehicle" && <VehicleSection />}
          {tab === "notifications" && (<>
            <h2 className="font-bold">Notifications</h2>
            <Toggle label="Enable notifications" checked={s.notifications_enabled} onChange={(v) => up("notifications_enabled", v)} />
            <Toggle label="Email alerts" checked={s.email_alerts} onChange={(v) => up("email_alerts", v)} />
            <Toggle label="Price alerts" checked={s.price_alerts} onChange={(v) => up("price_alerts", v)} />
            <p className="text-xs text-sage">These preferences are saved now; sending notifications is not implemented yet.</p>
          </>)}
          {tab === "appearance" && (<>
            <h2 className="font-bold">Appearance</h2>
            <fieldset className="flex gap-3">
              <legend className="label">Theme</legend>
              {[["light", "Light"], ["dark", "Dark"], ["system", "System"]].map(([v, l]) => (
                <label key={v} className={`flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm ${v !== "light" ? "opacity-50" : ""}`}>
                  <input type="radio" name="theme" value={v} checked={s.theme === v} disabled={v !== "light"} onChange={() => up("theme", v)} /> {l}
                </label>
              ))}
            </fieldset>
            <p className="text-xs text-sage">Only the light theme is available in this version.</p>
          </>)}
          {tab === "privacy" && (<>
            <h2 className="font-bold">Privacy</h2>
            <Toggle label="Save AI chat history" hint="Stores your questions and answers in your local database." checked={s.store_chat_history} onChange={(v) => up("store_chat_history", v)} />
            <Toggle label="Share anonymous usage analytics" hint="Preference only; no analytics are collected by this app." checked={s.share_analytics} onChange={(v) => up("share_analytics", v)} />
          </>)}
          {tab === "data" && (<>
            <h2 className="font-bold">Data preferences</h2>
            <p className="text-sm text-sage">These defaults pre-fill the calculator and comparison, and drive savings on the dashboard.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Petrol price" unit="₹/L" type="number" step="any" value={s.default_petrol_price} onChange={(e) => up("default_petrol_price", e.target.value)} error={errors.default_petrol_price} />
              <Field label="Electricity tariff" unit="₹/kWh" type="number" step="any" value={s.default_electricity_tariff} onChange={(e) => up("default_electricity_tariff", e.target.value)} error={errors.default_electricity_tariff} />
              <Field label="Petrol mileage" unit="km/L" type="number" step="any" value={s.default_petrol_mileage} onChange={(e) => up("default_petrol_mileage", e.target.value)} error={errors.default_petrol_mileage} />
              <Field label="EV efficiency" unit="km/kWh" type="number" step="any" value={s.default_ev_efficiency} onChange={(e) => up("default_ev_efficiency", e.target.value)} error={errors.default_ev_efficiency} />
              <Field label="Charging loss" unit="%" type="number" step="any" value={s.charging_loss_percent} onChange={(e) => up("charging_loss_percent", e.target.value)} error={errors.charging_loss_percent} />
            </div>
          </>)}

          {tab !== "vehicle" && (
            <div className="space-y-3 border-t border-line pt-4">
              <ErrorBox message={apiError} />
              {saved && <p role="status" className="text-sm font-semibold text-deep">Settings saved.</p>}
              <button className="btn-primary" onClick={save} disabled={busy}><Save className="h-4 w-4" /> {busy ? "Saving..." : "Save changes"}</button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
