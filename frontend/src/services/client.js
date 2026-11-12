import axios from "axios";

// The only place the API address is configured (frontend/.env -> VITE_API_BASE_URL).
// Use "localhost" (not 127.0.0.1) for both the site and the API so the login cookie is sent.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

// withCredentials: the browser sends the secure httpOnly session cookie. No token is kept in JavaScript.
const client = axios.create({ baseURL: API_BASE_URL, timeout: 20000, withCredentials: true });

// If a signed-in user's session ends, tell the app so it can return to the login page.
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = String(error?.config?.url || "");
    if (error?.response?.status === 401 && !url.startsWith("/auth/")) {
      window.dispatchEvent(new Event("fuelwise:unauthorized"));
    }
    return Promise.reject(error);
  }
);

/** Turn any axios error into a short message a person can act on. */
export function getErrorMessage(error) {
  if (error?.response) {
    const { status, data } = error.response;
    const detail = data?.detail;
    if (Array.isArray(detail)) {
      return detail
        .map((d) => {
          const field = (d.loc || []).slice(1).join(".");
          const msg = String(d.msg || "").replace(/^Value error, /, "");
          return field ? `${field}: ${msg}` : msg;
        })
        .join("; ");
    }
    if (typeof detail === "string") return detail;
    if (status >= 500) return "The server had a problem. Please try again.";
    return `Request failed (HTTP ${status}).`;
  }
  if (error?.request) {
    return `Cannot reach the FuelWise backend at ${API_BASE_URL}. Make sure it is running.`;
  }
  return error?.message || "Something went wrong.";
}

export default client;
