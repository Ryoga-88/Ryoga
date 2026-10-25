import Link from "next/link";
import CountryFlag from "app/components/country-flag";
import { sortPhotosByCaptureDate } from "app/lib/photo-order.mjs";

const HIGHLIGHT_COUNT = 6;

export default function HomePhotos({ photos }) {
  const ordered = sortPhotosByCaptureDate(photos);
  const countries = new Map();
  // One photo per country, from the six most recently photographed countries.
  for (const photo of [...ordered].reverse()) {
    const key = photo.countryCode || photo.category;
    if (!countries.has(key)) countries.set(key, []);
    countries.get(key).push(photo);
  }
  const highlights = sortPhotosByCaptureDate(
    [...countries.values()].slice(0, HIGHLIGHT_COUNT).map((items) =>
      items.find((photo) => photo.favorite === true || photo.favorite === "true") || items[0]
    )
  );

  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4">
      {highlights.map((photo) => (
        <Link
          key={photo.id}
          href={{ pathname: "/photos", query: { country: photo.category } }}
          aria-label={`${photo.title}の写真を見る`}
          className="group block rounded-lg"
        >
          <div className="aspect-square overflow-hidden rounded-lg bg-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.thumbnail || photo.url}
              alt={[photo.title, photo.locationLabel].filter(Boolean).join("・") + "で撮影した写真"}
              width={photo.width}
              height={photo.height}
              loading="lazy"
              decoding="async"
              className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted transition-colors group-hover:text-ink">
            <CountryFlag countryCode={photo.countryCode} category={photo.category} />
            {photo.title}
          </p>
        </Link>
      ))}
    </div>
  );
}
