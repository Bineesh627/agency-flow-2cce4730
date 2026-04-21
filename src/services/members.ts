import { supabase } from "@/integrations/supabase/client";

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  created_at: string;
  profile?: { name: string; email: string } | null;
}

export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const { data, error } = await supabase
    .from("project_members")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const ids = Array.from(new Set((data ?? []).map((m) => m.user_id)));
  let profileMap: Record<string, { name: string; email: string }> = {};
  if (ids.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, name, email")
      .in("id", ids);
    profileMap = Object.fromEntries(
      (profs ?? []).map((p) => [p.id, { name: p.name, email: p.email }]),
    );
  }
  return (data ?? []).map((m) => ({ ...m, profile: profileMap[m.user_id] ?? null }));
}

export async function addProjectMember(projectId: string, userId: string) {
  const { data, error } = await supabase
    .from("project_members")
    .insert({ project_id: projectId, user_id: userId, role: "member" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeProjectMember(memberId: string) {
  const { error } = await supabase.from("project_members").delete().eq("id", memberId);
  if (error) throw error;
}
