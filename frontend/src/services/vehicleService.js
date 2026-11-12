import client from "./client.js";

export const listVehicles = () => client.get("/vehicles").then((r) => r.data);
export const createVehicle = (body) => client.post("/vehicles", body).then((r) => r.data);
export const updateVehicle = (id, body) => client.put(`/vehicles/${id}`, body).then((r) => r.data);
