/* ===================================================================
   MODULE: PROGRESS — pure functions reconciling session completion
   with book-level read state. Adapted from curriculum.html's S-global
   version (setSessionDone/setBookRead/syncBooks) into functions that
   take and return explicit state instead of mutating a module-level S.
   =================================================================== */

/**
 * Recompute which books count as "read" from which scheduled sessions
 * are marked done. A book is read once every session date that carries
 * a part of it has been completed.
 * @param {Array} sched - buildSchedule() output
 * @param {Set<string>} done - set of completed session date-isos
 * @returns {Set<number>} book numbers that are fully read
 */
export function syncBooks(sched, done) {
  const read = new Set();
  if (!sched) return read;
  const map = new Map();
  sched.forEach((x) =>
    x.parts.forEach((pt) => {
      if (pt.kind !== "book") return;
      if (!map.has(pt.n)) map.set(pt.n, []);
      map.get(pt.n).push(x.date);
    }),
  );
  map.forEach((dates, n) => {
    if (dates.every((d) => done.has(d))) read.add(n);
  });
  return read;
}

/**
 * Toggle a session's completion and return the new (done, read) sets.
 */
export function setSessionDone(sched, done, date, on) {
  const nextDone = new Set(done);
  on ? nextDone.add(date) : nextDone.delete(date);
  return { done: nextDone, read: syncBooks(sched, nextDone) };
}

/**
 * Toggle a book's read state directly (outside the calendar) and
 * cascade to session completion for sessions made entirely of that book.
 */
export function setBookRead(sched, done, read, n, on) {
  const nextRead = new Set(read);
  on ? nextRead.add(n) : nextRead.delete(n);
  const nextDone = new Set(done);
  if (sched)
    sched.forEach((x) => {
      if (!x.parts.some((pt) => pt.kind === "book" && pt.n === n)) return;
      if (on) {
        if (
          x.parts
            .filter((pt) => pt.kind === "book")
            .every((pt) => nextRead.has(pt.n))
        )
          nextDone.add(x.date);
      } else nextDone.delete(x.date);
    });
  return { done: nextDone, read: nextRead };
}
