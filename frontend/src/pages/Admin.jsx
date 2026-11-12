import { useState } from "react";
import { Activity, ShieldCheck, UserCheck, UserX, Users } from "lucide-react";
import { getActivity, getAdminConfig, getAdminStats, listUsers, setAdminConfig, setUserStatus } from "../services/adminService.js";
import { getErrorMessage } from "../services/client.js";
import useFetch from "../services/useFetch.js";
import { ErrorBox, Loading, PageHeader, StatCard } from "../components/ui.jsx";
import { useAuth } from "../components/AuthContext.jsx";

const when = (iso) => (iso ? new Date(iso + "Z").toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "-");

export default function Admin() {
  const { user: me } = useAuth();
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState("");
  const stats = useFetch(getAdminStats, []);
  const users = useFetch(() => listUsers(page), [page]);
  const activity = useFetch(getActivity, []);
  const cfg = useFetch(getAdminConfig, []);

  const toggleStatus = async (u) => {
    setActionError("");
    try {
      await setUserStatus(u.id, u.account_status === "active" ? "disabled" : "active");
      users.reload(); stats.reload(); activity.reload();
    } catch (err) { setActionError(getErrorMessage(err)); }
  };
  const toggleRegistration = async () => {
    setActionError("");
    try { await setAdminConfig(!cfg.data.registration_open); cfg.reload(); activity.reload(); }
    catch (err) { setActionError(getErrorMessage(err)); }
  };

  const s = stats.data;
  return (
    <div>
      <PageHeader title="Admin area" subtitle="User statistics, activity and application settings. Personal trip data is not shown here." />
      <ErrorBox message={stats.error || actionError} onRetry={stats.error ? stats.reload : undefined} />
      {stats.loading && !s && <Loading />}
      {s && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Users} label="Total users" value={s.total_users} hint={`${s.new_users_7_days} new in 7 days`} />
          <StatCard icon={UserCheck} label="Active / disabled" value={`${s.active_users} / ${s.disabled_users}`} hint={`${s.admins} admin(s), ${s.google_users} via Google`} />
          <StatCard icon={Activity} label="Logins (24h)" value={s.logins_24h} hint={`${s.failed_logins_24h} failed`} />
          <StatCard icon={ShieldCheck} label="Active sessions" value={s.active_sessions} hint={`${s.total_trips} trips, ${s.total_vehicles} vehicles`} />
        </div>
      )}

      <section className="card mt-6 flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="font-bold">Application configuration</h2>
          <p className="text-sm text-sage">Allow new people to create accounts.</p>
        </div>
        {cfg.data && (
          <button className={cfg.data.registration_open ? "btn-outline" : "btn-primary"} onClick={toggleRegistration}>
            Registration is {cfg.data.registration_open ? "open - click to close" : "closed - click to open"}
          </button>
        )}
      </section>

      <section className="card mt-6 p-5">
        <h2 className="mb-3 font-bold">Users</h2>
        <ErrorBox message={users.error} onRetry={users.reload} />
        {users.loading && !users.data && <Loading />}
        {users.data && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead><tr className="border-b border-line text-sage">
                <th className="py-2 font-medium">Name</th><th className="font-medium">Email</th><th className="font-medium">Role</th>
                <th className="font-medium">Sign-in</th><th className="font-medium">Status</th><th className="font-medium">Last login</th><th className="font-medium"><span className="sr-only">Actions</span></th>
              </tr></thead>
              <tbody className="divide-y divide-line">
                {users.data.items.map((u) => (
                  <tr key={u.id}>
                    <td className="py-2.5">{u.name}</td><td>{u.email}</td><td className="capitalize">{u.role}</td>
                    <td className="capitalize">{u.auth_provider}</td><td className="capitalize">{u.account_status}</td><td>{when(u.last_login_at)}</td>
                    <td className="text-right">
                      {u.id !== me?.id && (
                        <button className="inline-flex items-center gap-1 font-semibold text-forest underline" onClick={() => toggleStatus(u)}>
                          {u.account_status === "active" ? <><UserX className="h-4 w-4" /> Disable</> : <><UserCheck className="h-4 w-4" /> Enable</>}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.data.total > users.data.page_size && (
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-sage">{users.data.total} users</span>
                <div className="flex gap-2">
                  <button className="btn-outline px-3 py-1.5" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
                  <button className="btn-outline px-3 py-1.5" disabled={page * users.data.page_size >= users.data.total} onClick={() => setPage(page + 1)}>Next</button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="card mt-6 p-5">
        <h2 className="mb-3 font-bold">Recent activity</h2>
        <ErrorBox message={activity.error} onRetry={activity.reload} />
        {activity.data && (activity.data.length === 0 ? <p className="text-sm text-sage">No activity yet.</p> : (
          <ul className="divide-y divide-line text-sm">
            {activity.data.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span><b>{a.event.replace(/_/g, " ")}</b>{a.user_email ? ` · ${a.user_email}` : ""}{a.detail ? ` · ${a.detail}` : ""}</span>
                <span className="text-xs text-sage">{when(a.created_at)}{a.ip_address ? ` · ${a.ip_address}` : ""}</span>
              </li>
            ))}
          </ul>
        ))}
      </section>
    </div>
  );
}
