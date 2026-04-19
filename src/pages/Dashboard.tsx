import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getProjects } from "@/services/projects";
import { getMyTasks } from "@/services/tasks";
import { getTodayAttendance } from "@/services/attendance";
import { FolderKanban, ListChecks, Clock, ArrowRight, Sparkles, Activity } from "lucide-react";
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
        <div className="inline-flex items-center gap-2 text-xs text-primary/80 bg-primary/10 border border-primary/20 rounded-full px-3 py-1 mb-3">
          <Sparkles className="h-3 w-3" />
          {isAdmin ? "Administrator workspace" : "Welcome back"}
        </div>
        <h1 className="text-4xl font-bold text-gradient">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Here's what's happening across your projects today.
        </p>
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
  };
  return (
    <Badge variant="outline" className={`${map[status] ?? ""} border-0 capitalize`}>
      {status.replace("_", " ")}
    </Badge>
  );
}

export default Dashboard;
