import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function CostTrendChart({ data }) {
  return (
    <div className="h-64" aria-label="Fuel cost trend chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="#E3E5E0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#818576" }} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: "#818576" }} tickLine={false} axisLine={false} />
          <Tooltip formatter={(v) => `₹${v}`} />
          <Legend iconType="circle" />
          <Line type="monotone" dataKey="petrol" name="Petrol" stroke="#25282D" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="electric" name="Electric" stroke="#818576" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
