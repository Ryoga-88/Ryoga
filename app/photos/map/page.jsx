import curated from "app/contents/curated-photos.json";
import photoMap from "app/contents/photo-map.json";
import PageTitle from "app/components/page-title";
import { pageMetadata } from "app/lib/site";
import { buildTravelLog } from "app/lib/travel-log.mjs";
import PhotoViewTabs from "../view-tabs";
import TravelMap from "./TravelMap";

export const metadata = pageMetadata({
  title: "旅の地図",
  description: "花房亮雅が写真を撮った旅先と、巡った順番を地図でたどれます。",
  path: "/photos/map",
});

// Only what the map draws reaches the browser: rounded place centres and a few photos each.
function mapPhoto({ id, url, thumbnail, width, height, aspect, title, date, locationLabel }) {
  return { id, url, thumbnail, width, height, aspect, title, date, locationLabel };
}

export default function PhotoMapPage() {
  const log = buildTravelLog(curated.photos, photoMap);
  const places = log.places.map((place) => ({ ...place, photos: place.photos.map(mapPhoto) }));
  const countryNames = Object.fromEntries(curated.photos.map((photo) => [photo.countryCode, photo.title]));
  const countryCategories = Object.fromEntries(curated.photos.map((photo) => [photo.countryCode, photo.category]));

  return (
    <div className="mx-auto max-w-page px-4 pt-10 sm:pt-14">
      <PageTitle title="Photos" lead="写真を撮った場所と、巡った順番" />
      <PhotoViewTabs current="map" />
      <TravelMap
        places={places}
        trips={log.trips}
        years={log.years}
        countryNames={countryNames}
        countryCategories={countryCategories}
      />
    </div>
  );
}
