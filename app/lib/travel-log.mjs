import { sortPhotosByCaptureDate } from "./photo-order.mjs";

// More than a week without photos ends a trip.
export const TRIP_GAP_DAYS = 7;
// Places with fewer photos are drawn as waypoints on the route (airports, roadside stops).
export const MAIN_PLACE_PHOTOS = 3;
// Only this many hues stay distinguishable on a map; earlier years share one grey.
export const DISTINCT_YEARS = 3;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86400000;
const dayNumber = (date) => Date.parse(`${date}T00:00:00Z`) / DAY;

// Favourites first, then spread across the stay so one afternoon does not fill the strip.
function samplePhotos(photos, limit) {
  const favourites = photos.filter((photo) => photo.favorite === "true" || photo.favorite === true);
  const others = photos.filter((photo) => !favourites.includes(photo));
  const picked = favourites.slice(0, limit);
  const room = limit - picked.length;
  for (let index = 0; index < room && index < others.length; index += 1) {
    picked.push(others[Math.floor((index * others.length) / Math.min(room, others.length))]);
  }
  return sortPhotosByCaptureDate(picked);
}

export function buildTravelLog(photos, map, { photosPerPlace = 6 } = {}) {
  const assignments = map?.photos || {};
  const places = new Map((map?.places || []).map((place) => [place.id, { ...place, photoCount: 0, visits: [], photos: [] }]));
  const located = sortPhotosByCaptureDate(photos.filter((photo) => places.has(assignments[photo.id]) && DATE_PATTERN.test(photo.date || "")));

  const trips = [];
  let trip;
  let visit;
  for (const photo of located) {
    const place = places.get(assignments[photo.id]);
    if (!trip || dayNumber(photo.date) - dayNumber(trip.end) > TRIP_GAP_DAYS) {
      trip = { id: `trip-${photo.date}`, start: photo.date, end: photo.date, photoCount: 0, visits: [] };
      trips.push(trip);
      visit = null;
    }
    if (!visit || visit.placeId !== place.id) {
      visit = { placeId: place.id, start: photo.date, end: photo.date, photoCount: 0 };
      trip.visits.push(visit);
      place.visits.push(visit);
    }
    visit.end = photo.date;
    visit.photoCount += 1;
    trip.end = photo.date;
    trip.photoCount += 1;
    place.photoCount += 1;
    place.photos.push(photo);
  }

  // Places only referenced by unpublished photos (a stale map) are dropped.
  const visited = [...places.values()].filter((place) => place.photoCount);
  for (const place of visited) {
    place.main = place.photoCount >= MAIN_PLACE_PHOTOS;
    place.firstDate = place.visits[0].start;
    place.lastDate = place.visits.at(-1).end;
    place.photos = samplePhotos(place.photos, photosPerPlace);
    place.visits = place.visits.map(({ start, end }) => ({ start, end }));
  }

  trips.forEach((item, index) => {
    item.index = index;
    item.year = Number(item.start.slice(0, 4));
    item.days = dayNumber(item.end) - dayNumber(item.start) + 1;
    item.countries = [...new Set(item.visits.map((stop) => places.get(stop.placeId).countryCode))];
    // Main places are numbered in order of first arrival; revisits reuse the number.
    const numbers = new Map();
    for (const stop of item.visits) {
      if (places.get(stop.placeId).main && !numbers.has(stop.placeId)) numbers.set(stop.placeId, numbers.size + 1);
      stop.number = numbers.get(stop.placeId) || null;
    }
  });

  const years = [...new Set(trips.map((item) => item.year))];
  return {
    places: visited.map(({ visits, ...place }) => ({
      ...place,
      visits,
      years: [...new Set(visits.map((stay) => Number(stay.start.slice(0, 4))))],
    })),
    trips,
    years,
  };
}

export function formatDate(date) {
  return date.replaceAll("-", "/");
}

// 2024/05/16 – 06/18, or 2025/12/27 – 2026/01/02 across a new year.
export function formatRange(start, end) {
  if (start === end) return formatDate(start);
  const [y1] = start.split("-");
  const [y2, m2, d2] = end.split("-");
  return `${formatDate(start)} – ${y1 === y2 ? `${m2}/${d2}` : formatDate(end)}`;
}

// 2024年5月〜6月 / 2025年12月〜2026年1月 / 2025年7月
export function tripTitle(trip) {
  const [y1, m1] = trip.start.split("-").map(Number);
  const [y2, m2] = trip.end.split("-").map(Number);
  if (y1 === y2 && m1 === m2) return `${y1}年${m1}月`;
  return y1 === y2 ? `${y1}年${m1}月〜${m2}月` : `${y1}年${m1}月〜${y2}年${m2}月`;
}

// Colour slot by recency: 0 = newest year … DISTINCT_YEARS = every older year.
export function yearTone(years, year) {
  const rank = years.length - 1 - years.indexOf(year);
  return Math.min(DISTINCT_YEARS, rank);
}

// Legend entries, newest last: older years fold into one "〜2024" entry.
export function yearLegend(years) {
  const recent = years.slice(-DISTINCT_YEARS);
  const older = years.slice(0, -DISTINCT_YEARS);
  return [
    ...(older.length ? [{ label: `〜${older.at(-1)}`, tone: DISTINCT_YEARS }] : []),
    ...recent.map((year) => ({ label: String(year), tone: yearTone(years, year) })),
  ];
}
