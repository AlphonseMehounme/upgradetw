/* Profile page: display name/locale/leaderboard opt-in (writes directly
   to `profiles`, RLS-permitted), data export (three owner-readable
   selects aggregated into one JSON download), and account deletion
   (via the delete-account edge function, since deleting from
   auth.users requires the Admin API, not a table RLS policy). */
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";
import { ui } from "../lib/content.js";
import {
  hasLocalProgress,
  loadState,
  clearLocalStateAfterImport,
} from "./state.js";

export function initProfile() {
  const root = document.getElementById("profileRoot");
  if (!root) return;
  const lang = root.dataset.lang;
  const T = ui(lang);

  const guestView = root.querySelector("[data-profile-guest]");
  const signedInView = root.querySelector("[data-profile-signed-in]");

  // Reuses the header's own sign-in overlay rather than duplicating it.
  const guestSigninBtn = root.querySelector("[data-profile-signin]");
  guestSigninBtn.addEventListener("click", () => {
    document.querySelector("[data-auth-signin]")?.click();
  });

  if (!isSupabaseConfigured()) return; // no accounts configured — stays on the guest view

  const sb = supabase();

  const nameInput = root.querySelector("[data-profile-name]");
  const localeSelect = root.querySelector("[data-profile-locale]");
  const optInCheckbox = root.querySelector("[data-profile-optin]");
  const saveBtn = root.querySelector("[data-profile-save]");
  const statusEl = root.querySelector("[data-profile-status]");
  const exportBtn = root.querySelector("[data-profile-export]");
  const importBtn = root.querySelector("[data-profile-import]");
  const deleteBtn = root.querySelector("[data-profile-delete]");

  let currentUser = null;

  async function loadProfile(user) {
    currentUser = user;
    guestView.hidden = true;
    signedInView.hidden = false;

    const { data: profile } = await sb
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (profile) {
      nameInput.value = profile.display_name;
      localeSelect.value = profile.locale;
      optInCheckbox.checked = profile.leaderboard_opt_in;
    }
    importBtn.hidden = !hasLocalProgress();
  }

  function onSignedOut() {
    guestView.hidden = false;
    signedInView.hidden = true;
    currentUser = null;
  }

  sb.auth.getSession().then(({ data }) => {
    if (data.session?.user) loadProfile(data.session.user);
  });
  sb.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session?.user) loadProfile(session.user);
    if (event === "SIGNED_OUT") onSignedOut();
  });

  saveBtn.addEventListener("click", async () => {
    if (!currentUser) return;
    const name = nameInput.value.trim().slice(0, 32);
    if (name.length < 2) return;
    const { error } = await sb
      .from("profiles")
      .update({
        display_name: name,
        locale: localeSelect.value,
        leaderboard_opt_in: optInCheckbox.checked,
      })
      .eq("id", currentUser.id);
    statusEl.hidden = false;
    statusEl.textContent = error ? T.authError : T.profileSaved;
  });

  exportBtn.addEventListener("click", async () => {
    if (!currentUser) return;
    const [{ data: profile }, { data: schedules }, { data: sessions }] =
      await Promise.all([
        sb.from("profiles").select("*").eq("id", currentUser.id).maybeSingle(),
        sb.from("schedules").select("*").eq("user_id", currentUser.id),
        sb.from("sessions").select("*").eq("user_id", currentUser.id),
      ]);
    const blob = new Blob(
      [JSON.stringify({ profile, schedules, sessions }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "curriculum-data.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  importBtn.addEventListener("click", async () => {
    const state = loadState();
    const { error } = await sb.functions.invoke("import-progress", {
      body: { cfg: state.cfg, done: state.done },
    });
    if (!error) {
      clearLocalStateAfterImport();
      importBtn.hidden = true;
      window.dispatchEvent(new CustomEvent("curriculum:sync"));
    }
  });

  deleteBtn.addEventListener("click", async () => {
    if (!currentUser) return;
    if (!window.confirm(T.profileDeleteWarn)) return;
    const { error } = await sb.functions.invoke("delete-account");
    if (!error) {
      await sb.auth.signOut();
      window.location.href = `/${lang}`;
    }
  });
}
