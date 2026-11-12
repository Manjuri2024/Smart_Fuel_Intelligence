export const inr = (n) =>
  n === null || n === undefined ? "-" : "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const num = (n, d = 1) =>
  n === null || n === undefined ? "-" : Number(n).toLocaleString("en-IN", { maximumFractionDigits: d });
export const prettyDate = (iso) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
