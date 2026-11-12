import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { createTrip, getTrip, listTrips } from "../services/tripService.js";
import { getErrorMessage } from "../services/client.js";
import useFetch from "../services/useFetch.js";
import { cap, inr, num, prettyDate } from "../services/format.js";
import { checkPositive, EmptyState, ErrorBox, Field, Loading, PageHeader, StatCard, toNum } from "../components/ui.jsx";
import { Fuel, IndianRupee, Route, Gauge } from "lucide-react";

const PAGE_SIZE = 8;

function Modal({ title, onClose, children }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="card max-h-[90vh] w-full max-w-md overflow-y-auto p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 hover:bg-tint"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function TripDetail({ id, onClose }) {
  const { data: t, loading, error } = useFetch(() => getTrip(id), [id]);
  return (
    <Modal title="Trip details" onClose={onClose}>
      {loading && <Loading />}
      <ErrorBox message={error} />
      {t && (
        <dl className="space-y-2 text-sm">
          {[["Date", prettyDate(t.trip_date)], ["Vehicle type", cap(t.vehicle_type)], ["Vehicle", t.vehicle_name || "Not linked"],
            ["Distance", `${num(t.distance_km)} km`], [t.vehicle_type === "electric" ? "Electricity drawn" : "Fuel used", `${num(t.energy_used, 2)} ${t.energy_unit}`],
            ["Price per unit", t.price_per_unit ? `${inr(t.price_per_unit)}/${t.energy_unit}` : "-"], ["Trip cost", inr(t.cost)],
            ["Cost per km", inr(t.cost_per_km)], ["Average speed", t.avg_speed_kmph ? `${num(t.avg_speed_kmph)} km/h` : "-"], ["Notes", t.notes || "-"]]
            .map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-line pb-2"><dt className="text-sage">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>)}
        </dl>
      )}
    </Modal>
  );
}

function AddTrip({ onClose, onSaved }) {
  const [f, setF] = useState({ date: new Date().toISOString().slice(0, 10), type: "petrol", distance: "", energy: "", price: "", speed: "", notes: "" });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (ev) => {
    ev.preventDefault();
    const e = { distance: checkPositive(f.distance, "Distance"), energy: checkPositive(f.energy, "Energy used"), price: checkPositive(f.price, "Price per unit") };
    if (!f.date) e.date = "Date is required.";
    Object.keys(e).forEach((k) => !e[k] && delete e[k]);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true); setApiError("");
    try {
      await createTrip({ trip_date: f.date, vehicle_type: f.type, distance_km: toNum(f.distance), energy_used: toNum(f.energy),
        price_per_unit: toNum(f.price), avg_speed_kmph: toNum(f.speed), notes: f.notes || undefined });
      onSaved();
    } catch (err) { setApiError(getErrorMessage(err)); setBusy(false); }
  };
  const unit = f.type === "electric" ? "kWh" : "L";
  return (
    <Modal title="Log a trip" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3" noValidate>
        <Field label="Date" type="date" value={f.date} onChange={set("date")} error={errors.date} />
        <div>
          <label htmlFor="trip-type" className="label">Vehicle type</label>
          <select id="trip-type" className="input" value={f.type} onChange={set("type")}><option value="petrol">Petrol</option><option value="electric">Electric</option></select>
        </div>
        <Field label="Distance" unit="km" type="number" step="any" value={f.distance} onChange={set("distance")} error={errors.distance} />
        <Field label={f.type === "electric" ? "Electricity drawn" : "Fuel used"} unit={unit} type="number" step="any" value={f.energy} onChange={set("energy")} error={errors.energy} />
        <Field label="Price per unit" unit={`₹/${unit}`} type="number" step="any" value={f.price} onChange={set("price")} error={errors.price} />
        <Field label="Average speed (optional)" unit="km/h" type="number" step="any" value={f.speed} onChange={set("speed")} />
        <Field label="Notes (optional)" value={f.notes} onChange={set("notes")} maxLength={500} />
        <ErrorBox message={apiError} />
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Saving..." : "Save trip"}</button>
      </form>
    </Modal>
  );
}

export default function History() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") || "");
  const [debounced, setDebounced] = useState(search);
  const [vehicleType, setVehicleType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState(null);
  const [adding, setAdding] = useState(params.get("new") === "1");

  useEffect(() => { const t = setTimeout(() => { setDebounced(search); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);

  const { data, loading, error, reload } = useFetch(() => listTrips({
    search: debounced || undefined, vehicle_type: vehicleType || undefined, date_from: dateFrom || undefined,
    date_to: dateTo || undefined, page, page_size: PAGE_SIZE,
  }), [debounced, vehicleType, dateFrom, dateTo, page]);

  const closeAdd = () => { setAdding(false); if (params.get("new")) { params.delete("new"); setParams(params, { replace: true }); } };
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const sm = data?.summary;
  const filtered = Boolean(debounced || vehicleType || dateFrom || dateTo);

  return (
    <div>
      <PageHeader title="Trip History" subtitle="Trips are stored in your local database.">
        <button className="btn-primary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Log a trip</button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Fuel} label="Total trips" value={sm ? sm.total_trips : "-"} />
        <StatCard icon={Route} label="Total distance" value={sm ? `${num(sm.total_distance_km)} km` : "-"} />
        <StatCard icon={IndianRupee} label="Total expenditure" value={sm ? inr(sm.total_cost) : "-"} />
        <StatCard icon={Gauge} label="Avg cost per km" value={sm ? inr(sm.avg_cost_per_km) : "-"} />
      </div>

      <section className="card mt-6 p-5">
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input className="input" placeholder="Search trips..." aria-label="Search trips" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input" aria-label="Vehicle type" value={vehicleType} onChange={(e) => { setVehicleType(e.target.value); setPage(1); }}>
            <option value="">All vehicles</option><option value="petrol">Petrol</option><option value="electric">Electric</option>
          </select>
          <input type="date" className="input" aria-label="From date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
          <input type="date" className="input" aria-label="To date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
        </div>

        <ErrorBox message={error} onRetry={reload} />
        {loading && !data && <Loading text="Loading trips..." />}
        {data && data.items.length === 0 && (
          <EmptyState title={filtered ? "No trips match your filters" : "No trips yet"}
            action={!filtered && <button className="btn-primary mt-2" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Log your first trip</button>}>
            {filtered ? "Try clearing the search or date range." : "Log a trip to start tracking cost and efficiency."}
          </EmptyState>
        )}
        {data && data.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead><tr className="border-b border-line text-sage">
                <th className="py-2 font-medium">Date</th><th className="font-medium">Vehicle type</th><th className="font-medium">Distance</th>
                <th className="font-medium">Fuel/Energy</th><th className="font-medium">Cost</th><th className="font-medium"><span className="sr-only">Actions</span></th>
              </tr></thead>
              <tbody className="divide-y divide-line">
                {data.items.map((t) => (
                  <tr key={t.id}>
                    <td className="py-3">{prettyDate(t.trip_date)}</td><td>{cap(t.vehicle_type)}</td><td>{num(t.distance_km)} km</td>
                    <td>{num(t.energy_used, 2)} {t.energy_unit}</td><td className="font-semibold">{inr(t.cost)}</td>
                    <td className="text-right"><button className="font-semibold text-forest underline" onClick={() => setDetailId(t.id)}>View details</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-sage">Page {page} of {pages} · {data.total} trips</span>
            <div className="flex gap-2">
              <button className="btn-outline px-3" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
              <button className="btn-outline px-3" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </section>

      {detailId && <TripDetail id={detailId} onClose={() => setDetailId(null)} />}
      {adding && <AddTrip onClose={closeAdd} onSaved={() => { closeAdd(); setPage(1); reload(); }} />}
    </div>
  );
}
