import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_CASHIER_PERMISSIONS = {
  dashboard: { view: true },
  members: { view: true, create: true, update: true },
  attendance: { view: true, create: true },
  day_pass: { view: true, create: true },
  payments: { view: true, create: true, update: true },
  sales: { view: true, create: true, update: true },
  products: { view: true },
  cash: { view: true, create: true, close: true },
  reports: { view: true },
};

const ALLOWED_PERMISSIONS: Record<string, string[]> = {
  dashboard: ["view"], members: ["view", "create", "update"], plans: ["view", "create", "update"],
  attendance: ["view", "create"], day_pass: ["view", "create"], payments: ["view", "create", "update"],
  sales: ["view", "create", "update"], sales_adjustments: ["view", "create", "update"],
  receivables_sales: ["view", "update"], price_lists: ["view", "create", "update"],
  evolutions: ["view", "create", "update"], routines: ["view", "create", "update"],
  exercises: ["view", "create", "update"], suppliers: ["view", "create", "update"],
  employees: ["view", "create", "update"], purchases: ["view", "create", "update"],
  payables_purchases: ["view", "update"], supporting_documents: ["view", "create", "update"],
  purchase_adjustments: ["view", "create", "update"], expense_types: ["view", "create", "update"],
  expenses: ["view", "create", "update"], receivables_adjustments: ["view", "create", "update"],
  product_categories: ["view", "create", "update"], products: ["view", "create", "update"],
  inventory_adjustments: ["view", "create"], inventory_counts: ["view", "create", "update"],
  inventory_ledger: ["view"], booking_settings: ["view", "create", "update"],
  classes: ["view", "create", "update"], reservations: ["view", "create", "update"],
  branch: ["view", "update"], navigation: ["view", "update"], roles: ["view", "update"],
  users: ["view", "create", "update"], email_settings: ["view"], email_templates: ["view", "create", "update"],
  notifications: ["view", "create", "update"], email_history: ["view"],
  cash: ["view", "create", "close"], reports: ["view"], audit: ["view"], settings: ["view", "update"],
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function validatePermissions(raw: unknown) {
  if (raw == null) return DEFAULT_CASHIER_PERMISSIONS;
  if (typeof raw !== "object" || Array.isArray(raw)) throw new Error("El formato de permisos no es válido.");
  const normalized: Record<string, Record<string, boolean>> = {};
  for (const [moduleKey, actions] of Object.entries(raw as Record<string, unknown>)) {
    const allowed = ALLOWED_PERMISSIONS[moduleKey];
    if (!allowed || typeof actions !== "object" || actions === null || Array.isArray(actions)) {
      throw new Error("Se ha seleccionado un módulo o permiso no reconocido.");
    }
    const modulePermissions: Record<string, boolean> = {};
    for (const [action, enabled] of Object.entries(actions as Record<string, unknown>)) {
      if (!allowed.includes(action) || typeof enabled !== "boolean") {
        throw new Error("Una de las acciones seleccionadas no es válida.");
      }
      modulePermissions[action] = enabled;
    }
    normalized[moduleKey] = modulePermissions;
  }
  return normalized;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "Método no permitido" });

  const authorization = req.headers.get("Authorization") || "";
  const token = authorization.replace(/^Bearer\\s+/i, "");
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

  let body: { full_name?: string; email?: string; role?: string; permissions?: unknown };
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
  if (email.length > 254 || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
    return reply(400, { error: "Escribe un correo electrónico válido" });
  }
  if (role !== "owner" && role !== "cashier") {
    return reply(400, { error: "El nivel de acceso seleccionado no es válido" });
  }

  let permissions: Record<string, Record<string, boolean>>;
  try {
    permissions = role === "owner" ? {} : validatePermissions(body.permissions);
  } catch (error) {
    return reply(400, { error: error instanceof Error ? error.message : "Permisos inválidos" });
  }

  const inviteOptions: { data: Record<string, unknown>; redirectTo?: string } = {
    data: { full_name: fullName, access_role: role, terms_version: "2026-11-15.1" },
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
      { id: newUser.id, full_name: fullName, email, role, permissions, active: true },
      { onConflict: "id" },
    );

  if (profileError) {
    await adminClient.auth.admin.deleteUser(newUser.id);
    return reply(500, { error: "No se pudo asignar el nivel de acceso; la invitación fue revertida" });
  }

  const { error: historyError } = await adminClient.from("user_permission_history").insert({
    user_id: newUser.id,
    changed_by: authData.user.id,
    previous_permissions: {},
    new_permissions: permissions,
    permissions_version: 1,
  });
  if (historyError) {
    await adminClient.from("profiles").delete().eq("id", newUser.id);
    await adminClient.auth.admin.deleteUser(newUser.id);
    return reply(500, { error: "No se pudo registrar el historial de permisos; la invitación fue revertida" });
  }

  // Log the request, not delivery: successful invitation creation does not prove SMTP delivery.
  await adminClient.from("gym_records").insert({
    record_type: "Historial de Correos",
    module_key: "email_history",
    title: "Invitación de acceso solicitada",
    person_name: fullName,
    email,
    record_date: new Date().toISOString().slice(0, 10),
    status: "Solicitud aceptada por Supabase Auth",
    notes: "La entrega del correo depende de la configuración SMTP del proyecto.",
    details: { role, permissions, user_id: newUser.id },
    created_by: authData.user.id,
  });

  return reply(200, {
    ok: true,
    user: { id: newUser.id, email, full_name: fullName, role, permissions },
    message: "Invitación creada. La persona debe abrir el correo, activar su cuenta y aceptar los términos de uso.",
  });
});
