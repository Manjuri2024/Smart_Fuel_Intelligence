import client from "./client.js";

export const sendChat = (message, history) => client.post("/ai/chat", { message, history }).then((r) => r.data);
