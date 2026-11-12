import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Navigation, RotateCcw } from "lucide-react";
import { getChargingStations, mapConfig } from "../services/mapService.js";
import { getErrorMessage } from "../services/client.js";
import { ErrorBox, Loading, PageHeader } from "../components/ui.jsx";
import { num } from "../services/format.js";

function haversine([lat1, lng1], [lat2, lng2]) {
  const rad = (d) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.sqrt(a));
}

function ClickToPlace({ onPick }) {
  useMapEvents({ click: (e) => onPick([e.latlng.lat, e.latlng.lng]) });
  return null;
}

const AVAIL = { Available: "bg-tint text-deep", Busy: "bg-beige/40 text-ink", Offline: "bg-line text-charcoal" };

export default function Maps() {
  const [start, setStart] = useState(null);
  const [dest, setDest] = useState(null);
  const [radius, setRadius] = useState(25);
  const [stations, setStations] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const origin = start || mapConfig.center;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getChargingStations({ lat: origin[0], lng: origin[1], radius_km: radius })
      .then((d) => { if (!cancelled) { setStations(d); setError(""); } })
      .catch((e) => !cancelled && setError(getErrorMessage(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [origin[0], origin[1], radius]);

  const pick = (point) => (!start ? setStart(point) : !dest ? setDest(point) : (setStart(point), setDest(null)));
  const useMyLocation = () => navigator.geolocation?.getCurrentPosition(
    (p) => setStart([p.coords.latitude, p.coords.longitude]), () => setError("Could not read your location. Click the map to set a start point instead."));
  const reset = () => { setStart(null); setDest(null); setSelected(null); };
  const routeKm = start && dest ? haversine(start, dest) : null;

  return (
    <div>
      <PageHeader title="Maps and Charging Stations" subtitle="Click the map to set a start point, then a destination.">
        <div className="flex gap-2">
          <button className="btn-outline" onClick={useMyLocation}><Navigation className="h-4 w-4" /> Use my location</button>
          <button className="btn-outline" onClick={reset}><RotateCcw className="h-4 w-4" /> Reset</button>
        </div>
      </PageHeader>

      <p className="mb-4 rounded-xl border border-beige bg-beige/20 p-3 text-sm text-ink">
        Charging stations shown here are <b>demo locations</b>, not real stations. The route is a straight line between your two points; road routing is not connected yet.
      </p>
      <ErrorBox message={error} />

      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <div className="card h-[28rem] overflow-hidden p-2 lg:col-span-2">
          <MapContainer center={mapConfig.center} zoom={12} scrollWheelZoom>
            <TileLayer url={mapConfig.tileUrl} attribution={mapConfig.attribution} />
            <ClickToPlace onPick={pick} />
            {start && <CircleMarker center={start} radius={9} pathOptions={{ color: "#14171C", fillColor: "#545E56", fillOpacity: 1 }}><Tooltip permanent>Start</Tooltip></CircleMarker>}
            {dest && <CircleMarker center={dest} radius={9} pathOptions={{ color: "#14171C", fillColor: "#B6B49F", fillOpacity: 1 }}><Tooltip permanent>Destination</Tooltip></CircleMarker>}
            {start && dest && <Polyline positions={[start, dest]} pathOptions={{ color: "#37403F", weight: 4, dashArray: "8 8" }} />}
            {stations?.stations.map((s) => (
              <CircleMarker key={s.id} center={[s.lat, s.lng]} radius={selected === s.id ? 10 : 7}
                pathOptions={{ color: "#818576", fillColor: s.availability === "Available" ? "#818576" : "#E3E5E0", fillOpacity: 1 }}
                eventHandlers={{ click: () => setSelected(s.id) }}><Tooltip>{s.name} (demo)</Tooltip></CircleMarker>
            ))}
          </MapContainer>
        </div>

        <aside className="space-y-4">
          <section className="card p-4 text-sm">
            <h2 className="mb-2 font-bold">Route</h2>
            <p>Start: {start ? `${start[0].toFixed(4)}, ${start[1].toFixed(4)}` : "not set"}</p>
            <p>Destination: {dest ? `${dest[0].toFixed(4)}, ${dest[1].toFixed(4)}` : "not set"}</p>
            {routeKm != null && <p className="mt-2 font-bold">Straight-line distance: {num(routeKm, 1)} km</p>}
          </section>

          <section className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">Nearby charging stations</h2>
              <select aria-label="Search radius" className="input w-auto py-1.5" value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
                {[5, 10, 25, 50].map((r) => <option key={r} value={r}>{r} km</option>)}
              </select>
            </div>
            {loading && !stations && <Loading />}
            {stations && stations.stations.length === 0 && <p className="text-sm text-sage">No stations within {radius} km.</p>}
            <ul className="space-y-2">
              {stations?.stations.map((s) => (
                <li key={s.id}>
                  <button onClick={() => setSelected(s.id)} className={`w-full rounded-xl border p-3 text-left text-sm ${selected === s.id ? "border-forest bg-tint" : "border-line"}`}>
                    <span className="flex items-center justify-between"><b>{s.name}</b><span className="text-sage">{num(s.distance_km, 1)} km</span></span>
                    <span className="mt-1 flex items-center justify-between">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${AVAIL[s.availability]}`}>{s.availability}</span>
                      <span className="text-xs text-sage">{s.free_connectors}/{s.total_connectors} connectors free · DEMO</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-sage">Distance is measured from {start ? "your start point" : "the map centre"}.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
