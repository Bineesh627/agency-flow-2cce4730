import { createClient } from "https://esm.sh/@supabase/supabase-js@2.103.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface UpdatePayload {
  user_id: string;
  name?: string;
  role?: "admin" | "user";
  password?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);

    const adminClient = createClient(SUPABASE_URL, SERVICE);
    const { data: isAdmin, error: roleErr } = await adminClient.rpc("has_role", {
      _user_id: claims.claims.sub,
      _role: "admin",
    });
    if (roleErr || !isAdmin) return json({ error: "Forbidden" }, 403);

    const payload = (await req.json()) as UpdatePayload;
    if (!payload?.user_id) return json({ error: "Missing user_id" }, 400);

    if (payload.password && payload.password.length < 8) {
      return json({ error: "Password must be at least 8 characters" }, 400);
    }

    if (payload.password) {
      const { error } = await adminClient.auth.admin.updateUserById(
        payload.user_id,
        { password: payload.password },
      );
      if (error) return json({ error: error.message }, 400);
    }

    if (payload.name !== undefined) {
      const { error } = await adminClient.from("profiles").update({
        name: payload.name,
      }).eq("id", payload.user_id);
      if (error) return json({ error: error.message }, 400);
    }

    if (payload.role) {
      // Reset roles for that user, then add the requested one (+ keep 'user')
      await adminClient.from("user_roles").delete().eq("user_id", payload.user_id);
      const rolesToInsert = payload.role === "admin"
        ? [{ user_id: payload.user_id, role: "user" }, { user_id: payload.user_id, role: "admin" }]
        : [{ user_id: payload.user_id, role: "user" }];
      const { error } = await adminClient.from("user_roles").insert(rolesToInsert);
      if (error) return json({ error: error.message }, 400);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("admin-update-user error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
