import { supabase } from "@/integrations/supabase/client";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  job_position: string;
  role: "admin" | "user";
  is_active: boolean;
  created_at: string;
}

export async function listUsers(): Promise<UserRow[]> {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const { data: roles, error: e2 } = await supabase
    .from("user_roles")
    .select("user_id, role");
  if (e2) throw e2;

  return (profiles ?? []).map((p) => {
    const userRoles = (roles ?? []).filter((r) => r.user_id === p.id);
    const role = userRoles.some((r) => r.role === "admin") ? "admin" : "user";
    return {
      id: p.id,
      name: p.name,
      email: p.email,
      job_position: (p as any).job_position ?? "",
      is_active: (p as any).is_active !== false, // default true if column missing
      role,
      created_at: p.created_at,
    };
  });
}

export async function adminCreateUser(input: {
  email: string;
  password: string;
  name: string;
  role: "admin" | "user";
  job_position?: string;
}) {
  const { data, error } = await supabase.functions.invoke("admin-create-user", {
    body: input,
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}

export async function adminUpdateUser(input: {
  user_id: string;
  name?: string;
  role?: "admin" | "user";
  password?: string;
  job_position?: string;
}) {
  const { data, error } = await supabase.functions.invoke("admin-update-user", {
    body: input,
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}

export async function adminToggleUserActive(user_id: string, is_active: boolean) {
  const { data, error } = await supabase.functions.invoke("admin-update-user", {
    body: { user_id, is_active },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}
