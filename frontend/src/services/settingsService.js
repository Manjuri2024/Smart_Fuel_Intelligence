import client from "./client.js";

export const getSettings = () => client.get("/settings").then((r) => r.data);
export const saveSettings = (body) => client.put("/settings", body).then((r) => r.data);
