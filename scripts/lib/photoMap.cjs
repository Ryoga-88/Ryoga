const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

// Public travel-map data. Photos taken near each other become one place, and only
// that place's rounded centre is published: no per-photo GPS, addresses or paths.
const PLACE_RADIUS_KM = 20;
const COORDINATE_STEP = 0.05; // about 5 km
const MAIN_PLACE_PHOTOS = 3;
const ABSORB_RADIUS_KM = 40;
const MAP_PATH = path.join("app", "contents", "photo-map.json");

// Photos labels mix Japanese, English and local scripts. Add a display name here
// when the automatic name reads poorly; keys are the label part shown by default.
const PLACE_NAMES = {
  "Hà Nội": "ハノイ",
  "Hội An": "ホイアン",
  "Bà Nà": "バーナーヒルズ",
  "Tuần Châu": "ハロン湾",
  "Hoàn Kiếm": "ハノイ",
  "Ngũ Hành Sơn": "ダナン",
  "An Hải": "ダナン",
  "ホーチミン市": "ホーチミン",
  "チエンマイ": "チェンマイ",
  "プノンペン特別市": "プノンペン",
  "Svay Leu": "ベンメリア",
  "Prasat Bakong": "ロリュオス",
  "Agra": "アーグラ",
  "Mathura": "マトゥラー",
  "Dausa": "ダウサ",
  "Jaipur Rural": "ジャイプール",
  "Jodhpur": "ジョドプール",
  "ニューデリー": "デリー",
  "ガージヤーバード": "デリー",
  "Kuala Lumpur": "クアラルンプール",
  "クアラルンプール首都特別市": "クアラルンプール",
  "Batu Caves": "バトゥ洞窟",
  "Putrajaya": "プトラジャヤ",
  "SG": "シンガポール",
  "ソウル特別市": "ソウル",
  "인천광역시": "仁川",
  "Pendik": "イスタンブール",
  "ネヴシェヒル": "カッパドキア",
  "ラプ=ラプ": "セブ",
  "セブ市": "セブ",
  "フィウミチーノ": "ローマ",
};

const READABLE = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Latin}\p{M}\d\s'’.,=()ー・-]+$/u;
// Vietnamese ward/commune and city prefixes, Thai district prefixes.
const PREFIX = /^(?:(?:P|X|TT|Q|H|TP)\.\s*|Thành Phố\s+|Tỉnh\s+|เขต|อ\.|อำเภอ)/u;

function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function validPoint(photo) {
  return Number.isFinite(photo?.latitude) && Number.isFinite(photo?.longitude) &&
    Math.abs(photo.latitude) <= 90 && Math.abs(photo.longitude) <= 180 &&
    !(photo.latitude === 0 && photo.longitude === 0);
}

function labelParts(label, countryCode) {
  if (typeof label !== "string") return [];
  return label.split("・").map((part) => part.trim().replace(PREFIX, "").trim())
    .filter((part) => part && part !== countryCode);
}

function ranked(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

// Districts and wards make poor names for a whole city: when the city part varies,
// the broader region part (e.g. イスタンブール, バンコク) names the place.
function placeName(points, fallback) {
  const parts = points.map((point) => labelParts(point.label, point.countryCode)).filter((item) => item.length);
  const cities = ranked(parts.filter((item) => item.length > 1).map((item) => item.at(-1)).map((name) => PLACE_NAMES[name] || name));
  const states = ranked(parts.map((item) => item[0]).map((name) => PLACE_NAMES[name] || name));
  const [city, nextCity] = cities;
  if (city && READABLE.test(city[0]) && city[1] >= parts.length / 2 && (!nextCity || nextCity[1] < parts.length * 0.15)) return city[0];
  const state = states.find(([name]) => READABLE.test(name)) || city || states[0];
  return state ? state[0] : fallback;
}

function rounded(value) {
  return Number((Math.round(value / COORDINATE_STEP) * COORDINATE_STEP).toFixed(2));
}

function addPoint(group, point) {
  group.points.push(point);
  const n = group.points.length;
  group.lat += (point.lat - group.lat) / n;
  group.lng += (point.lng - group.lng) / n;
}

function buildPhotoMap(catalogPhotos, publishedPhotos) {
  const located = new Map(catalogPhotos.filter(validPoint).map((photo) => [photo.id, photo]));
  const points = publishedPhotos.flatMap((photo) => {
    const source = located.get(photo.id);
    const time = Date.parse(source?.capturedAt || photo.capturedAt || "");
    if (!source || !photo.countryCode || !Number.isFinite(time)) return [];
    return [{ id: photo.id, countryCode: photo.countryCode, title: photo.title, lat: source.latitude, lng: source.longitude, label: source.locationLabel, time }];
  }).sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));

  // A stay continues while photos remain near its centre; leaving starts a new one.
  const stays = [];
  for (const point of points) {
    const stay = stays.at(-1);
    if (stay && stay.countryCode === point.countryCode && distanceKm(stay, point) <= PLACE_RADIUS_KM) addPoint(stay, point);
    else stays.push({ countryCode: point.countryCode, lat: point.lat, lng: point.lng, points: [point] });
  }

  // Revisits join the nearest existing place; larger stays anchor the centres.
  const groups = [];
  for (const stay of [...stays].sort((a, b) => b.points.length - a.points.length || a.points[0].time - b.points[0].time)) {
    const nearest = groups.filter((group) => group.countryCode === stay.countryCode)
      .map((group) => ({ group, distance: distanceKm(group, stay) }))
      .filter(({ distance }) => distance <= PLACE_RADIUS_KM)
      .sort((a, b) => a.distance - b.distance)[0];
    const group = nearest?.group || { countryCode: stay.countryCode, lat: 0, lng: 0, points: [] };
    if (!nearest) groups.push(group);
    for (const point of stay.points) addPoint(group, point);
  }

  // Airports and roadside shots join a nearby main place without moving its centre.
  const mainPlaces = groups.filter((group) => group.points.length >= MAIN_PLACE_PHOTOS);
  const kept = groups.filter((group) => {
    if (group.points.length >= MAIN_PLACE_PHOTOS) return true;
    const host = mainPlaces.filter((main) => main.countryCode === group.countryCode)
      .map((main) => ({ main, distance: distanceKm(main, group) }))
      .filter(({ distance }) => distance <= ABSORB_RADIUS_KM)
      .sort((a, b) => a.distance - b.distance)[0];
    if (host) host.main.points.push(...group.points);
    return !host;
  });

  const firstTime = (group) => Math.min(...group.points.map((point) => point.time));
  kept.sort((a, b) => firstTime(a) - firstTime(b));
  const perCountry = new Map();
  const places = kept.map((group) => {
    const code = group.countryCode;
    perCountry.set(code, (perCountry.get(code) || 0) + 1);
    return {
      id: `${code.toLowerCase()}-${perCountry.get(code)}`,
      countryCode: code,
      name: placeName(group.points, group.points[0].title || code),
      lat: rounded(group.lat),
      lng: rounded(group.lng),
      group,
    };
  });

  // Two places with one name (a city and its outskirts): the smaller is the outskirts.
  const sameName = Map.groupBy(places, (place) => `${place.countryCode}:${place.name}`);
  for (const twins of sameName.values()) {
    const main = twins.reduce((a, b) => (b.group.points.length > a.group.points.length ? b : a));
    for (const twin of twins) if (twin !== main) twin.name = `${twin.name}近郊`;
  }

  const photos = {};
  for (const place of places) for (const point of place.group.points) photos[point.id] = place.id;
  return {
    version: 1,
    places: places.map(({ group, ...place }) => place),
    photos: Object.fromEntries(Object.entries(photos).sort(([a], [b]) => a.localeCompare(b))),
  };
}

const serialize = (data) => `${JSON.stringify(data, null, 2)}\n`;

async function writePhotoMap(root, catalogPhotos, publishedPhotos) {
  const filename = path.join(root, MAP_PATH);
  const data = buildPhotoMap(catalogPhotos, publishedPhotos);
  await fs.mkdir(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, serialize(data));
    await fs.rename(temporary, filename);
  } finally {
    await fs.rm(temporary, { force: true });
  }
  return data;
}

// Whether the saved map matches what the current catalog and published list produce.
async function checkPhotoMap(root, catalogPhotos, publishedPhotos) {
  const expected = buildPhotoMap(catalogPhotos, publishedPhotos);
  const saved = await fs.readFile(path.join(root, MAP_PATH), "utf8").catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  const savedPhotos = saved ? JSON.parse(saved).photos || {} : {};
  return {
    current: saved === serialize(expected),
    unmapped: publishedPhotos.filter((photo) => !savedPhotos[photo.id]).length,
    unlocated: publishedPhotos.length - Object.keys(expected.photos).length,
  };
}

module.exports = { buildPhotoMap, writePhotoMap, checkPhotoMap, distanceKm, MAP_PATH, PLACE_RADIUS_KM, COORDINATE_STEP };
