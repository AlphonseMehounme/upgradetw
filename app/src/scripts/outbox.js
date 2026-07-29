/* IndexedDB-backed outbox for session completions made while signed in.
   Hand-rolled (no `idb` dependency) — one object store, FIFO
   enqueue/list/delete, matching the project's existing preference for
   small hand-rolled wrappers over libraries (state.js's own localStorage
   wrapper is the same pattern). */

const DB_NAME = "curriculum-outbox";
const DB_VERSION = 1;
const STORE = "ops";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "date" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function withStore(mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        const result = fn(store);
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
      }),
  );
}

/** Pure decision: given the currently-queued ops and a new toggle, return
    the next set of ops. Enqueuing on:false only cancels a still-queued
    on:true for the same date — there is no server "un-complete" endpoint
    (§5.4: server wins on completed_at, client never overwrites it). */
export function reconcileOutboxToggle(pendingOps, date, on) {
  const withoutDate = pendingOps.filter((op) => op.date !== date);
  if (!on) return withoutDate;
  return [...withoutDate, { date, createdAt: Date.now(), attempts: 0 }];
}

export async function enqueueSessionOp(date, on) {
  const pending = await listOps();
  const next = reconcileOutboxToggle(pending, date, on);
  await withStore("readwrite", (store) => {
    store.clear();
    for (const op of next) store.put(op);
  });
}

export function listOps() {
  return withStore(
    "readonly",
    (store) =>
      new Promise((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export function removeOp(date) {
  return withStore("readwrite", (store) => store.delete(date));
}
