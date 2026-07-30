/* Auth widget + first-sign-in onboarding + local->cloud import prompt.
   No-ops entirely when Supabase isn't configured, so guest mode and an
   unconfigured build/deploy are unaffected (non-negotiable #4). */
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";
import { ui } from "../lib/content.js";
import {
  hasLocalProgress,
  clearLocalStateAfterImport,
  loadState,
} from "./state.js";
import { setSignedIn } from "./authState.js";

export function initAuth() {
  if (!isSupabaseConfigured()) return;
  const sb = supabase();
  const root = document.querySelector("[data-auth-root]");
  if (!root) return;

  const lang = root.dataset.lang;
  const T = ui(lang);

  const signInBtn = root.querySelector("[data-auth-signin]");
  const accountMenu = root.querySelector("[data-account-menu]");
  const accountTrigger = root.querySelector("[data-account-trigger]");
  const accountDropdown = root.querySelector("[data-account-dropdown]");
  const signOutBtn = root.querySelector("[data-auth-signout]");

  function closeAccountDropdown() {
    accountDropdown.hidden = true;
    accountTrigger.setAttribute("aria-expanded", "false");
  }
  accountTrigger.addEventListener("click", () => {
    const open = accountDropdown.hidden;
    accountDropdown.hidden = !open;
    accountTrigger.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", (e) => {
    if (!accountMenu.hidden && !accountMenu.contains(e.target)) {
      closeAccountDropdown();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAccountDropdown();
  });

  const overlay = document.querySelector("[data-auth-overlay]");
  const closeBtn = overlay.querySelector("[data-auth-close]");
  const panels = {
    signin: overlay.querySelector("[data-auth-panel-signin]"),
    onboard: overlay.querySelector("[data-auth-panel-onboard]"),
    import: overlay.querySelector("[data-auth-panel-import]"),
  };

  function showOverlay(panel) {
    for (const [k, el] of Object.entries(panels)) el.hidden = k !== panel;
    overlay.dataset.open = "true";
  }
  function hideOverlay() {
    overlay.dataset.open = "false";
  }
  closeBtn.addEventListener("click", hideOverlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) hideOverlay();
  });

  const formEl = panels.signin.querySelector("[data-auth-form]");
  const emailInput = panels.signin.querySelector("[data-auth-email]");
  const sendBtn = panels.signin.querySelector("[data-auth-send]");
  const sendLabel = sendBtn.querySelector("[data-auth-send-label]");
  const statusEl = panels.signin.querySelector("[data-auth-status]");

  signInBtn.addEventListener("click", () => {
    formEl.hidden = false;
    statusEl.hidden = true;
    showOverlay("signin");
  });
  signOutBtn.addEventListener("click", () => sb.auth.signOut());

  sendBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    if (!email) return;
    sendBtn.disabled = true;
    sendLabel.textContent = T.authSending;
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/${lang}/curriculum`,
      },
    });
    statusEl.hidden = false;
    statusEl.textContent = error
      ? error.code === "over_email_send_rate_limit"
        ? T.authRateLimit
        : T.authError
      : T.authCheckEmail;
    sendBtn.disabled = false;
    sendLabel.textContent = T.authSendLink;
    // Only hide the form on success — an error (rate limit, etc.) should
    // leave the email input and button available so the user can retry.
    if (!error) formEl.hidden = true;
  });

  async function onSignedIn(user, isNewLogin) {
    setSignedIn(true);
    signInBtn.hidden = true;
    accountMenu.hidden = false;

    const { data: profile } = await sb
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      showOnboard(user, isNewLogin);
      return;
    }
    maybeOfferImport(isNewLogin);
  }

  function onSignedOut() {
    setSignedIn(false);
    signInBtn.hidden = false;
    accountMenu.hidden = true;
    closeAccountDropdown();
  }

  function showOnboard(user, isNewLogin) {
    const nameInput = panels.onboard.querySelector("[data-onboard-name]");
    const localeSelect = panels.onboard.querySelector("[data-onboard-locale]");
    nameInput.value = (user.email || "reader").split("@")[0].slice(0, 32);
    localeSelect.value = lang;
    showOverlay("onboard");

    panels.onboard.querySelector("[data-onboard-save]").onclick = async () => {
      const name = nameInput.value.trim().slice(0, 32);
      if (name.length < 2) return;
      await sb.from("profiles").insert({
        id: user.id,
        display_name: name,
        locale: localeSelect.value,
      });
      maybeOfferImport(isNewLogin);
    };
  }

  // Offered only right after a real sign-in (never on a page-load session
  // restore) and only on the calendar page, so it doesn't interrupt
  // browsing elsewhere on every refresh. hasLocalProgress() already goes
  // false forever once import succeeds (clearLocalStateAfterImport), so a
  // user who has imported never sees it again.
  function maybeOfferImport(isNewLogin) {
    const onCalendarPage = /^\/(en|fr)\/calendar$/.test(
      window.location.pathname,
    );
    if (!isNewLogin || !onCalendarPage || !hasLocalProgress()) {
      hideOverlay();
      return;
    }
    showOverlay("import");
    panels.import.querySelector("[data-import-accept]").onclick = doImport;
    panels.import.querySelector("[data-import-skip]").onclick = hideOverlay;
  }

  async function doImport() {
    const state = loadState();
    const { error } = await sb.functions.invoke("import-progress", {
      body: { cfg: state.cfg, done: state.done },
    });
    if (!error) clearLocalStateAfterImport();
    hideOverlay();
    window.dispatchEvent(new CustomEvent("curriculum:sync"));
  }

  // INITIAL_SESSION (page-load session restore) and SIGNED_IN (an actual
  // new sign-in) are distinct events — that's what lets onSignedIn tell
  // a fresh login apart from a refresh, so the import prompt only offers
  // itself once per real login instead of on every page load.
  sb.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session?.user) onSignedIn(session.user, true);
    if (event === "INITIAL_SESSION" && session?.user)
      onSignedIn(session.user, false);
    if (event === "SIGNED_OUT") onSignedOut();
  });
}
