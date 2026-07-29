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
  const signOutBtn = root.querySelector("[data-auth-signout]");
  const profileLink = root.querySelector("[data-auth-profile-link]");

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

  signInBtn.addEventListener("click", () => showOverlay("signin"));
  signOutBtn.addEventListener("click", () => sb.auth.signOut());

  const emailInput = panels.signin.querySelector("[data-auth-email]");
  const sendBtn = panels.signin.querySelector("[data-auth-send]");
  const statusEl = panels.signin.querySelector("[data-auth-status]");
  sendBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    if (!email) return;
    sendBtn.disabled = true;
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/${lang}` },
    });
    statusEl.hidden = false;
    statusEl.textContent = error ? T.authError : T.authCheckEmail;
    sendBtn.disabled = false;
  });

  // Guards against onAuthStateChange firing SIGNED_IN again for a user
  // already handled this page load (supabase-js replays the initial
  // session through the same event in some versions).
  const handled = new Set();

  async function onSignedIn(user) {
    setSignedIn(true);
    signInBtn.hidden = true;
    signOutBtn.hidden = false;
    profileLink.hidden = false;
    if (handled.has(user.id)) return;
    handled.add(user.id);

    const { data: profile } = await sb
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      showOnboard(user);
      return;
    }
    maybeOfferImport();
  }

  function onSignedOut() {
    setSignedIn(false);
    signInBtn.hidden = false;
    signOutBtn.hidden = true;
    profileLink.hidden = true;
    handled.clear();
  }

  function showOnboard(user) {
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
      maybeOfferImport();
    };
  }

  function maybeOfferImport() {
    if (!hasLocalProgress()) {
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

  sb.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session?.user) onSignedIn(session.user);
    if (event === "SIGNED_OUT") onSignedOut();
  });

  sb.auth.getSession().then(({ data }) => {
    if (data.session?.user) onSignedIn(data.session.user);
  });
}
