import { adminClient, json, requireUser } from "../_shared/edgeAuth.ts";
import {
  isValidCfg,
  scheduleSessionRows,
} from "../_shared/createScheduleRows.ts";

Deno.serve(async (req) => {
  try {
    const userId = await requireUser(req);
    if (userId instanceof Response) return userId;

    const body = await req.json();
    const { cfg, done } = body ?? {};
    if (!isValidCfg(cfg) || !Array.isArray(done)) {
      return json({ error: "Invalid import payload" }, 400);
    }

    const admin = adminClient();

    await admin
      .from("schedules")
      .update({ is_active: false })
      .eq("user_id", userId)
      .eq("is_active", true);

    const { data: schedule, error: schedErr } = await admin
      .from("schedules")
      .insert({
        user_id: userId,
        start_date: cfg.start,
        cadence: cfg.cadence,
        hours_per_session: cfg.hours,
        is_active: true,
      })
      .select()
      .single();
    if (schedErr) return json({ error: schedErr.message }, 500);

    const { rows } = scheduleSessionRows(userId, schedule.id, cfg);
    const doneDates = new Set(done as string[]);

    // Imported progress is real but self-declared and unverifiable — it
    // never counts toward the leaderboard (credited stays false).
    // completed_at is set to the session's own scheduled_date, not
    // now(), so a bulk import doesn't falsely cluster at one instant
    // (LAUNCH-BRIEF §5.3).
    const withCompletion = rows.map((r) => ({
      ...r,
      completed_at: doneDates.has(r.scheduled_date)
        ? `${r.scheduled_date}T00:00:00Z`
        : null,
      credited: false,
    }));

    const { error: insErr } = await admin
      .from("sessions")
      .insert(withCompletion);
    if (insErr) return json({ error: insErr.message }, 500);

    return json({ schedule, imported: doneDates.size }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
