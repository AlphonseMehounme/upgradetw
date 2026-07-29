import { adminClient, json, requireUser } from "../_shared/edgeAuth.ts";

Deno.serve(async (req) => {
  try {
    const userId = await requireUser(req);
    if (userId instanceof Response) return userId;

    const admin = adminClient();
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return json({ error: error.message }, 500);

    // auth.users' on-delete-cascade FKs remove profiles/schedules/sessions
    // (and later user_badges/leaderboard_stats) automatically — nothing
    // else to clean up here.
    return json({ ok: true }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
