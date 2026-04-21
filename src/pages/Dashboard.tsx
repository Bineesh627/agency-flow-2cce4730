import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getProjects } from "@/services/projects";
import { getMyTasks } from "@/services/tasks";
import { getTodayAttendance, getAllAttendance } from "@/services/attendance";
import { listUsers } from "@/services/users";
import {
  FolderKanban, ListChecks, Clock, ArrowRight, Sparkles, Activity,
  Users, UserCheck, AlertTriangle, Settings,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Dashboard = () => {
  const { user, isAdmin } = useAuth();

  const projectsQ = useQuery({ queryKey: ["projects"], queryFn: getProjects });
  const myTasksQ = useQuery({
    queryKey: ["my-tasks", user?.id],
    queryFn: getMyTasks,
    enabled: !!user && !isAdmin,
  });
  const todayAttQ = useQuery({
    queryKey: ["today-attendance", user?.id],
    queryFn: getTodayAttendance,
    enabled: !!user && !isAdmin,
  });

  // Admin-only data
  const today = new Date().toISOString().slice(0, 10);
  const allAttQ = useQuery({
    queryKey: ["all-att-today", today],
    queryFn: () => getAllAttendance({ date: today }),
    enabled: isAdmin,
  });
  const usersQ = useQuery({ queryKey: ["users"], queryFn: listUsers, enabled: isAdmin });

  const todoCount = (myTasksQ.data ?? []).filter((t) => t.status === "todo").length;
  const inProgressCount = (myTasksQ.data ?? []).filter((t) => t.status === "in_progress").length;
  const doneCount = (myTasksQ.data ?? []).filter((t) => t.status === "done").length;

  // Admin aggregates
  const totalUsers = usersQ.data?.length ?? 0;
  const nonAdminUsers = (usersQ.data ?? []).filter((u) => u.role !== "admin").length;
  const presentToday = (allAttQ.data ?? []).filter((r: any) => r.status === "present").length;
  const lateToday = (allAttQ.data ?? []).filter((r: any) => r.status === "late").length;
  const halfDayToday = (allAttQ.data ?? []).filter((r: any) => r.status === "half_day").length;
  const checkedInIds = new Set((allAttQ.data ?? []).map((r: any) => r.user_id));
  const notCheckedIn = Math.max(0, nonAdminUsers - checkedInIds.size);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 text-xs text-primary/80 bg-primary/10 border border-primary/20 rounded-full px-3 py-1 mb-3">
          <Sparkles className="h-3 w-3" />
          {isAdmin ? "Administrator workspace" : "Welcome back"}
        </div>
        <h1 className="text-4xl font-bold text-gradient">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-2">
          {isAdmin
            ? "Organization-wide overview, attendance and team status."
            : "Here's what's happening across your projects today."}
        </p>
      </div>

      {isAdmin ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Projects" value={projectsQ.data?.length ?? 0} icon={FolderKanban} accent="primary" />
            <StatCard label="Team members" value={nonAdminUsers} icon={Users} accent="secondary" />
            <StatCard label="Present today" value={presentToday} icon={UserCheck} accent="success" />
            <StatCard label="Late / half day" value={lateToday + halfDayToday} icon={AlertTriangle} accent="warning" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
            <QuickLink to="/admin/users" label="Manage users" desc="Create, update, and assign roles" icon={Users} />
            <QuickLink to="/admin/attendance" label="Attendance & windows" desc="Records and time settings" icon={Clock} />
            <QuickLink to="/projects" label="Projects" desc="View and manage all projects" icon={FolderKanban} />
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Projects" value={projectsQ.data?.length ?? 0} icon={FolderKanban} accent="primary" />
          <StatCard label="My tasks" value={myTasksQ.data?.length ?? 0} icon={ListChecks} accent="secondary" />
          <StatCard label="In progress" value={inProgressCount} icon={Activity} accent="warning" />
          <StatCard
            label="Today"
            value={todayAttQ.data?.status ?? "—"}
            icon={Clock}
            textValue
            accent="success"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isAdmin ? (
          <section className="card-glass p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-lg">Today's attendance</h2>
              <Link to="/admin/attendance" className="text-sm text-primary inline-flex items-center gap-1 hover:gap-2 transition-all">
                Open <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <MiniStat label="Present" value={presentToday} tone="success" />
              <MiniStat label="Late" value={lateToday} tone="warning" />
              <MiniStat label="Half day" value={halfDayToday} tone="warning" />
              <MiniStat label="Not checked in" value={notCheckedIn} tone="muted" />
            </div>
            {(allAttQ.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No check-ins yet today.</p>
            ) : (
              <ul className="space-y-1 max-h-64 overflow-y-auto">
                {(allAttQ.data ?? []).slice(0, 8).map((r: any) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between p-2 -mx-1 rounded-md hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{r.profiles?.name || "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.check_in ? new Date(r.check_in).toLocaleTimeString() : "—"}
                        {r.check_out ? ` → ${new Date(r.check_out).toLocaleTimeString()}` : ""}
                      </div>
                    </div>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : (
        <section className="card-glass p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-lg">Recent tasks</h2>
            <span className="text-xs text-muted-foreground">
              {todoCount} todo · {inProgressCount} active · {doneCount} done
            </span>
          </div>
          {myTasksQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (myTasksQ.data ?? []).length === 0 ? (
            <div className="text-center py-10">
              <ListChecks className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No tasks assigned.</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {(myTasksQ.data ?? []).slice(0, 6).map((t) => (
                <li key={t.id}>
                  <Link
                    to={`/tasks/${t.id}`}
                    className="flex items-center justify-between p-3 -mx-2 rounded-lg hover:bg-muted/40 transition-colors group"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                        {t.title}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {t.priority} priority{t.due_date ? ` · due ${t.due_date}` : ""}
                      </div>
                    </div>
                    <StatusBadge status={t.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        )}

        <section className="card-glass p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-lg">Projects</h2>
            <Link to="/projects" className="text-sm text-primary inline-flex items-center gap-1 hover:gap-2 transition-all">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {projectsQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (projectsQ.data ?? []).length === 0 ? (
            <div className="text-center py-10">
              <FolderKanban className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No projects yet.</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {(projectsQ.data ?? []).slice(0, 6).map((p) => (
                <li key={p.id}>
                  <Link
                    to={`/projects/${p.id}`}
                    className="flex items-start gap-3 p-3 -mx-2 rounded-lg hover:bg-muted/40 transition-colors group"
                  >
                    <div className="h-9 w-9 rounded-lg bg-gradient-primary opacity-80 group-hover:opacity-100 group-hover:glow-primary transition-all flex items-center justify-center shrink-0">
                      <FolderKanban className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                        {p.name}
                      </div>
                      {p.description && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">{p.description}</div>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

const ACCENTS: Record<string, string> = {
  primary: "from-primary/20 to-primary/5 text-primary",
  secondary: "from-secondary/20 to-secondary/5 text-secondary",
  warning: "from-warning/20 to-warning/5 text-warning",
  success: "from-success/20 to-success/5 text-success",
};

function StatCard({
  label, value, icon: Icon, textValue, accent = "primary",
}: {
  label: string;
  value: number | string;
  icon: any;
  textValue?: boolean;
  accent?: keyof typeof ACCENTS | string;
}) {
  return (
    <div className="stat-card group">
      <div className="flex items-center justify-between relative z-10">
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
        <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${ACCENTS[accent] ?? ACCENTS.primary} flex items-center justify-center`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className={`text-3xl font-bold relative z-10 ${textValue ? "capitalize" : ""}`}>{value}</div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    todo: "bg-muted text-muted-foreground",
    in_progress: "bg-warning/15 text-warning",
    done: "bg-success/15 text-success",
    present: "bg-success/15 text-success",
    late: "bg-warning/15 text-warning",
    half_day: "bg-warning/15 text-warning",
    absent: "bg-muted text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={`${map[status] ?? ""} border-0 capitalize`}>
      {status.replace("_", " ")}
    </Badge>
  );
}

function QuickLink({
  to, label, desc, icon: Icon,
}: { to: string; label: string; desc: string; icon: any }) {
  return (
    <Link
      to={to}
      className="card-glass p-4 flex items-center gap-3 group hover:border-primary/40 transition-colors"
    >
      <div className="h-10 w-10 rounded-lg bg-gradient-primary opacity-80 group-hover:opacity-100 group-hover:glow-primary transition-all flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-primary-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold group-hover:text-primary transition-colors">{label}</div>
        <div className="text-xs text-muted-foreground truncate">{desc}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
    </Link>
  );
}

const TONES: Record<string, string> = {
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  muted: "bg-muted/40 text-muted-foreground border-border/40",
};

function MiniStat({ label, value, tone = "muted" }: { label: string; value: number; tone?: keyof typeof TONES }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${TONES[tone] ?? TONES.muted}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

export default Dashboard;
