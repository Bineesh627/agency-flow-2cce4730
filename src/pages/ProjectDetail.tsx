import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useAuth } from "@/hooks/useAuth";
import { getProject } from "@/services/projects";
import {
  createTask, deleteTask, getTasksForProject, updateTaskStatus,
  type TaskPriority, type TaskStatus,
} from "@/services/tasks";
import { listUsers } from "@/services/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, ArrowLeft, Trash2, KanbanSquare, GanttChart, Folder } from "lucide-react";
import { toast } from "sonner";
import { ProjectTimeline } from "@/components/projects/ProjectTimeline";
import { ProjectDocuments } from "@/components/projects/ProjectDocuments";

interface FormValues {
  title: string;
  description: string;
  priority: TaskPriority;
  assigned_to: string;
  due_date: string;
}

const STATUSES: TaskStatus[] = ["todo", "in_progress", "done"];

const ProjectDetail = () => {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const projectQ = useQuery({ queryKey: ["project", id], queryFn: () => getProject(id!), enabled: !!id });
  const tasksQ = useQuery({ queryKey: ["project-tasks", id], queryFn: () => getTasksForProject(id!), enabled: !!id });
  const usersQ = useQuery({ queryKey: ["users"], queryFn: listUsers, enabled: isAdmin });

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormValues>({
    defaultValues: { priority: "medium", assigned_to: "", due_date: "", title: "", description: "" },
  });

  const createMut = useMutation({
    mutationFn: (v: FormValues) =>
      createTask({
        title: v.title,
        description: v.description || undefined,
        priority: v.priority,
        project_id: id!,
        assigned_to: v.assigned_to || null,
        due_date: v.due_date || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-tasks", id] });
      toast.success("Task created");
      setOpen(false); reset();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      updateTaskStatus(taskId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-tasks", id] }),
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-tasks", id] });
      toast.success("Task deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!projectQ.isLoading && !projectQ.data) {
    return <div className="p-8">Project not found.</div>;
  }

  const tasks = tasksQ.data ?? [];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in">
      <Link to="/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors mb-4">
        <ArrowLeft className="h-4 w-4" /> Projects
      </Link>
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gradient">{projectQ.data?.name ?? "…"}</h1>
          {projectQ.data?.description && (
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{projectQ.data.description}</p>
          )}
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="btn-gradient"><Plus className="h-4 w-4 mr-2" /> New task</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create task</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit((v) => createMut.mutate(v))} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" {...register("title", { required: "Required", maxLength: 200 })} />
                  {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" {...register("description", { maxLength: 2000 })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={watch("priority")} onValueChange={(v) => setValue("priority", v as TaskPriority)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="due_date">Due date</Label>
                    <Input id="due_date" type="date" {...register("due_date")} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Assigned to</Label>
                  <Select value={watch("assigned_to")} onValueChange={(v) => setValue("assigned_to", v)}>
                    <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>
                      {(usersQ.data ?? []).map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="submit" className="btn-gradient" disabled={createMut.isPending}>Create</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="kanban" className="w-full">
        <TabsList className="bg-card/60 backdrop-blur-md border border-border/60">
          <TabsTrigger value="kanban" className="data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground">
            <KanbanSquare className="h-4 w-4 mr-2" /> Kanban
          </TabsTrigger>
          <TabsTrigger value="timeline" className="data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground">
            <GanttChart className="h-4 w-4 mr-2" /> Timeline
          </TabsTrigger>
          <TabsTrigger value="documents" className="data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground">
            <Folder className="h-4 w-4 mr-2" /> Documents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {STATUSES.map((status) => {
              const colTasks = tasks.filter((t) => t.status === status);
              return (
                <div key={status} className="card-glass p-3 min-h-[300px]">
                  <div className="flex items-center justify-between px-2 mb-3">
                    <h3 className="font-medium capitalize flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${
                        status === "todo" ? "bg-muted-foreground" :
                        status === "in_progress" ? "bg-warning animate-pulse-glow" :
                        "bg-success"
                      }`} />
                      {status.replace("_", " ")}
                    </h3>
                    <span className="text-xs text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-md">{colTasks.length}</span>
                  </div>
                  <div className="space-y-2">
                    {colTasks.map((t) => (
                      <div key={t.id} className="bg-card/70 backdrop-blur-md border border-border/60 rounded-lg p-3 group hover:border-primary/40 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <Link to={`/tasks/${t.id}`} className="text-sm font-medium hover:text-primary min-w-0 flex-1 truncate">
                            {t.title}
                          </Link>
                          {isAdmin && (
                            <button
                              onClick={() => confirm(`Delete "${t.title}"?`) && deleteMut.mutate(t.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className={`text-xs capitalize px-1.5 py-0.5 rounded ${
                            t.priority === "high" ? "bg-destructive/15 text-destructive" :
                            t.priority === "medium" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"
                          }`}>
                            {t.priority}
                          </span>
                          {t.due_date && <span className="text-xs text-muted-foreground">{t.due_date}</span>}
                        </div>
                        <Select
                          value={t.status}
                          onValueChange={(v) => statusMut.mutate({ taskId: t.id, status: v as TaskStatus })}
                        >
                          <SelectTrigger className="h-7 mt-2 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todo">Todo</SelectItem>
                            <SelectItem value="in_progress">In progress</SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                    {colTasks.length === 0 && (
                      <div className="text-xs text-muted-foreground text-center py-8">No tasks</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          <ProjectTimeline projectId={id!} tasks={tasks} canDrag={isAdmin} />
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <ProjectDocuments projectId={id!} isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProjectDetail;
