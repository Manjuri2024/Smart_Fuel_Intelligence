import { useState } from "react";
import { Link } from "react-router-dom";
import { Calculator, CloudOff, Fuel, History, IndianRupee, MapPin, PiggyBank, Plus, Scale } from "lucide-react";
import { getDashboard, getDemoDashboard } from "../services/dashboardService.js";
import { useAuth } from "../components/AuthContext.jsx";
import useFetch from "../services/useFetch.js";
import { cap, inr, num, prettyDate } from "../services/format.js";
import { EmptyState, ErrorBox, Loading, PageHeader, StatCard } from "../components/ui.jsx";
import CostTrendChart from "../charts/CostTrendChart.jsx";
import CostComparisonChart from "../charts/CostComparisonChart.jsx";
import MonthlyExpenseChart from "../charts/MonthlyExpenseChart.jsx";
import FuelGauge from "../charts/FuelGauge.jsx";

export default function Dashboard() {
  const { isUser } = useAuth();
  const [days, setDays] = useState(7);
  const { data, loading, error, reload } = useFetch(() => (isUser ? getDashboard(days) : getDemoDashboard(days)), [days, isUser]);

  if (loading && !data) return <Loading text="Loading dashboard..." />;
  if (error) return <><PageHeader title="Dashboard" /><ErrorBox message={error} onRetry={reload} /></>;

  const s = data.summary;
  const status = data.vehicle_status;
  const perKm = data.by_vehicle_type
    .filter((t) => t.cost_per_km !== null)
    .map((t) => ({ name: cap(t.vehicle_type), cost: t.cost_per_km, kind: t.vehicle_type }));

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={isUser ? "Everything below is calculated from the trips stored in your database." : "Guest preview with demo data."}>
        <select aria-label="Time range" value={days} onChange={(e) => setDays(Number(e.target.value))} className="input w-auto">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      </PageHeader>

      {data.is_demo && (
        <p role="note" className="mb-4 rounded-xl border border-beige bg-beige/20 p-3 text-sm">
          <b>Demo data.</b> {data.demo_notice} <Link to="/signup" className="font-semibold text-forest underline">Create a free account</Link>
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Fuel} label="Total Trips" value={s.total_trips} hint={`${num(s.total_distance_km)} km travelled`} />
        <StatCard icon={IndianRupee} label="Total Cost" value={inr(s.total_cost)} />
        <StatCard icon={PiggyBank} label="Fuel Saved" value={`${num(s.petrol_litres_avoided, 2)} L`} hint={`${inr(s.money_saved)} saved vs petrol`} />
        <StatCard icon={CloudOff} label="CO₂ Reduced" value={`${num(s.co2_reduced_kg, 1)} kg`} hint="Estimate - see assumptions below" />
      </div>

      {!data.has_data && isUser && (
        <div className="mt-6">
          <EmptyState title="No trips yet"
            action={<Link to="/history?new=1" className="btn-primary mt-2"><Plus className="h-4 w-4" /> Log your first trip</Link>}>
            Log a trip to fill these charts. For a quick preview, run <code>python -m backend.database.seed_demo --email you@example.com</code> to add labelled demo data.
          </EmptyState>
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="card p-5 xl:col-span-2">
          <h2 className="mb-3 font-bold">Fuel cost trend</h2>
          <CostTrendChart data={data.cost_trend} />
        </section>
        <section className="card p-5">
          <h2 className="mb-1 font-bold">Vehicle status</h2>
          {status.has_vehicle ? (
            <>
              <p className="text-sm text-sage">{status.name}</p>
              <FuelGauge percent={status.level_percent} label={status.vehicle_type === "electric" ? "Battery" : "Fuel"} />
              <p className="text-center text-sm">
                {status.remaining_range_km != null ? <>Estimated range <b>{num(status.remaining_range_km)} km</b></>
                  : "Add the tank or battery capacity in Settings to see range."}
              </p>
            </>
          ) : (
            <EmptyState title="No vehicle added" action={<Link to="/settings?tab=vehicle" className="btn-outline mt-2">Add a vehicle</Link>}>
              Add your vehicle to see its fuel or battery level.
            </EmptyState>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-1 font-bold">Petrol vs electric: cost per km</h2>
          <p className="mb-3 text-xs text-sage">From your logged trips.</p>
          {perKm.length ? <CostComparisonChart data={perKm} /> : <p className="py-10 text-center text-sm text-sage">No trips to compare yet.</p>}
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-bold">Monthly expense overview</h2>
          {data.monthly_expenses.length ? <MonthlyExpenseChart data={data.monthly_expenses} /> : <p className="py-10 text-center text-sm text-sage">No monthly data yet.</p>}
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Recent trips</h2>
            <Link to="/history" className="text-sm font-semibold text-forest underline">View all</Link>
          </div>
          {data.recent_trips.length ? (
            <ul className="divide-y divide-line text-sm">
              {data.recent_trips.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2.5">
                  <span>{prettyDate(t.trip_date)} · {cap(t.vehicle_type)} · {num(t.distance_km)} km</span>
                  <b>{inr(t.cost)}</b>
                </li>
              ))}
            </ul>
          ) : <p className="py-6 text-center text-sm text-sage">No trips logged yet.</p>}
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-bold">Quick actions</h2>
          <div className="grid gap-2">
            <Link to="/history?new=1" className="btn-primary"><Plus className="h-4 w-4" /> Log a trip</Link>
            <Link to="/calculator" className="btn-outline"><Calculator className="h-4 w-4" /> Fuel calculator</Link>
            <Link to="/comparison" className="btn-outline"><Scale className="h-4 w-4" /> Compare EV and petrol</Link>
            <Link to="/maps" className="btn-outline"><MapPin className="h-4 w-4" /> Find charging</Link>
            <Link to="/history" className="btn-outline"><History className="h-4 w-4" /> Trip history</Link>
          </div>
        </section>
      </div>

      <p className="mt-4 text-xs text-sage">
        Assumptions: electric trips are compared with petrol at {data.assumptions.comparison_petrol_mileage_kmpl} km/L and {inr(data.assumptions.comparison_petrol_price)}/L
        (editable in Settings). CO₂ uses {data.assumptions.petrol_co2_kg_per_litre} kg per litre of petrol and {data.assumptions.grid_co2_kg_per_kwh} kg per kWh of grid electricity.
      </p>
    </div>
  );
}
