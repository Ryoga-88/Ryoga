const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CAPTURED_AT_PATTERN = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

function validDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? value : null;
}

function captureTime(value) {
  if (typeof value !== "string" || !CAPTURED_AT_PATTERN.test(value) || !validDate(value.slice(0, 10))) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

// Keep the source array intact: its order also determines the country chips.
// Local shooting dates come first; UTC capture times only order the same day.
export function sortPhotosByCaptureDate(photos) {
  return photos.map((photo, index) => {
    const date = validDate(photo.date);
    return { photo, index, date, time: date ? captureTime(photo.capturedAt) : null };
  }).sort((a, b) => {
    if (a.date !== b.date) {
      if (a.date === null) return 1;
      if (b.date === null) return -1;
      return a.date < b.date ? -1 : 1;
    }
    if (a.time !== b.time) {
      if (a.time === null) return 1;
      if (b.time === null) return -1;
      return a.time - b.time;
    }
    return a.index - b.index;
  }).map(({ photo }) => photo);
}
