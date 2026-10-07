const COUNTRIES = {
  Turkey: "TR",
  India: "IN",
  Vietnam: "VN",
  Cambodia: "KH",
  Thailand: "TH",
  Singapore: "SG",
  Malaysia: "MY",
  Italy: "IT",
  Philippines: "PH",
  "South Korea": "KR",
  "Vatican City": "VA",
};

const FLAG_IMAGES = {
  TR: "/images/Turkey-flag.svg",
  IN: "/images/India-flag.svg",
  VN: "/images/Vietnam-flag.svg",
  KH: "/images/Cambodia-flag.svg",
  TH: "/images/Thailand-flag.svg",
  SG: "/images/Singapore-flag.svg",
  MY: "/images/Malaysia-flag.svg",
  IT: "/images/Italy-flag.svg",
  PH: "/images/flags/ph.svg",
  KR: "/images/flags/kr.svg",
  VA: "/images/flags/va.svg",
};

export default function CountryFlag({ countryCode, category }) {
  const code = (countryCode || COUNTRIES[category] || category || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;

  if (FLAG_IMAGES[code]) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={FLAG_IMAGES[code]} alt="" aria-hidden="true" width={20} height={16} className="h-4 w-5 shrink-0 rounded-sm object-contain" />
    );
  }

  // New destinations retain their ISO country code even before a local SVG is added.
  const flag = String.fromCodePoint(...[...code].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));
  return <span aria-hidden="true" data-country-flag className="inline-flex h-4 w-5 shrink-0 items-center justify-center text-base leading-none">{flag}</span>;
}
