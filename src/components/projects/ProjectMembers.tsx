import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addProjectMember, getProjectMembers, removeProjectMember } from "@/services/members";
import { listUsers } from "@/services/users";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Users as UsersIcon, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

export function ProjectMembers({ projectId, isAdmin }: { projectId: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>("");

  const membersQ = useQuery({
    queryKey: ["project-members", projectId],
    queryFn: () => getProjectMembers(projectId),
  });
  const usersQ = useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
    enabled: isAdmin,
  });

  const addMut = useMutation({
    mutationFn: (userId: string) => addProjectMember(projectId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-members", projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      setSelectedId("");
      toast.success("Member added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: removeProjectMember,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-members", projectId] });
      toast.success("Member removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const memberIds = new Set((membersQ.data ?? []).map((m) => m.user_id));
  // Only non-admin users can be added as members (admins see everything anyway)
  const candidates = (usersQ.data ?? []).filter(
    (u) => u.role !== "admin" && !memberIds.has(u.id),
  );

  return (
    <div className="card-glass p-5 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <UsersIcon className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Project members</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          {(membersQ.data ?? []).length} {((membersQ.data ?? []).length === 1) ? "member" : "members"}
        </span>
      </div>

      {isAdmin && (
        <div className="flex gap-2 mb-4">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={candidates.length === 0 ? "No more users to add" : "Select a user…"} />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name || u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => selectedId && addMut.mutate(selectedId)}
            disabled={!selectedId || addMut.isPending}
            size="sm"
            className="btn-gradient"
          >
            <UserPlus className="h-4 w-4 mr-1.5" /> Add
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {(membersQ.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {isAdmin
              ? "No members yet. Add users so they can see this project."
              : "No members assigned yet."}
          </p>
        ) : (
          (membersQ.data ?? []).map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between bg-card/60 border border-border/40 rounded-lg px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  {m.profile?.name || m.profile?.email || m.user_id}
                </div>
                {isAdmin && m.profile?.email && (
                  <div className="text-xs text-muted-foreground truncate">{m.profile.email}</div>
                )}
              </div>
              {isAdmin && (
                <button
                  onClick={() => confirm("Remove this member?") && removeMut.mutate(m.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  title="Remove member"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
