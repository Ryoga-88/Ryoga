import curation from "scripts/lib/photoCuration.cjs";

// Shared across API handlers and development hot reloads; serializes disk commits.
const key = Symbol.for("ryoga.photoCuration");
export const photoCuration = globalThis[key] || (globalThis[key] = curation.createStore());
export const localAccessAllowed = curation.localAccessAllowed;
