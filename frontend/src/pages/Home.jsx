import { Link } from "react-router-dom";
import { ArrowRight, Calculator, History, MapPin, Scale, Sparkles, LayoutDashboard } from "lucide-react";
import { ChargingStationIllustration, ScooterIllustration } from "../components/Illustrations.jsx";

const FEATURES = [
  { to: "/dashboard", icon: LayoutDashboard, title: "Dashboard", text: "See trips, costs, savings and vehicle status in one place." },
  { to: "/calculator", icon: Calculator, title: "Fuel calculator", text: "Work out fuel or electricity needed, trip cost and remaining range." },
  { to: "/comparison", icon: Scale, title: "EV vs petrol", text: "Compare running cost in rupees for the same journey." },
  { to: "/assistant", icon: Sparkles, title: "AI assistant", text: "Ask questions and get answers based on your own numbers." },
  { to: "/history", icon: History, title: "Trip history", text: "Log trips, search them and track cost per kilometre." },
  { to: "/maps", icon: MapPin, title: "Maps", text: "Plan a route and look at nearby charging stations." },
];

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="card relative overflow-hidden bg-gradient-to-r from-white to-tint p-8 sm:p-10">
        <div className="relative z-10 max-w-xl">
          <h1 className="text-5xl font-extrabold tracking-tight text-ink">FuelWise</h1>
          <p className="mt-1 text-3xl font-bold text-ink">Smart Fuel Intelligence</p>
          <p className="mt-4 text-lg font-bold text-ink">Track. Calculate. Compare. Save.</p>
          <p className="mt-2 text-charcoal">
            A smart way to estimate fuel or electricity needs, compare EV and petrol running costs,
            and get recommendations based on your own trips.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/calculator" className="btn-primary">Start Now <ArrowRight className="h-4 w-4" /></Link>
            <a href="#features" className="btn-outline">Learn More</a>
          </div>
        </div>
        <div className="mt-8 flex items-end justify-center gap-4 lg:absolute lg:bottom-4 lg:right-8 lg:mt-0">
          <ScooterIllustration variant="electric" className="h-32 w-52 sm:h-40 sm:w-64" />
          <ChargingStationIllustration className="h-28 w-16 sm:h-36 sm:w-20" />
          <ScooterIllustration variant="petrol" className="hidden h-40 w-64 xl:block" />
        </div>
      </section>

      <section id="features" aria-labelledby="features-title">
        <h2 id="features-title" className="mb-4 text-xl font-bold">What you can do with FuelWise</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {FEATURES.map(({ to, icon: Icon, title, text }) => (
            <Link key={to} to={to} className="card flex gap-4 p-5 transition-colors hover:bg-tint">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-tint text-deep"><Icon className="h-5 w-5" /></span>
              <span>
                <span className="block font-bold text-ink">{title}</span>
                <span className="mt-1 block text-sm text-sage">{text}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
