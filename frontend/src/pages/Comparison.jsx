import { useEffect, useState } from "react";
import { ArrowRight, Trophy } from "lucide-react";
import { compareVehicles } from "../services/calculatorService.js";
import { getErrorMessage } from "../services/client.js";
import { getSettings } from "../services/settingsService.js";
import { useAuth } from "../components/AuthContext.jsx";
import { checkOptional, checkPositive, ErrorBox, Field, PageHeader, toNum } from "../components/ui.jsx";
import { ScooterIllustration } from "../components/Illustrations.jsx";
import CostComparisonChart from "../charts/CostComparisonChart.jsx";
import { inr, num } from "../services/format.js";

const EMPTY = { distance: "100", efficiency: "", tariff: "", loss: "10", mileage: "", price: "" };

function VehicleCard({ variant, title, specs, stats }) {
  return (
    <div className={`card p-5 ${variant === "electric" ? "bg-tint" : "bg-[#F4F2EA]"}`}>
      <ScooterIllustration variant={variant} className="mx-auto h-32 w-full max-w-[220px]" />
      <h3 className="mt-2 text-center text-lg font-bold">{title}</h3>
      <p className="text-center text-sm text-sage">{specs}</p>
      <dl className="mt-4 space-y-2 text-sm">
        {stats.map(([k, v]) => (
          <div key={k} className="flex justify-between border-t border-line pt-2"><dt className="text-sage">{k}</dt><dd className="font-bold">{v}</dd></div>
        ))}
      </dl>
    </div>
  );
}

export default function Comparison() {
  const [f, setF] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);
  const [apiError, setApiError] = useState("");
  const [busy, setBusy] = useState(false);
  const { isUser } = useAuth();

  useEffect(() => {
    if (!isUser) return; // guests use the built-in example values
    getSettings().then((s) => setF((o) => ({ ...o, efficiency: String(s.default_ev_efficiency), tariff: String(s.default_electricity_tariff),
      mileage: String(s.default_petrol_mileage), price: String(s.default_petrol_price), loss: String(s.charging_loss_percent) }))).catch(() => {});
  }, [isUser]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (ev) => {
    ev.preventDefault();
    setApiError("");
    const e = {
      distance: checkPositive(f.distance, "Journey distance"), efficiency: checkPositive(f.efficiency, "EV efficiency"),
      tariff: checkPositive(f.tariff, "Electricity tariff"), mileage: checkPositive(f.mileage, "Petrol mileage"),
      price: checkPositive(f.price, "Petrol price"), loss: checkOptional(f.loss, "Charging loss", 0, 59),
    };
    Object.keys(e).forEach((k) => !e[k] && delete e[k]);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      setResult(await compareVehicles({ distance_km: toNum(f.distance), ev_efficiency_km_per_kwh: toNum(f.efficiency), tariff_per_kwh: toNum(f.tariff),
        petrol_mileage_kmpl: toNum(f.mileage), petrol_price_per_litre: toNum(f.price), charging_loss_percent: toNum(f.loss) ?? 10 }));
    } catch (err) { setResult(null); setApiError(getErrorMessage(err)); } finally { setBusy(false); }
  };

  const ev = result?.electric, pt = result?.petrol;
  const dash = "-";
  return (
    <div>
      <PageHeader title="EV vs Petrol Comparison" subtitle="Costs are compared in rupees, never km/kWh against km/L." />
      <div className="grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <VehicleCard variant="electric" title="Electric Scooter" specs={`Efficiency: ${f.efficiency || dash} km/kWh · Tariff: ₹${f.tariff || dash}/kWh`}
          stats={[["Energy consumption", ev ? `${num(ev.energy_required, 2)} kWh` : dash], ["Running cost per km", ev ? inr(ev.cost_per_km) : dash], ["Total running cost", ev ? inr(ev.trip_cost) : dash]]} />
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-deep font-bold text-white">VS</span>
        <VehicleCard variant="petrol" title="Petrol Scooter" specs={`Mileage: ${f.mileage || dash} km/L · Price: ₹${f.price || dash}/L`}
          stats={[["Fuel consumption", pt ? `${num(pt.energy_required, 2)} L` : dash], ["Running cost per km", pt ? inr(pt.cost_per_km) : dash], ["Total running cost", pt ? inr(pt.trip_cost) : dash]]} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <form onSubmit={submit} className="card space-y-4 p-5" noValidate>
          <h2 className="font-bold">Journey and vehicle details</h2>
          <Field label="Journey distance" unit="km" type="number" step="any" value={f.distance} onChange={set("distance")} error={errors.distance} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="EV efficiency" unit="km/kWh" type="number" step="any" value={f.efficiency} onChange={set("efficiency")} error={errors.efficiency} />
            <Field label="Electricity tariff" unit="₹/kWh" type="number" step="any" value={f.tariff} onChange={set("tariff")} error={errors.tariff} />
            <Field label="Petrol mileage" unit="km/L" type="number" step="any" value={f.mileage} onChange={set("mileage")} error={errors.mileage} />
            <Field label="Petrol price" unit="₹/L" type="number" step="any" value={f.price} onChange={set("price")} error={errors.price} />
          </div>
          <Field label="Charging loss" unit="%" type="number" step="any" value={f.loss} onChange={set("loss")} error={errors.loss} hint="Added to the EV electricity bill." />
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Comparing..." : <>Compare <ArrowRight className="h-4 w-4" /></>}</button>
          <ErrorBox message={apiError} />
        </form>

        <section className="card p-5" aria-live="polite">
          <h2 className="mb-3 font-bold">Results</h2>
          {!result ? <p className="rounded-xl bg-surface p-6 text-center text-sm text-sage">Fill in the details and press Compare.</p> : (
            <div className="space-y-4">
              <p className="flex items-center gap-3 rounded-xl bg-tint p-4 font-bold text-ink">
                <Trophy className="h-6 w-6 text-deep" />
                {result.cheaper_option === "equal" ? "Both cost the same for this journey."
                  : `${result.cheaper_option === "electric" ? "Electric" : "Petrol"} is ${num(result.savings_percent, 1)}% cheaper - you save ${inr(result.cost_difference)}.`}
              </p>
              <CostComparisonChart data={[{ name: "Electric", cost: ev.trip_cost, kind: "electric" }, { name: "Petrol", cost: pt.trip_cost, kind: "petrol" }]} />
              <table className="w-full text-sm">
                <tbody className="divide-y divide-line">
                  <tr><td className="py-2 text-sage">EV energy required (from supply)</td><td className="text-right font-semibold">{num(ev.energy_required, 2)} kWh</td></tr>
                  <tr><td className="py-2 text-sage">Petrol required</td><td className="text-right font-semibold">{num(pt.energy_required, 2)} L</td></tr>
                  <tr><td className="py-2 text-sage">EV running cost</td><td className="text-right font-semibold">{inr(ev.trip_cost)}</td></tr>
                  <tr><td className="py-2 text-sage">Petrol running cost</td><td className="text-right font-semibold">{inr(pt.trip_cost)}</td></tr>
                  <tr><td className="py-2 text-sage">Cost difference</td><td className="text-right font-semibold">{inr(result.cost_difference)}</td></tr>
                  <tr><td className="py-2 text-sage">Percentage savings</td><td className="text-right font-semibold">{num(result.savings_percent, 1)}%</td></tr>
                </tbody>
              </table>
              <p className="text-xs text-sage">Includes {result.charging_loss_percent}% charging loss. Your own vehicles and prices will differ - these are the numbers you entered.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
