import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { calculateElectric, calculatePetrol } from "../services/calculatorService.js";
import { getErrorMessage } from "../services/client.js";
import { getSettings } from "../services/settingsService.js";
import { useAuth } from "../components/AuthContext.jsx";
import { checkOptional, checkPositive, ErrorBox, Field, PageHeader, toNum } from "../components/ui.jsx";
import { inr, num } from "../services/format.js";

const EMPTY = { mileage: "", price: "", distance: "", fuelLevel: "", tank: "", efficiency: "", tariff: "", loss: "10", battery: "", capacity: "" };

export default function Calculator() {
  const [type, setType] = useState("petrol");
  const [f, setF] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);
  const [apiError, setApiError] = useState("");
  const [busy, setBusy] = useState(false);
  const { isUser } = useAuth();

  // Pre-fill with the user's saved defaults (if the backend is reachable).
  useEffect(() => {
    if (!isUser) return; // guests use the built-in example values
    getSettings().then((s) => setF((old) => ({
      ...old,
      mileage: old.mileage || String(s.default_petrol_mileage),
      price: old.price || String(s.default_petrol_price),
      efficiency: old.efficiency || String(s.default_ev_efficiency),
      tariff: old.tariff || String(s.default_electricity_tariff),
      loss: String(s.charging_loss_percent),
    }))).catch(() => {});
  }, [isUser]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const switchType = (t) => { setType(t); setResult(null); setErrors({}); setApiError(""); };

  const validate = () => {
    const e = type === "petrol" ? {
      mileage: checkPositive(f.mileage, "Mileage"), price: checkPositive(f.price, "Petrol price"),
      distance: checkPositive(f.distance, "Trip distance"),
      fuelLevel: checkOptional(f.fuelLevel, "Fuel level", 0, 100), tank: f.tank ? checkPositive(f.tank, "Tank capacity") : "",
    } : {
      efficiency: checkPositive(f.efficiency, "EV efficiency"), tariff: checkPositive(f.tariff, "Electricity tariff"),
      distance: checkPositive(f.distance, "Trip distance"), loss: checkOptional(f.loss, "Charging loss", 0, 59),
      battery: checkOptional(f.battery, "Battery", 0, 100), capacity: f.capacity ? checkPositive(f.capacity, "Battery capacity") : "",
    };
    Object.keys(e).forEach((k) => !e[k] && delete e[k]);
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setApiError("");
    if (!validate()) return;
    setBusy(true);
    try {
      setResult(type === "petrol"
        ? await calculatePetrol({ distance_km: toNum(f.distance), mileage_kmpl: toNum(f.mileage), price_per_litre: toNum(f.price),
            fuel_level_percent: toNum(f.fuelLevel), tank_capacity_litres: toNum(f.tank) })
        : await calculateElectric({ distance_km: toNum(f.distance), efficiency_km_per_kwh: toNum(f.efficiency), tariff_per_kwh: toNum(f.tariff),
            charging_loss_percent: toNum(f.loss) ?? 10, battery_percent: toNum(f.battery), battery_capacity_kwh: toNum(f.capacity) }));
    } catch (err) {
      setResult(null);
      setApiError(getErrorMessage(err));
    } finally { setBusy(false); }
  };

  const unit = result?.energy_unit;
  return (
    <div>
      <PageHeader title="Fuel Calculator" subtitle="Calculations are done by the FuelWise backend." />
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={submit} className="card space-y-4 p-5" noValidate>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-tint p-1" role="tablist" aria-label="Vehicle type">
            {["petrol", "electric"].map((t) => (
              <button key={t} type="button" role="tab" aria-selected={type === t} onClick={() => switchType(t)}
                className={`rounded-lg py-2 text-sm font-semibold capitalize ${type === t ? "bg-forest text-white" : "text-charcoal"}`}>{t}</button>
            ))}
          </div>

          {type === "petrol" ? (
            <>
              <Field label="Vehicle mileage" unit="km/L" type="number" step="any" value={f.mileage} onChange={set("mileage")} error={errors.mileage} />
              <Field label="Petrol price" unit="₹/L" type="number" step="any" value={f.price} onChange={set("price")} error={errors.price} />
              <Field label="Trip distance" unit="km" type="number" step="any" value={f.distance} onChange={set("distance")} error={errors.distance} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Current fuel level (optional)" unit="%" type="number" step="any" value={f.fuelLevel} onChange={set("fuelLevel")} error={errors.fuelLevel} />
                <Field label="Fuel tank capacity (optional)" unit="L" type="number" step="any" value={f.tank} onChange={set("tank")} error={errors.tank} />
              </div>
            </>
          ) : (
            <>
              <Field label="EV efficiency" unit="km/kWh" type="number" step="any" value={f.efficiency} onChange={set("efficiency")} error={errors.efficiency} />
              <Field label="Electricity tariff" unit="₹/kWh" type="number" step="any" value={f.tariff} onChange={set("tariff")} error={errors.tariff} />
              <Field label="Trip distance" unit="km" type="number" step="any" value={f.distance} onChange={set("distance")} error={errors.distance} />
              <Field label="Charging loss" unit="%" type="number" step="any" value={f.loss} onChange={set("loss")} error={errors.loss}
                hint="Energy lost between the wall socket and the battery." />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Battery percentage" unit="%" type="number" step="any" value={f.battery} onChange={set("battery")} error={errors.battery} />
                <Field label="Battery capacity (optional)" unit="kWh" type="number" step="any" value={f.capacity} onChange={set("capacity")} error={errors.capacity} />
              </div>
            </>
          )}
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Calculating..." : <>Calculate <ArrowRight className="h-4 w-4" /></>}</button>
          <ErrorBox message={apiError} />
        </form>

        <section className="card p-5" aria-live="polite">
          <h2 className="mb-4 text-lg font-bold">Results</h2>
          {!result ? (
            <p className="rounded-xl bg-surface p-6 text-center text-sm text-sage">Enter your trip details and press Calculate.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl bg-tint p-3"><p className="text-xs text-sage">{type === "petrol" ? "Fuel required" : "Electricity drawn"}</p><p className="text-2xl font-extrabold text-ink">{num(result.energy_required, 2)} {unit}</p></div>
                <div className="rounded-xl bg-tint p-3"><p className="text-xs text-sage">Trip cost</p><p className="text-2xl font-extrabold text-ink">{inr(result.trip_cost)}</p></div>
                <div className="rounded-xl bg-tint p-3"><p className="text-xs text-sage">Cost per km</p><p className="text-xl font-bold">{inr(result.cost_per_km)}</p></div>
                <div className="rounded-xl bg-tint p-3"><p className="text-xs text-sage">Remaining range</p>
                  <p className="text-xl font-bold">{result.remaining_range_km != null ? `${num(result.remaining_range_km)} km` : "Not enough info"}</p></div>
              </div>
              {result.sufficient != null ? (
                <p className={`flex items-center gap-2 rounded-xl p-3 text-sm font-semibold ${result.sufficient ? "bg-tint text-deep" : "bg-beige/30 text-ink"}`}>
                  {result.sufficient ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                  {result.sufficient ? "You have enough for this trip."
                    : `Not enough for this trip. You need about ${num(result.shortfall, 2)} ${unit === "L" ? "L" : "kWh"} more.`}
                </p>
              ) : <p className="rounded-xl bg-surface p-3 text-sm text-sage">{result.range_note}</p>}
              <div>
                <h3 className="mb-2 text-sm font-bold">Calculation breakdown</h3>
                <ul className="space-y-1.5 text-sm">
                  {result.breakdown.map((b) => (
                    <li key={b.label} className="rounded-lg border border-line px-3 py-2"><span className="font-semibold">{b.label}:</span> {b.formula}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
