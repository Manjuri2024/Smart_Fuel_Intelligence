import client from "./client.js";

export const listTrips = (params) => client.get("/trips", { params }).then((r) => r.data);
export const getTrip = (id) => client.get(`/trips/${id}`).then((r) => r.data);
export const createTrip = (body) => client.post("/trips", body).then((r) => r.data);
