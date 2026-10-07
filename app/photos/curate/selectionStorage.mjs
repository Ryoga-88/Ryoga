export const SELECTION_KEY = "ryoga:photo-curation:selection:v1";

function knownSelection(ids, validIds) {
  const allowed = validIds instanceof Set ? validIds : new Set(validIds);
  return new Set([...ids].filter((id) => typeof id === "string" && allowed.has(id)));
}

export function readSelection(storage, validIds) {
  // Keep storage access outside the JSON catch so callers can report unavailable storage.
  const stored = storage.getItem(SELECTION_KEY);
  if (stored === null) return new Set();

  let ids;
  try {
    ids = JSON.parse(stored);
  } catch {
    return new Set();
  }
  return Array.isArray(ids) ? knownSelection(ids, validIds) : new Set();
}

export function updateSelection(storage, validIds, updater) {
  // Read at the moment of the edit, including changes made by another browser tab.
  const latest = readSelection(storage, validIds);
  const updated = knownSelection(updater(latest) ?? latest, validIds);
  storage.setItem(SELECTION_KEY, JSON.stringify([...updated]));
  return updated;
}
