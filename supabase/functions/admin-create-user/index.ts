import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CreateUserPayload {
  email: string;
  password: string;
  name: string;
  role: "admin" | "user";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller via JWT claims (signing-keys compatible)
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsRes, error: claimsErr } = await userClient.auth
      .getClaims(token);
    const callerId = claimsRes?.claims?.sub;
    if (claimsErr || !callerId) {
      return json({ error: "Unauthorized" }, 401);
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE);

    // Check caller is admin
    const { data: isAdmin, error: roleErr } = await adminClient.rpc(
      "has_role",
      { _user_id: callerId, _role: "admin" },
    );
    if (roleErr || !isAdmin) {
      return json({ error: "Forbidden: admin only" }, 403);
    }

    const payload = (await req.json()) as CreateUserPayload;
    if (!payload?.email || !payload?.password || !payload?.name || !payload?.role) {
      return json({ error: "Missing fields" }, 400);
    }
    if (payload.password.length < 8) {
      return json({ error: "Password must be at least 8 characters" }, 400);
    }
    if (!["admin", "user"].includes(payload.role)) {
      return json({ error: "Invalid role" }, 400);
    }

    // Create user
    const { data: created, error: createErr } = await adminClient.auth.admin
      .createUser({
        email: payload.email,
        password: payload.password,
        email_confirm: true,
        user_metadata: { name: payload.name },
      });

    if (createErr || !created.user) {
      return json({ error: createErr?.message ?? "Failed to create user" }, 400);
    }

    // Trigger handle_new_user inserted profile + 'user' role.
    // If admin, add admin role too (and we keep 'user' for safety).
    if (payload.role === "admin") {
      await adminClient.from("user_roles").insert({
        user_id: created.user.id,
        role: "admin",
      });
    }

    // Ensure profile name reflects the input (in case metadata path missed)
    await adminClient.from("profiles").update({ name: payload.name }).eq(
      "id",
      created.user.id,
    );

    return json({ user: { id: created.user.id, email: created.user.email } });
  } catch (e) {
    console.error("admin-create-user error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
