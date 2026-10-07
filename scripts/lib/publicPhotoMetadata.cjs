// Keep this allowlist separate from private catalog fields (GPS, paths, address data).
function publicPhotoMetadata(photo = {}) {
  const metadata = {};
  if (typeof photo.locationLabel === "string") {
    const label = photo.locationLabel.trim();
    if (label && label.length <= 161 && !/[\u0000-\u001f\u007f]/.test(label)) metadata.locationLabel = label;
  }
  if (typeof photo.capturedAt === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(photo.capturedAt) &&
      Number.isFinite(Date.parse(photo.capturedAt))) {
    metadata.capturedAt = photo.capturedAt;
  }
  return metadata;
}

module.exports = { publicPhotoMetadata };
