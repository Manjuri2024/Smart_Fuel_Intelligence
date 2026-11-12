import client from "./client.js";

export const getChargingStations = (params) => client.get("/maps/charging-stations", { params }).then((r) => r.data);

// Map configuration (frontend/.env)
export const mapConfig = {
  center: [
    Number(import.meta.env.VITE_MAP_CENTER_LAT) || 22.5726,
    Number(import.meta.env.VITE_MAP_CENTER_LNG) || 88.3639,
  ],
  tileUrl: import.meta.env.VITE_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: import.meta.env.VITE_MAP_ATTRIBUTION || "&copy; OpenStreetMap contributors",
};
