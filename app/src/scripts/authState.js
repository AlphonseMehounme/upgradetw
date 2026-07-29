/* Tiny synchronous cache of "is a user currently signed in", updated by
   auth-app.js's onAuthStateChange listener. state.js reads this
   synchronously so its mutators can stay synchronous (calendar-app.js
   and progress-ui.js call them without awaiting) while still knowing
   whether to enqueue an outbox op — see LAUNCH-BRIEF §5.4. */
let signedIn = false;

export function setSignedIn(value) {
  signedIn = value;
}

export function isSignedIn() {
  return signedIn;
}
