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
import { Plus, Trash2, FolderKanban } from "lucide-react";
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">All agency projects</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> New project</Button>
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
                  <Button type="submit" disabled={createMut.isPending}>Create</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {projectsQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (projectsQ.data ?? []).length === 0 ? (
        <div className="card-elevated p-12 text-center">
          <FolderKanban className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No projects yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(projectsQ.data ?? []).map((p) => (
            <div key={p.id} className="card-elevated p-5 group">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/projects/${p.id}`} className="min-w-0 flex-1">
                  <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
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
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-4">
                Created {new Date(p.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Projects;
