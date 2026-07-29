import { adminClient, json, requireUser } from "../_shared/edgeAuth.ts";
import {
  isValidCfg,
  scheduleSessionRows,
} from "../_shared/createScheduleRows.ts";

Deno.serve(async (req) => {
  try {
    const userId = await requireUser(req);
    if (userId instanceof Response) return userId;

    const cfg = await req.json();
    if (!isValidCfg(cfg))
      return json({ error: "Invalid schedule config" }, 400);

    const admin = adminClient();

    // Deactivate any current active schedule — kept for history, not
    // deleted, so past completions/sessions remain intact.
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
    const { error: insErr } = await admin.from("sessions").insert(rows);
    if (insErr) return json({ error: insErr.message }, 500);

    return json({ schedule, sessionCount: rows.length }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
