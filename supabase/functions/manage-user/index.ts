import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "Método no permitido" });

  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return reply(401, { error: "Debes iniciar sesión" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return reply(500, { error: "La función no tiene configuradas sus credenciales internas" });
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return reply(401, { error: "Sesión no válida o vencida" });

  const { data: caller, error: callerError } = await adminClient
    .from("profiles")
    .select("role, active")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (callerError) return reply(500, { error: "No se pudo validar el nivel de acceso" });
  if (!caller || caller.active !== true || caller.role !== "owner") {
    return reply(403, { error: "Solo un administrador activo puede crear usuarios" });
  }

  let body: { full_name?: string; email?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: "La solicitud no contiene datos válidos" });
  }

  const fullName = String(body.full_name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const role = body.role;

  if (fullName.length < 2 || fullName.length > 100) {
    return reply(400, { error: "Escribe un nombre entre 2 y 100 caracteres" });
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return reply(400, { error: "Escribe un correo electrónico válido" });
  }
  if (role !== "owner" && role !== "cashier") {
    return reply(400, { error: "El nivel de acceso seleccionado no es válido" });
  }

  const inviteOptions: { data: { full_name: string }; redirectTo?: string } = {
    data: { full_name: fullName },
  };
  const redirectTo = Deno.env.get("APP_SITE_URL");
  if (redirectTo) inviteOptions.redirectTo = redirectTo;

  const { data: inviteData, error: inviteError } = await adminClient.auth.admin
    .inviteUserByEmail(email, inviteOptions);

  if (inviteError || !inviteData.user) {
    return reply(400, {
      error: inviteError?.message || "No se pudo crear la invitación",
    });
  }

  const newUser = inviteData.user;
  const { error: profileError } = await adminClient
    .from("profiles")
    .upsert(
      { id: newUser.id, full_name: fullName, role, active: true },
      { onConflict: "id" },
    );

  if (profileError) {
    await adminClient.auth.admin.deleteUser(newUser.id);
    return reply(500, { error: "No se pudo asignar el nivel de acceso; la invitación fue revertida" });
  }

  return reply(200, {
    ok: true,
    user: { id: newUser.id, email, full_name: fullName, role },
    message: "Invitación enviada. El usuario debe abrir el correo y establecer su contraseña.",
  });
});
