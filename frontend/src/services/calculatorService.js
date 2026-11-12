import client from "./client.js";

export const calculatePetrol = (body) => client.post("/calculate/petrol", body).then((r) => r.data);
export const calculateElectric = (body) => client.post("/calculate/electric", body).then((r) => r.data);
export const compareVehicles = (body) => client.post("/compare", body).then((r) => r.data);
