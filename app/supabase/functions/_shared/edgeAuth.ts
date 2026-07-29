import { createClient } from "npm:@supabase/supabase-js@2";

export function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/** Verifies the caller's JWT against their own Authorization header.
    Returns the authenticated user id, or a Response to return immediately
    on failure — never trust a user id taken from the request body. */
export async function requireUser(req: Request): Promise<string | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  const callerClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data, error } = await callerClient.auth.getUser();
  if (error || !data?.user) return json({ error: "Invalid session" }, 401);
  return data.user.id;
}
