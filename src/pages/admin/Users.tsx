import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { adminCreateUser, adminUpdateUser, adminToggleUserActive, listUsers, type UserRow } from "@/services/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Shield, User as UserIcon, Eye, EyeOff, UserX, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface CreateValues {
  email: string; name: string; password: string; role: "admin" | "user"; job_position: string;
}
interface EditValues {
  name: string; role: "admin" | "user"; password: string; job_position: string;
}

const Users = () => {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [showCreatePwd, setShowCreatePwd] = useState(false);
  const [showEditPwd, setShowEditPwd] = useState(false);

  const usersQ = useQuery({ queryKey: ["users"], queryFn: listUsers });

  const createForm = useForm<CreateValues>({ defaultValues: { role: "user", job_position: "" } });
  const editForm = useForm<EditValues>();

  const createMut = useMutation({
    mutationFn: adminCreateUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User created");
      setCreateOpen(false); createForm.reset({ role: "user", job_position: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (input: { user_id: string; name?: string; role?: "admin" | "user"; password?: string }) =>
      adminUpdateUser(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User updated");
      setEditing(null); editForm.reset();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActiveMut = useMutation({
    mutationFn: ({ user_id, is_active }: { user_id: string; is_active: boolean }) =>
      adminToggleUserActive(user_id, is_active),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success(vars.is_active ? "User reactivated" : "User deactivated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (u: UserRow) => {
    setEditing(u);
    editForm.reset({ name: u.name, role: u.role, password: "", job_position: u.job_position ?? "" });
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">Create and manage team members</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> New user</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create user</DialogTitle>
              <DialogDescription className="sr-only">Create a new user for the team.</DialogDescription>
            </DialogHeader>
            <form onSubmit={createForm.handleSubmit((v) => createMut.mutate(v))} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="create-name">Name</Label>
                <Input id="create-name" autoComplete="name" {...createForm.register("name", { required: true, maxLength: 100 })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-email">Email</Label>
                <Input id="create-email" type="email" autoComplete="email" {...createForm.register("email", { required: true, maxLength: 255 })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-job">Job position</Label>
                <Input
                  id="create-job"
                  autoComplete="organization-title"
                  placeholder="e.g. Frontend Developer"
                  {...createForm.register("job_position", { maxLength: 100 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-password">Temporary password</Label>
                <div className="relative">
                  <Input
                    id="create-password"
                    type={showCreatePwd ? "text" : "password"}
                    autoComplete="new-password"
                    className="pr-10"
                    {...createForm.register("password", { required: true, minLength: 8, maxLength: 128 })}
                  />
                  <button
                    id="create-pwd-toggle"
                    name="create-pwd-toggle"
                    type="button"
                    onClick={() => setShowCreatePwd((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showCreatePwd ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showCreatePwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Min 8 characters. Share with the user securely.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-role">Role</Label>
                <Select
                  name="create-role"
                  value={createForm.watch("role")}
                  onValueChange={(v) => createForm.setValue("role", v as "admin" | "user")}
                >
                  <SelectTrigger id="create-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button id="create-user-btn" name="create-user-btn" type="submit" disabled={createMut.isPending}>Create</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="card-elevated overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground bg-muted/40">
            <tr>
              <th className="text-left px-6 py-3">Name</th>
              <th className="text-left px-6 py-3">Job position</th>
              <th className="text-left px-6 py-3">Email</th>
              <th className="text-left px-6 py-3">Role</th>
              <th className="text-left px-6 py-3">Status</th>
              <th className="text-left px-6 py-3">Created</th>
              <th className="text-right px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(usersQ.data ?? []).map((u) => (
              <tr
                key={u.id}
                className={`border-t border-border transition-colors ${
                  u.is_active ? "" : "opacity-50 bg-muted/20"
                }`}
              >
                <td className="px-6 py-3 font-medium">{u.name || "—"}</td>
                <td className="px-6 py-3 text-muted-foreground">{u.job_position || "—"}</td>
                <td className="px-6 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-6 py-3">
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md ${
                    u.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}>
                    {u.role === "admin" ? <Shield className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
                    {u.role}
                  </span>
                </td>
                <td className="px-6 py-3">
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                    u.is_active
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-destructive/15 text-destructive"
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      u.is_active ? "bg-emerald-500" : "bg-destructive"
                    }`} />
                    {u.is_active ? "Active" : "Deactivated"}
                  </span>
                </td>
                <td className="px-6 py-3 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-6 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>Edit</Button>
                    {u.is_active ? (
                      <ConfirmDialog
                        trigger={
                          <Button
                            variant="ghost" size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={toggleActiveMut.isPending}
                          >
                            <UserX className="h-3.5 w-3.5 mr-1" /> Deactivate
                          </Button>
                        }
                        title={`Deactivate ${u.name || u.email}?`}
                        description="This user will be immediately signed out and blocked from logging in. You can reactivate them at any time."
                        confirmLabel="Deactivate"
                        onConfirm={() => toggleActiveMut.mutate({ user_id: u.id, is_active: false })}
                      />
                    ) : (
                      <Button
                        variant="ghost" size="sm"
                        className="text-emerald-500 hover:text-emerald-500"
                        disabled={toggleActiveMut.isPending}
                        onClick={() => toggleActiveMut.mutate({ user_id: u.id, is_active: true })}
                      >
                        <UserCheck className="h-3.5 w-3.5 mr-1" /> Reactivate
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {(usersQ.data ?? []).length === 0 && !usersQ.isLoading && (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No users yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription className="sr-only">Edit user details and access.</DialogDescription>
          </DialogHeader>
          {editing && (
            <form
              onSubmit={editForm.handleSubmit((v) => {
                const payload: any = {
                  user_id: editing.id,
                  name: v.name,
                  role: v.role,
                  job_position: v.job_position,
                };
                if (v.password) payload.password = v.password;
                updateMut.mutate(payload);
              })}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input id="edit-name" autoComplete="name" {...editForm.register("name", { required: true, maxLength: 100 })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-job">Job position</Label>
                <Input
                  id="edit-job"
                  autoComplete="organization-title"
                  placeholder="e.g. Frontend Developer"
                  {...editForm.register("job_position", { maxLength: 100 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role">Role</Label>
                <Select
                  name="edit-role"
                  value={editForm.watch("role")}
                  onValueChange={(v) => editForm.setValue("role", v as "admin" | "user")}
                >
                  <SelectTrigger id="edit-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-password">New password (optional)</Label>
                <div className="relative">
                  <Input
                    id="edit-password"
                    type={showEditPwd ? "text" : "password"}
                    autoComplete="new-password"
                    className="pr-10"
                    {...editForm.register("password", { maxLength: 128 })}
                  />
                  <button
                    id="edit-pwd-toggle"
                    name="edit-pwd-toggle"
                    type="button"
                    onClick={() => setShowEditPwd((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showEditPwd ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showEditPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Leave blank to keep current password.</p>
              </div>
              <DialogFooter>
                <Button id="edit-user-btn" name="edit-user-btn" type="submit" disabled={updateMut.isPending}>Save</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Users;
