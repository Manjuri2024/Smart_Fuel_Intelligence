import client from "./client.js";

export const getAdminStats = () => client.get("/admin/stats").then((r) => r.data);
export const listUsers = (page = 1) => client.get("/admin/users", { params: { page, page_size: 10 } }).then((r) => r.data);
export const setUserStatus = (id, account_status) => client.patch(`/admin/users/${id}`, { account_status }).then((r) => r.data);
export const getActivity = () => client.get("/admin/activity", { params: { limit: 25 } }).then((r) => r.data);
export const getAdminConfig = () => client.get("/admin/config").then((r) => r.data);
export const setAdminConfig = (registration_open) => client.put("/admin/config", { registration_open }).then((r) => r.data);
