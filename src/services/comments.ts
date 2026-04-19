import { supabase } from "@/integrations/supabase/client";

export async function getComments(taskId: string) {
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const userIds = Array.from(new Set((data ?? []).map((c) => c.user_id)));
  let profiles: Record<string, { name: string; email: string }> = {};
  if (userIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, name, email")
      .in("id", userIds);
    profiles = Object.fromEntries(
      (profs ?? []).map((p) => [p.id, { name: p.name, email: p.email }]),
    );
  }
  return (data ?? []).map((c) => ({ ...c, profiles: profiles[c.user_id] ?? null }));
}

export async function addComment(taskId: string, content: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("comments")
    .insert({ task_id: taskId, content, user_id: auth.user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}
