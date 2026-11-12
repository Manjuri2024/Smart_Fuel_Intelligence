import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./services/client.js", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() },
  API_BASE_URL: "http://test/api",
  getErrorMessage: (e) => e?.message || "error",
}));
vi.mock("react-leaflet", async () => {
  const { createElement: h } = await import("react");
  const box = ({ children }) => h("div", null, children);
  return { MapContainer: box, TileLayer: () => null, CircleMarker: box, Polyline: () => null, Tooltip: box, useMapEvents: () => null };
});

import client from "./services/client.js";
import App from "./App.jsx";

const SAVE_MESSAGE = "Create a free FuelWise account to save your trips and vehicle information.";
const user = { id: 1, name: "Test User", email: "test@example.com", role: "user", auth_provider: "local", account_status: "active" };
const admin = { ...user, id: 2, name: "Boss", role: "admin" };

const baseDashboard = {
  has_data: true, is_demo: false,
  summary: { total_trips: 3, total_cost: 100, total_distance_km: 50, petrol_litres_avoided: 1, money_saved: 10, co2_reduced_kg: 2 },
  assumptions: { petrol_co2_kg_per_litre: 2.31, grid_co2_kg_per_kwh: 0.71, comparison_petrol_mileage_kmpl: 45, comparison_petrol_price: 105 },
  cost_trend: [{ date: "2026-11-12", label: "Thu", petrol: 1, electric: 1 }], by_vehicle_type: [], monthly_expenses: [], recent_trips: [],
  vehicle_status: { has_vehicle: false },
};
const demoDashboard = { ...baseDashboard, is_demo: true, demo_notice: "Demo data for illustration only." };
const settings = { full_name: "Test User", email: "test@example.com", phone: null, city: null, theme: "light", notifications_enabled: true, email_alerts: false,
  price_alerts: true, share_analytics: false, store_chat_history: true, default_petrol_price: 105, default_electricity_tariff: 8,
  default_petrol_mileage: 45, default_ev_efficiency: 40, charging_loss_percent: 10 };

/** me: the signed-in user, or null for a visitor who is not signed in. */
function setup(me) {
  client.get.mockImplementation((url) => {
    if (url === "/auth/me") return me ? Promise.resolve({ data: { user: me } }) : Promise.reject({ response: { status: 401 } });
    const data = { "/dashboard": baseDashboard, "/demo/dashboard": demoDashboard, "/settings": settings }[url];
    return data ? Promise.resolve({ data }) : Promise.reject(new Error("unexpected GET " + url));
  });
}
const renderAt = (path) => render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);

beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); });

describe("login page", () => {
  it("sends visitors who are not signed in to the login page", async () => {
    setup(null);
    renderAt("/dashboard");
    expect(await screen.findByText("Welcome Back!")).toBeInTheDocument();
    expect(screen.getByText("Sign in to manage your vehicle expenses.")).toBeInTheDocument();
  });

  it("shows validation messages for missing fields", async () => {
    setup(null);
    renderAt("/login");
    await userEvent.click(await screen.findByRole("button", { name: "Sign In" }));
    expect(await screen.findByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(client.post).not.toHaveBeenCalled();
  });

  it("shows the server message for wrong credentials", async () => {
    setup(null);
    client.post.mockRejectedValue(new Error("Incorrect email or password."));
    renderAt("/login");
    await userEvent.type(await screen.findByLabelText("Email address"), "a@b.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrongpass1");
    await userEvent.click(screen.getByRole("button", { name: "Sign In" }));
    expect(await screen.findByText("Incorrect email or password.")).toBeInTheDocument();
  });

  it("shows and hides the password", async () => {
    setup(null);
    renderAt("/login");
    const input = await screen.findByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");
  });

  it("signs in, sends the remember choice and lands on the dashboard with the user's name", async () => {
    setup(null);
    client.post.mockResolvedValue({ data: { user } });
    renderAt("/login");
    await userEvent.type(await screen.findByLabelText("Email address"), "test@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByLabelText("Remember me"));
    await userEvent.click(screen.getByRole("button", { name: "Sign In" }));
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(client.post).toHaveBeenCalledWith("/auth/login", { email: "test@example.com", password: "password123", remember: true });
    expect(screen.getByLabelText("Account menu")).toHaveTextContent("Test");
  });

  it("explains when Google sign-in is not configured", async () => {
    setup(null);
    renderAt("/login?error=google_not_configured");
    expect(await screen.findByRole("alert")).toHaveTextContent(/not set up/i);
    expect(screen.getByRole("link", { name: /sign in with google/i })).toHaveAttribute("href", "http://test/api/auth/google");
  });

  it("offers forgot password, create account and guest access", async () => {
    setup(null);
    renderAt("/login");
    expect(await screen.findByRole("link", { name: "Forgot password?" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create Account" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue as Guest" })).toBeInTheDocument();
  });
});

describe("signup page", () => {
  it("checks password rules, confirmation and terms before calling the server", async () => {
    setup(null);
    renderAt("/signup");
    await userEvent.type(await screen.findByLabelText("Full name"), "Asha");
    await userEvent.type(screen.getByLabelText("Email address"), "asha@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "short");
    await userEvent.type(screen.getByLabelText("Confirm password"), "different");
    await userEvent.click(screen.getByRole("button", { name: "Create Account" }));
    expect(await screen.findByText("Password must be at least 8 characters.")).toBeInTheDocument();
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(screen.getByText("You must accept the Terms and Privacy Policy.")).toBeInTheDocument();
    expect(client.post).not.toHaveBeenCalled();
  });

  it("creates the account and shows a success message", async () => {
    setup(null);
    client.post.mockResolvedValue({ data: { user } });
    renderAt("/signup");
    await userEvent.type(await screen.findByLabelText("Full name"), "Asha");
    await userEvent.type(screen.getByLabelText("Email address"), "asha@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.type(screen.getByLabelText("Confirm password"), "password123");
    await userEvent.click(screen.getByLabelText(/I accept the Terms/));
    await userEvent.click(screen.getByRole("button", { name: "Create Account" }));
    expect(await screen.findByText("Account created!")).toBeInTheDocument();
    expect(client.post).toHaveBeenCalledWith("/auth/register", expect.objectContaining({ email: "asha@example.com", accept_terms: true }));
    expect(client.post.mock.calls[0][1]).not.toHaveProperty("role");        // the browser never chooses a role
  });

  it("shows the duplicate-email message from the server", async () => {
    setup(null);
    client.post.mockRejectedValue(new Error("An account with this email already exists."));
    renderAt("/signup");
    await userEvent.type(await screen.findByLabelText("Full name"), "Asha");
    await userEvent.type(screen.getByLabelText("Email address"), "asha@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.type(screen.getByLabelText("Confirm password"), "password123");
    await userEvent.click(screen.getByLabelText(/I accept the Terms/));
    await userEvent.click(screen.getByRole("button", { name: "Create Account" }));
    expect(await screen.findByText(/already exists/)).toBeInTheDocument();
  });
});

describe("forgot password", () => {
  it("shows the same message whether or not the email exists", async () => {
    setup(null);
    client.post.mockResolvedValue({ data: { message: "If an account exists for that email, a password reset link has been sent." } });
    renderAt("/forgot-password");
    await userEvent.type(await screen.findByLabelText("Email address"), "someone@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send Reset Link" }));
    expect(await screen.findByText(/If an account exists/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Login" })).toBeInTheDocument();
  });

  it("reset page needs a token from the e-mail link", async () => {
    setup(null);
    renderAt("/reset-password");
    expect(await screen.findByText("Reset link missing")).toBeInTheDocument();
  });

  it("sets a new password using the token", async () => {
    setup(null);
    client.post.mockResolvedValue({ data: { message: "Your password has been updated. You can now sign in." } });
    renderAt("/reset-password?token=abc");
    await userEvent.type(await screen.findByLabelText("New password"), "newpass123");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "newpass123");
    await userEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByText(/password has been updated/)).toBeInTheDocument();
    expect(client.post).toHaveBeenCalledWith("/auth/reset-password", { token: "abc", new_password: "newpass123" });
  });
});

describe("guest access", () => {
  async function enterAsGuest() {
    setup(null);
    renderAt("/login");
    await userEvent.click(await screen.findByRole("button", { name: "Continue as Guest" }));
    await screen.findByText("Smart Fuel Intelligence");
  }

  it("lets a guest explore home and see demo data on the dashboard", async () => {
    await enterAsGuest();
    expect(screen.getByRole("note")).toHaveTextContent(/browsing as a guest/i);
    await userEvent.click(within(screen.getByRole("navigation", { name: "Main" })).getByText("Dashboard"));
    expect(await screen.findByText(/Demo data\./)).toBeInTheDocument();
    expect(client.get).toHaveBeenCalledWith("/demo/dashboard", expect.anything());
    expect(client.get).not.toHaveBeenCalledWith("/dashboard", expect.anything());
  });

  it("blocks guests from saved trips, settings and the AI assistant with the account message", async () => {
    await enterAsGuest();
    const nav = within(screen.getByRole("navigation", { name: "Main" }));
    for (const label of ["History", "Settings", "AI Assistant"]) {
      await userEvent.click(nav.getByText(label));
      expect(await screen.findByText(SAVE_MESSAGE)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Create Account" })).toBeInTheDocument();
    }
    expect(client.get).not.toHaveBeenCalledWith("/trips", expect.anything());
    expect(client.get).not.toHaveBeenCalledWith("/settings");
  });

  it("lets a guest open the calculator without calling private endpoints", async () => {
    await enterAsGuest();
    await userEvent.click(within(screen.getByRole("navigation", { name: "Main" })).getByText("Calculator"));
    expect(await screen.findByRole("heading", { name: "Fuel Calculator" })).toBeInTheDocument();
    expect(client.get).not.toHaveBeenCalledWith("/settings");
  });
});

describe("protected areas and logout", () => {
  it("hides the admin area from regular users", async () => {
    setup(user);
    renderAt("/admin");
    expect(await screen.findByText("You do not have access to this page")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
  });

  it("shows the admin link to administrators", async () => {
    setup(admin);
    renderAt("/dashboard");
    expect(await screen.findByRole("link", { name: "Admin" })).toBeInTheDocument();
  });

  it("redirects a signed-in user away from the login page", async () => {
    setup(user);
    renderAt("/login");
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("signs out through the profile menu and returns to the login page", async () => {
    setup(user);
    client.post.mockResolvedValue({ data: { message: "Signed out." } });
    renderAt("/dashboard");
    await userEvent.click(await screen.findByLabelText("Account menu"));
    await userEvent.click(screen.getByRole("menuitem", { name: /sign out/i }));
    expect(await screen.findByText("Welcome Back!")).toBeInTheDocument();
    expect(client.post).toHaveBeenCalledWith("/auth/logout");
  });

  it("returns to login when the session ends while using the app", async () => {
    setup(user);
    renderAt("/dashboard");
    await screen.findByRole("heading", { name: "Dashboard" });
    window.dispatchEvent(new Event("fuelwise:unauthorized"));
    await waitFor(() => expect(screen.getByText("Welcome Back!")).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent(/session has ended/i);
  });
});
