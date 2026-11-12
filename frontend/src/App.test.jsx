import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./services/client.js", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
  API_BASE_URL: "http://test/api",
  getErrorMessage: (e) => e?.message || "error",
}));

// Leaflet needs a real browser layout, so the map components are replaced with simple stand-ins.
vi.mock("react-leaflet", async () => {
  const { createElement: h } = await import("react");
  const box = ({ children }) => h("div", null, children);
  return { MapContainer: box, TileLayer: () => null, CircleMarker: box, Polyline: () => null, Tooltip: box, useMapEvents: () => null };
});

import client from "./services/client.js";
import App from "./App.jsx";

const settings = {
  full_name: "Test User", email: "test@example.com", city: null, theme: "light", notifications_enabled: true,
  email_alerts: false, price_alerts: true, share_analytics: false, store_chat_history: true,
  default_petrol_price: 105, default_electricity_tariff: 8, default_petrol_mileage: 45, default_ev_efficiency: 40, charging_loss_percent: 10,
};
const emptyDashboard = {
  has_data: false, summary: { total_trips: 0, total_cost: 0, total_distance_km: 0, petrol_litres_avoided: 0, money_saved: 0, co2_reduced_kg: 0 },
  assumptions: { petrol_co2_kg_per_litre: 2.31, grid_co2_kg_per_kwh: 0.71, comparison_petrol_mileage_kmpl: 45, comparison_petrol_price: 105 },
  cost_trend: [{ date: "2026-11-12", label: "Thu", petrol: 0, electric: 0 }], by_vehicle_type: [], monthly_expenses: [], recent_trips: [],
  vehicle_status: { has_vehicle: false },
};
const emptyTrips = { items: [], total: 0, page: 1, page_size: 8, summary: { total_trips: 0, total_distance_km: 0, total_cost: 0, avg_cost_per_km: null } };
const stations = { is_demo: true, centre: { lat: 22.5, lng: 88.3 }, notice: "demo",
  stations: [{ id: 1, name: "Demo Station A", lat: 22.51, lng: 88.31, distance_km: 1.7, availability: "Available", free_connectors: 2, total_connectors: 4, is_demo: true }] };

const testUser = { id: 1, name: "Test User", email: "test@example.com", role: "user", auth_provider: "local", account_status: "active" };
const routes = { "/auth/me": { user: testUser }, "/settings": settings, "/dashboard": emptyDashboard, "/trips": emptyTrips, "/vehicles": [], "/maps/charging-stations": stations };

// Renders the app and waits until the session check finishes (the sidebar appears once signed in).
async function renderAt(path) {
  const view = render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
  await screen.findByRole("navigation", { name: "Main" });
  return view;
}

beforeEach(() => {
  vi.clearAllMocks();
  client.get.mockImplementation((url) => Promise.resolve({ data: routes[url] }));
});

describe("FuelWise pages", () => {
  it("renders the home page", async () => {
    await renderAt("/");
    expect(screen.getByText("Smart Fuel Intelligence")).toBeInTheDocument();
    expect(screen.getByText("Track. Calculate. Compare. Save.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /start now/i })).toBeInTheDocument();
  });

  it("navigates between pages from the sidebar", async () => {
    await renderAt("/");
    await userEvent.click(within(screen.getByRole("navigation", { name: "Main" })).getByText("Dashboard"));
    expect(await screen.findByText("No trips yet")).toBeInTheDocument();
  });

  it("shows a helpful message when the backend cannot be reached", async () => {
    client.get.mockImplementation((url) => (url === "/dashboard" ? Promise.reject(new Error("Cannot reach the FuelWise backend")) : Promise.resolve({ data: routes[url] })));
    await renderAt("/dashboard");
    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot reach the FuelWise backend");
  });

  it("calculator validates input and shows backend results", async () => {
    await renderAt("/calculator");
    await userEvent.click(screen.getByRole("button", { name: /^calculate/i }));
    expect(await screen.findByText("Trip distance is required.")).toBeInTheDocument();
    expect(client.post).not.toHaveBeenCalled();

    client.post.mockResolvedValue({ data: { vehicle_type: "petrol", energy_required: 2.22, energy_unit: "L", trip_cost: 233.33, cost_per_km: 2.33,
      remaining_range_km: null, range_note: "Remaining range needs the fuel left.", sufficient: null, breakdown: [{ label: "Fuel required", formula: "100 km / 45 km/L = 2.22 L" }] } });
    await userEvent.type(screen.getByLabelText("Trip distance"), "100");
    await userEvent.click(screen.getByRole("button", { name: /^calculate/i }));
    expect(await screen.findByText("₹233.33")).toBeInTheDocument();
    expect(client.post).toHaveBeenCalledWith("/calculate/petrol", expect.objectContaining({ distance_km: 100 }));
  });

  it("comparison shows the cheaper option", async () => {
    client.post.mockResolvedValue({ data: { distance_km: 100, electric: { energy_required: 2.78, trip_cost: 22.22, cost_per_km: 0.22 },
      petrol: { energy_required: 2.22, trip_cost: 233.33, cost_per_km: 2.33 }, cost_difference: 211.11, savings_percent: 90.5, cheaper_option: "electric", charging_loss_percent: 10 } });
    await renderAt("/comparison");
    await waitFor(() => expect(screen.getByLabelText("EV efficiency")).toHaveValue(40));
    await userEvent.click(screen.getByRole("button", { name: /^compare/i }));
    expect(await screen.findByText(/90\.5% cheaper/)).toBeInTheDocument();
  });

  it("assistant sends a suggested prompt and shows the configuration notice", async () => {
    client.post.mockResolvedValue({ data: { configured: false, reply: "The AI assistant is not configured. Add GEMINI_API_KEY." } });
    await renderAt("/assistant");
    await userEvent.click(screen.getByRole("button", { name: "How can I reduce my fuel expenses?" }));
    expect(await screen.findByText(/not configured/)).toBeInTheDocument();
  });

  it("assistant shows errors instead of failing silently", async () => {
    client.post.mockRejectedValue(new Error("Gemini API returned an error"));
    await renderAt("/assistant");
    await userEvent.type(screen.getByLabelText("Your question"), "hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Gemini API returned an error")).toBeInTheDocument();
  });

  it("history shows an empty state", async () => {
    await renderAt("/history");
    expect(await screen.findByText("No trips yet")).toBeInTheDocument();
  });

  it("maps page labels charging stations as demo data", async () => {
    await renderAt("/maps");
    expect(await screen.findByText("Demo Station A")).toBeInTheDocument();
    expect(screen.getByText(/demo locations/i)).toBeInTheDocument();
  });

  it("settings validates the profile form", async () => {
    await renderAt("/settings");
    const name = await screen.findByLabelText("Full name");
    await userEvent.clear(name);
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(await screen.findByText("Name is required.")).toBeInTheDocument();
    expect(client.put).not.toHaveBeenCalled();
  });
});
