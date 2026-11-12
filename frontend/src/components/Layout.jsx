import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Bell, Calculator, ChevronDown, Fuel, History, Home, LayoutDashboard, Lock, LogOut, MapPin, Scale, Search, Settings, ShieldCheck, Sparkles, User, Zap } from "lucide-react";
import { useAuth } from "./AuthContext.jsx";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/calculator", label: "Calculator", icon: Calculator },
  { to: "/comparison", label: "Comparison", icon: Scale },
  { to: "/assistant", label: "AI Assistant", icon: Sparkles, account: true },
  { to: "/history", label: "History", icon: History, account: true },
  { to: "/maps", label: "Maps", icon: MapPin },
  { to: "/settings", label: "Settings", icon: Settings, account: true },
];

function ProfileMenu() {
  const { user, isGuest, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, []);

  const name = isGuest ? "Guest" : user?.name || "Account";
  const leave = async () => { setOpen(false); await signOut(); navigate("/login", { replace: true }); };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu"
        className="flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 shadow-card">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-deep text-sm font-bold text-white">
          {isGuest ? <User className="h-4 w-4" /> : name[0].toUpperCase()}
        </span>
        <span className="hidden text-sm font-semibold sm:block">{name.split(" ")[0]}</span>
        <ChevronDown className="h-4 w-4 text-sage" />
      </button>
      {open && (
        <div role="menu" className="card absolute right-0 z-40 mt-2 w-64 p-2">
          <div className="border-b border-line px-3 py-2">
            <p className="truncate text-sm font-bold text-ink">{name}</p>
            <p className="truncate text-xs text-sage">{isGuest ? "Browsing as guest" : user?.email}</p>
            {!isGuest && <span className="mt-1 inline-block rounded-full bg-tint px-2 py-0.5 text-xs font-semibold capitalize text-deep">{user?.role}</span>}
          </div>
          {isGuest ? (
            <>
              <Link role="menuitem" to="/signup" onClick={() => setOpen(false)} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-tint">Create account</Link>
              <button role="menuitem" onClick={leave} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-tint">Sign in</button>
            </>
          ) : (
            <>
              <Link role="menuitem" to="/settings" onClick={() => setOpen(false)} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-tint"><Settings className="h-4 w-4" /> Profile & settings</Link>
              {user?.role === "admin" && (
                <Link role="menuitem" to="/admin" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-tint"><ShieldCheck className="h-4 w-4" /> Admin area</Link>
              )}
              <button role="menuitem" onClick={leave} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-tint"><LogOut className="h-4 w-4" /> Sign out</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const navigate = useNavigate();
  const { isGuest, isAdmin } = useAuth();
  const [query, setQuery] = useState("");
  const items = isAdmin ? [...NAV, { to: "/admin", label: "Admin", icon: ShieldCheck }] : NAV;

  const submitSearch = (e) => {
    e.preventDefault();
    navigate(query.trim() ? `/history?search=${encodeURIComponent(query.trim())}` : "/history");
  };

  return (
    <div className="min-h-screen">
      <aside className="border-b border-line bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-60 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-deep text-white"><Fuel className="h-5 w-5" /></span>
          <span className="text-xl font-extrabold text-ink">FuelWise</span>
        </div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:pb-0">
          {items.map(({ to, label, icon: Icon, account }) => (
            <NavLink key={to} to={to} end={to === "/"}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                  isActive ? "bg-deep text-white" : "text-charcoal hover:bg-tint"}`}>
              <Icon className="h-5 w-5" /> {label}
              {isGuest && account && <Lock className="ml-auto h-3.5 w-3.5 opacity-60" aria-label="Account required" />}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-5 left-4 right-4 hidden rounded-xl border border-line bg-tint p-3 text-center lg:block">
          <Zap className="mx-auto h-5 w-5 text-forest" />
          <p className="text-sm font-bold text-ink">FuelWise</p>
          <p className="text-xs text-sage">Drive smarter. Save more.</p>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="flex items-center gap-4 px-4 py-4 sm:px-8">
          <form onSubmit={submitSearch} className="relative max-w-xl flex-1" role="search">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sage" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} className="input pl-9"
              placeholder="Search trips..." aria-label="Search trips" />
          </form>
          <Link to="/settings?tab=notifications" aria-label="Notification settings" className="rounded-full p-2 text-charcoal hover:bg-tint">
            <Bell className="h-5 w-5" />
          </Link>
          <ProfileMenu />
        </header>
        <main className="px-4 pb-12 sm:px-8">
          {isGuest && (
            <div role="note" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-beige bg-beige/20 px-4 py-3 text-sm">
              <span>You are browsing as a <b>guest</b>. The dashboard shows demo data and nothing you enter is saved.</span>
              <Link to="/signup" className="btn-primary py-1.5">Create Account</Link>
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
