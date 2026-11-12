import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function MonthlyExpenseChart({ data }) {
  return (
    <div className="h-56" aria-label="Monthly expense chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
          <CartesianGrid stroke="#E3E5E0" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#818576" }} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: "#818576" }} tickLine={false} axisLine={false} />
          <Tooltip formatter={(v) => `₹${v}`} />
          <Legend iconType="circle" />
          <Bar dataKey="petrol" name="Petrol" stackId="a" fill="#37403F" />
          <Bar dataKey="electric" name="Electric" stackId="a" fill="#818576" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
