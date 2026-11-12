/** FuelWise palette: ink #14171C, charcoal #25282D, deep #37403F, forest #545E56, sage #818576, beige #B6B49F */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14171C",
        charcoal: "#25282D",
        deep: "#37403F",
        forest: "#545E56",
        sage: "#818576",
        beige: "#B6B49F",
        surface: "#F6F7F5",
        line: "#E3E5E0",
        tint: "#EEF1EC",
      },
      fontFamily: { sans: ['"Plus Jakarta Sans"', "system-ui", "Segoe UI", "Arial", "sans-serif"] },
      boxShadow: { card: "0 1px 2px rgba(20,23,28,0.04), 0 6px 16px rgba(20,23,28,0.05)" },
    },
  },
  plugins: [],
};
