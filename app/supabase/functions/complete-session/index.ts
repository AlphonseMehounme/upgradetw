import { adminClient, json, requireUser } from "../_shared/edgeAuth.ts";

// Minimal form for Phase 2 (LAUNCH-BRIEF §7 Phase 2 acceptance: offline
// completions must sync server-side). §6.3's full anti-gaming rules —
// daily hour cap, back-date cap, rate limiting, streak/badge recompute —
// are Phase 3 additions to THIS SAME function, not a new one: nothing
// reads `credited` until the Phase 3 leaderboard exists, so a
// permissively-true credited flag here is safe.
Deno.serve(async (req) => {
  try {
    const userId = await requireUser(req);
    if (userId instanceof Response) return userId;

    const body = await req.json();
    const date = body?.date;
    if (typeof date !== "string") return json({ error: "Invalid date" }, 400);

    const admin = adminClient();

    const { data: schedule } = await admin
      .from("schedules")
      .select("id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    if (!schedule) return json({ error: "No active schedule" }, 404);

    const { data: session, error: findErr } = await admin
      .from("sessions")
      .select("id, scheduled_date, completed_at")
      .eq("schedule_id", schedule.id)
      .eq("scheduled_date", date)
      .maybeSingle();
    if (findErr || !session) return json({ error: "Session not found" }, 404);

    const today = new Date().toISOString().slice(0, 10);
    if (session.scheduled_date > today) {
      return json({ error: "Cannot complete a future session" }, 400);
    }

    // Idempotent: only set completed_at if it isn't already set, so a
    // replayed outbox flush after a flaky network doesn't clobber it.
    if (!session.completed_at) {
      const { error: updErr } = await admin
        .from("sessions")
        .update({ completed_at: new Date().toISOString(), credited: true })
        .eq("id", session.id);
      if (updErr) return json({ error: updErr.message }, 500);
    }

    return json({ ok: true }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
