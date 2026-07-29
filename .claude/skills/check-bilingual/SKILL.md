---
name: check-bilingual
description: Verify that app/src/content/ui.json has identical key structure under "en" and "fr". Use after editing ui.json, or when adding any new user-facing string, to catch English-only leakage before it ships (LAUNCH-BRIEF non-negotiable #5).
---

Compare the `en` and `fr` top-level objects in `app/src/content/ui.json` for structural parity.

1. Read `app/src/content/ui.json`.
2. Recursively walk both the `en` and `fr` trees, comparing key sets at every level (objects and arrays-of-arrays like `paceRows` should have the same shape/length on both sides — values will differ, that's expected).
3. Report any key present in one locale but missing in the other, with its path (e.g. `work.cta` missing in `fr`).
4. If both trees match exactly in structure, say so briefly — don't restate the whole file.
5. Do not edit `ui.json` yourself unless the user asks you to fix a specific reported gap.
