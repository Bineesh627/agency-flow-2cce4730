import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { createProject, deleteProject, getProjects } from "@/services/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, FolderKanban, ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

interface FormValues { name: string; description: string; }

const Projects = () => {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const projectsQ = useQuery({ queryKey: ["projects"], queryFn: getProjects });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>();

  const createMut = useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project created");
      setOpen(false);
      reset();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gradient">Projects</h1>
          <p className="text-sm text-muted-foreground mt-2">All agency projects in one place</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="btn-gradient"><Plus className="h-4 w-4 mr-2" /> New project</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create project</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit((v) => createMut.mutate(v))} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" {...register("name", { required: "Required", maxLength: 120 })} />
                  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" {...register("description", { maxLength: 1000 })} />
                </div>
                <DialogFooter>
                  <Button type="submit" className="btn-gradient" disabled={createMut.isPending}>Create</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {projectsQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (projectsQ.data ?? []).length === 0 ? (
        <div className="card-glass p-16 text-center">
          <div className="h-16 w-16 rounded-2xl bg-gradient-primary opacity-50 mx-auto mb-4 flex items-center justify-center">
            <FolderKanban className="h-8 w-8 text-primary-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No projects yet. {isAdmin && "Click 'New project' to create one."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(projectsQ.data ?? []).map((p) => (
            <div key={p.id} className="card-glass p-5 group hover:border-primary/40 transition-all hover:-translate-y-0.5 relative overflow-hidden">
              <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-gradient-primary opacity-0 group-hover:opacity-10 blur-2xl transition-opacity" />
              <div className="flex items-start justify-between gap-2 relative">
                <Link to={`/projects/${p.id}`} className="min-w-0 flex-1">
                  <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center mb-3 group-hover:glow-primary transition-shadow">
                    <FolderKanban className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <h3 className="font-semibold text-lg truncate group-hover:text-primary transition-colors">
                    {p.name}
                  </h3>
                  {p.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {p.description}
                    </p>
                  )}
                </Link>
                {isAdmin && (
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => {
                      if (confirm(`Delete project "${p.name}"? This will delete all its tasks.`)) {
                        deleteMut.mutate(p.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                )}
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/40 relative">
                <span className="text-xs text-muted-foreground">
                  {new Date(p.created_at).toLocaleDateString()}
                </span>
                <Link to={`/projects/${p.id}`} className="text-xs text-primary inline-flex items-center gap-1 hover:gap-2 transition-all">
                  Open <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Projects;
