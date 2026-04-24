import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getTask, updateTaskStatus, type TaskStatus } from "@/services/tasks";
import { addComment, getComments } from "@/services/comments";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "./Dashboard";

const TaskDetail = () => {
  const { id } = useParams();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [content, setContent] = useState("");

  const taskQ = useQuery({ queryKey: ["task", id], queryFn: () => getTask(id!), enabled: !!id });
  const commentsQ = useQuery({ queryKey: ["comments", id], queryFn: () => getComments(id!), enabled: !!id });

  const statusMut = useMutation({
    mutationFn: (status: TaskStatus) => updateTaskStatus(id!, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task", id] });
      toast.success("Status updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const commentMut = useMutation({
    mutationFn: () => addComment(id!, content.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments", id] });
      setContent("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!taskQ.isLoading && !taskQ.data) return <div className="p-8">Task not found.</div>;
  const t = taskQ.data;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto animate-fade-in">
      <Link to={t ? `/projects/${t.project_id}` : "/projects"} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      {t && (
        <>
          <div className="card-elevated p-6 mb-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <h1 className="text-xl font-semibold">{t.title}</h1>
              <StatusBadge status={t.status} />
            </div>
            {t.description && (
              <p className="text-sm text-foreground/80 whitespace-pre-wrap mb-4">{t.description}</p>
            )}
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mb-4">
              <span>Priority: <span className="capitalize text-foreground">{t.priority}</span></span>
              {t.due_date && <span>Due: <span className="text-foreground">{t.due_date}</span></span>}
              <span>Created: {new Date(t.created_at).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Update status:</span>
              <Select value={t.status} onValueChange={(v) => statusMut.mutate(v as TaskStatus)}>
                <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">Todo</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="card-elevated p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold">Comments</h2>
              <span className="text-xs text-muted-foreground">({commentsQ.data?.length ?? 0})</span>
            </div>

            <div className="space-y-3 mb-4">
              {(commentsQ.data ?? []).map((c: any) => (
                <div key={c.id} className="bg-muted/40 rounded-md p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">
                      {c.profiles?.name || c.profiles?.email || (c.user_id === user?.id ? "You" : "User")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                </div>
              ))}
              {(commentsQ.data ?? []).length === 0 && !commentsQ.isLoading && (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (content.trim().length === 0) return;
                if (content.length > 2000) return toast.error("Comment too long");
                commentMut.mutate();
              }}
              className="space-y-2"
            >
              <Label htmlFor="comment" className="sr-only">Comment</Label>
              <Textarea
                id="comment"
                name="comment"
                autoComplete="off"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write a comment…"
                rows={3}
                maxLength={2000}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={commentMut.isPending || !content.trim()}>
                  Post comment
                </Button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
};

export default TaskDetail;
