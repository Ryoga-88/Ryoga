const { publicPhotoMetadata } = require("./publicPhotoMetadata.cjs");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function imageUrl(value, id, variant, expectedOrigin) {
  if (typeof value !== "string") throw new Error("Invalid image URL");
  const url = new URL(value);
  const legacyPath = `/photos/${id}${variant === "thumb" ? "-thumb" : ""}.webp`;
  const versionedPath = new RegExp(`^/photos/${id}/[0-9a-f]{64}/${variant}\\.webp$`);
  if (
    url.protocol !== "https:" || !url.hostname.endsWith(".workers.dev") ||
    url.port || url.username || url.password || url.search || url.hash ||
    (url.pathname !== legacyPath && !versionedPath.test(url.pathname)) ||
    (expectedOrigin && url.origin !== expectedOrigin)
  ) throw new Error("Invalid image URL");
  return url;
}

function dimensionsValid(photo) {
  return Number.isInteger(photo.width) && photo.width > 0 && Number.isInteger(photo.height) && photo.height > 0;
}

function previewPhotos(manifest, curated) {
  if (manifest.version !== 1 || !Array.isArray(manifest.photos) || manifest.photos.length < 1 || manifest.photos.length > 3) throw new Error("Invalid preview manifest");
  if (curated.version !== 1 || !Array.isArray(curated.photos) || !curated.decisions || typeof curated.decisions !== "object" || Array.isArray(curated.decisions)) throw new Error("Invalid curated manifest");
  const published = new Map(curated.photos.map((photo) => [photo.id, photo]));
  const ids = new Set();
  let origin;
  // The private trial manifest defines BOTH the exact host and the original IDs.
  // Validate the complete trial before considering newer public delivery fields.
  return manifest.photos.map((photo) => {
    if (!photo || typeof photo.id !== "string" || !UUID.test(photo.id) || ids.has(photo.id) ||
        typeof photo.title !== "string" || typeof photo.category !== "string" || !dimensionsValid(photo)) throw new Error("Invalid preview photo");
    ids.add(photo.id);
    const url = imageUrl(photo.url, photo.id, "full", origin);
    origin ||= url.origin;
    const thumbnail = imageUrl(photo.thumbnail, photo.id, "thumb", origin);
    return {
      id: photo.id, title: photo.title, category: photo.category,
      date: typeof photo.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(photo.date) ? photo.date : undefined,
      ...publicPhotoMetadata(photo), width: photo.width, height: photo.height, aspect: `${photo.width} / ${photo.height}`,
      url: url.href, thumbnail: thumbnail.href,
    };
  }).filter((photo) => curated.decisions[photo.id] === "included" && published.has(photo.id)).map((photo) => {
    const current = published.get(photo.id);
    const result = { ...photo, ...publicPhotoMetadata(current) };
    if (typeof current.countryCode === "string" && /^[A-Z]{2}$/.test(current.countryCode)) result.countryCode = current.countryCode;
    // A local, partial, malformed, or different-host entry cannot replace the
    // already verified trial pair. The caller keeps showing the trial instead.
    if (dimensionsValid(current)) {
      try {
        const url = imageUrl(current.url, photo.id, "full", origin);
        const thumbnail = imageUrl(current.thumbnail, photo.id, "thumb", origin);
        Object.assign(result, { url: url.href, thumbnail: thumbnail.href, width: current.width, height: current.height, aspect: `${current.width} / ${current.height}` });
      } catch { /* Keep the verified trial URLs and their matching dimensions. */ }
    }
    return result;
  });
}

module.exports = { previewPhotos };
