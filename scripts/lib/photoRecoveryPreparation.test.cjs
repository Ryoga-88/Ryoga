const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const sharp = require("sharp");
const { collectRecoveryIDs, preparePhotoRecovery } = require("../preparePhotoRecovery.cjs");

const id = (number) => `00000000-0000-0000-0000-${String(number).padStart(12, "0")}`;

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ryoga-recovery-preparation-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const directory of [".local/photos/high-resolution", "app/contents", "public/images/photos"]) {
    await fs.mkdir(path.join(root, directory), { recursive: true });
  }
  const photos = Array.from({ length: 8 }, (_, index) => ({ id: id(index + 1), width: 3200, height: 1800 }));
  const decisions = Object.fromEntries(photos.map((photo) => [photo.id, "included"]));
  decisions[id(3)] = "excluded";
  await fs.writeFile(path.join(root, "app/contents/curated-photos.json"), JSON.stringify({ version: 1, decisions, photos }));
  const countries = ["FR", "GB", "DE", "JP", "CN", "ES", "AL", null];
  await fs.writeFile(path.join(root, ".local/photos/catalog.json"), JSON.stringify({ version: 1,
    photos: photos.map((photo, index) => ({ id: photo.id, countryCode: countries[index] })),
  }));
  // Manifest dimensions deliberately disagree with the first actual WebP.
  // Excluded / countryless items have no image file and must not be accessed.
  for (const [number, width] of [[1, 552], [2, 1200]]) {
    await sharp({ create: { width, height: 310, channels: 3, background: "#5599aa" } })
      .webp().toFile(path.join(root, `public/images/photos/${id(number)}.webp`));
  }
  return root;
}

test("recovery includes only selected eligible photos below the actual 1200px boundary", async (t) => {
  const root = await fixture(t);
  assert.deepEqual(await collectRecoveryIDs(root), [id(1)]);
});

test("dry-run preserves private requests, successful exports, and the existing app", async (t) => {
  const root = await fixture(t);
  const preserved = [".local/photos/high-resolution-request.json", ".local/photos/high-resolution/export-results.json",
    ".local/photos/Ryoga Photo Export.app/Contents/MacOS/export-selected-photos"];
  for (const filename of preserved) {
    await fs.mkdir(path.dirname(path.join(root, filename)), { recursive: true });
    await fs.writeFile(path.join(root, filename), "existing user state\n");
  }
  assert.deepEqual(await preparePhotoRecovery(root, { dryRun: true }), { count: 1, prepared: false });
  for (const filename of preserved) assert.equal(await fs.readFile(path.join(root, filename), "utf8"), "existing user state\n");
});
