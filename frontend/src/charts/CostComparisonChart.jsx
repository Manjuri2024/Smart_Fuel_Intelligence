import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

/** data: [{ name, cost, kind: "petrol" | "electric" }] */
export default function CostComparisonChart({ data, unit = "₹", height = "h-56" }) {
  return (
    <div className={height} aria-label="Cost comparison chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
          <CartesianGrid stroke="#E3E5E0" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#818576" }} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: "#818576" }} tickLine={false} axisLine={false} />
          <Tooltip formatter={(v) => `${unit}${v}`} />
          <Bar dataKey="cost" name="Cost" radius={[8, 8, 0, 0]} maxBarSize={80}>
            {data.map((d) => <Cell key={d.name} fill={d.kind === "electric" ? "#818576" : "#37403F"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
