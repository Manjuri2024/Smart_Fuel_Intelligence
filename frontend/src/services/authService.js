import client, { API_BASE_URL } from "./client.js";

export const login = (body) => client.post("/auth/login", body).then((r) => r.data.user);
export const register = (body) => client.post("/auth/register", body).then((r) => r.data.user);
export const logout = () => client.post("/auth/logout").then((r) => r.data);
export const me = () => client.get("/auth/me").then((r) => r.data.user);
export const forgotPassword = (email) => client.post("/auth/forgot-password", { email }).then((r) => r.data);
export const resetPassword = (token, new_password) => client.post("/auth/reset-password", { token, new_password }).then((r) => r.data);

// Google sign-in is a full-page redirect handled by the backend (the client secret never reaches the browser).
export const googleLoginUrl = `${API_BASE_URL}/auth/google`;
