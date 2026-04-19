import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getProjects } from "@/services/projects";
import { getMyTasks } from "@/services/tasks";
import { getTodayAttendance } from "@/services/attendance";
import { FolderKanban, ListChecks, Clock, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Dashboard = () => {
  const { user, isAdmin } = useAuth();

  const projectsQ = useQuery({ queryKey: ["projects"], queryFn: getProjects });
  const myTasksQ = useQuery({ queryKey: ["my-tasks", user?.id], queryFn: getMyTasks, enabled: !!user });
  const todayAttQ = useQuery({ queryKey: ["today-attendance", user?.id], queryFn: getTodayAttendance, enabled: !!user });

  const todoCount = (myTasksQ.data ?? []).filter((t) => t.status === "todo").length;
  const inProgressCount = (myTasksQ.data ?? []).filter((t) => t.status === "in_progress").length;
  const doneCount = (myTasksQ.data ?? []).filter((t) => t.status === "done").length;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome back{isAdmin ? " · Administrator" : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Projects" value={projectsQ.data?.length ?? 0} icon={FolderKanban} />
        <StatCard label="My tasks" value={myTasksQ.data?.length ?? 0} icon={ListChecks} />
        <StatCard label="In progress" value={inProgressCount} icon={ListChecks} accent="warning" />
        <StatCard
          label="Today's attendance"
          value={todayAttQ.data?.status ?? "—"}
          icon={Clock}
          textValue
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card-elevated p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Recent tasks</h2>
            <span className="text-xs text-muted-foreground">
              {todoCount} todo · {inProgressCount} in progress · {doneCount} done
            </span>
          </div>
          {myTasksQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (myTasksQ.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks assigned.</p>
          ) : (
            <ul className="divide-y divide-border">
              {(myTasksQ.data ?? []).slice(0, 6).map((t) => (
                <li key={t.id}>
                  <Link
                    to={`/tasks/${t.id}`}
                    className="flex items-center justify-between py-3 hover:opacity-80"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{t.title}</div>
                      <div className="text-xs text-muted-foreground">
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

        <section className="card-elevated p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Projects</h2>
            <Link to="/projects" className="text-sm text-primary inline-flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {projectsQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (projectsQ.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {(projectsQ.data ?? []).slice(0, 6).map((p) => (
                <li key={p.id}>
                  <Link to={`/projects/${p.id}`} className="block py-3 hover:opacity-80">
                    <div className="text-sm font-medium">{p.name}</div>
                    {p.description && (
                      <div className="text-xs text-muted-foreground truncate">{p.description}</div>
                    )}
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

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  textValue,
}: {
  label: string;
  value: number | string;
  icon: any;
  accent?: "warning" | "success";
  textValue?: boolean;
}) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className={`text-2xl font-semibold ${textValue ? "capitalize" : ""}`}>{value}</div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    todo: "bg-muted text-muted-foreground",
    in_progress: "bg-warning/15 text-warning",
    done: "bg-success/15 text-success",
  };
  return (
    <Badge variant="outline" className={`${map[status] ?? ""} border-0 capitalize`}>
      {status.replace("_", " ")}
    </Badge>
  );
}

export default Dashboard;
