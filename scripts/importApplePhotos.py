#!/usr/bin/env python3
"""Build a private local catalog from Apple Photos without changing its library.

Only metadata and image files already on this Mac are read. This does not ask
iCloud to download originals, upload images, or change publication selections.
Apple's Photos database is an undocumented format; required columns are checked
before replacing an existing catalog.
"""

import argparse
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
import json
import math
import os
from pathlib import Path
import plistlib
import re
import sqlite3
import struct
import sys
import tempfile
import unicodedata
from xml.parsers.expat import ExpatError


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_LIBRARY = Path.home() / "Pictures" / "Photos Library.photoslibrary"
DEFAULT_OUTPUT = PROJECT_ROOT / ".local" / "photos" / "catalog.json"
APPLE_EPOCH = datetime(2001, 1, 1, tzinfo=timezone.utc)
EXCLUDED_COUNTRIES = {"JP", "CN", "ES", "AL"}
COUNTRIES = {
    "TH": ("タイ", "Thailand"),
    "VN": ("ベトナム", "Vietnam"),
    "IN": ("インド", "India"),
    "KH": ("カンボジア", "Cambodia"),
    "TR": ("トルコ", "Turkey"),
    "IT": ("イタリア", "Italy"),
    "SG": ("シンガポール", "Singapore"),
    "MY": ("マレーシア", "Malaysia"),
    "PH": ("フィリピン", "Philippines"),
    "KR": ("韓国", "South Korea"),
    "VA": ("バチカン", "Vatican City"),
}
UUID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)
IMAGE_SUFFIXES = {".jpeg", ".jpg", ".png", ".heic", ".heif", ".tif", ".tiff", ".dng"}
BROWSER_SUFFIXES = {".jpeg", ".jpg", ".png"}


def country_code(blob):
    """Read country codes in NSKeyedArchiver bplists without unarchiving objects."""
    if not blob:
        return None
    try:
        archive = plistlib.loads(blob)
    except (plistlib.InvalidFileException, ValueError, TypeError, OverflowError):
        return None
    if not isinstance(archive, dict):
        return None
    objects = archive.get("$objects", [])
    if not isinstance(objects, list):
        return None

    def dereference(value):
        seen = set()
        while isinstance(value, plistlib.UID):
            index = value.data
            if index in seen or index >= len(objects):
                return None
            seen.add(index)
            value = objects[index]
        return value

    dictionaries = [archive] + [item for item in objects if isinstance(item, dict)]
    # The main reverse-geocoding record is preferred to its postal-address copy.
    for key in ("countryCode", "_ISOCountryCode"):
        for item in dictionaries:
            value = dereference(item.get(key))
            if isinstance(value, str) and re.fullmatch(r"[A-Za-z]{2}", value):
                return value.upper()
    return None


def broad_location(blob):
    """Extract only a state/city label from Photos' archived postal address.

    This reads plist data, never instantiates archived objects, and deliberately
    ignores addresses, streets, postal codes, points of interest and map data.
    """
    if not blob:
        return None
    try:
        archive = plistlib.loads(blob)
    except (plistlib.InvalidFileException, ValueError, TypeError, OverflowError, ExpatError):
        return None
    if not isinstance(archive, dict) or archive.get("$archiver") != "NSKeyedArchiver":
        return None
    objects = archive.get("$objects")
    if not isinstance(objects, list):
        return None

    def dereference(value):
        seen = set()
        while isinstance(value, plistlib.UID):
            index = value.data
            if index in seen or index < 0 or index >= len(objects):
                return None
            seen.add(index)
            value = objects[index]
        return None if value == "$null" else value

    def plain_label(value):
        value = dereference(value)
        if not isinstance(value, str):
            return None
        if any(unicodedata.category(character).startswith("C")
               or character in "\u2028\u2029" for character in value):
            return None
        value = value.strip()
        return value if value and len(value) <= 80 else None

    for record in objects:
        if not isinstance(record, dict) or "postalAddress" not in record:
            continue
        address = dereference(record["postalAddress"])
        if not isinstance(address, dict):
            continue
        address_class = dereference(address.get("$class"))
        if not isinstance(address_class, dict) or address_class.get("$classname") != "CNPostalAddress":
            continue
        labels = []
        for key in ("_state", "_city"):
            label = plain_label(address.get(key))
            if label and label not in labels:
                labels.append(label)
        if labels:
            return "・".join(labels)
    return None


def read_assets(library):
    database = library / "database" / "Photos.sqlite"
    if not database.is_file():
        raise ValueError("Photos.sqlite was not found in the selected library.")
    # mode=ro honors the live WAL while prohibiting writes. Do not use immutable,
    # which can silently omit recent library changes still present in the WAL.
    with sqlite3.connect(database.as_uri() + "?mode=ro", timeout=10) as connection:
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA query_only = ON")
        required = {
            "ZASSET": {
                "ZUUID", "ZKIND", "ZTRASHEDSTATE", "ZHIDDEN", "ZVISIBILITYSTATE",
                "ZBUNDLESCOPE", "ZADDITIONALATTRIBUTES", "ZDATECREATED", "ZWIDTH",
                "ZHEIGHT", "ZLATITUDE", "ZLONGITUDE", "ZFAVORITE", "ZFILENAME",
                "ZDIRECTORY", "ZADJUSTMENTSSTATE",
            },
            "ZADDITIONALASSETATTRIBUTES": {
                "Z_PK", "ZREVERSELOCATIONDATA", "ZORIGINALFILENAME", "ZTIMEZONEOFFSET",
            },
        }
        for table, columns in required.items():
            present = {row[1] for row in connection.execute("PRAGMA table_info(" + table + ")")}
            if not columns.issubset(present):
                raise ValueError("The Photos database schema is unsupported; existing catalog was kept.")
        connection.execute("BEGIN")
        rows = connection.execute("""
            SELECT asset.ZUUID AS uuid, asset.ZDATECREATED AS captured,
                   asset.ZWIDTH AS width, asset.ZHEIGHT AS height,
                   asset.ZLATITUDE AS latitude, asset.ZLONGITUDE AS longitude,
                   asset.ZFAVORITE AS favorite, asset.ZFILENAME AS filename,
                   asset.ZDIRECTORY AS directory, asset.ZADJUSTMENTSSTATE AS adjustments,
                   extra.ZORIGINALFILENAME AS original_filename,
                   extra.ZTIMEZONEOFFSET AS timezone_offset,
                   extra.ZREVERSELOCATIONDATA AS reverse_location
            FROM ZASSET AS asset
            JOIN ZADDITIONALASSETATTRIBUTES AS extra
              ON extra.Z_PK = asset.ZADDITIONALATTRIBUTES
            WHERE asset.ZKIND = 0 AND asset.ZTRASHEDSTATE = 0
              AND asset.ZHIDDEN = 0 AND asset.ZVISIBILITYSTATE = 0
              AND asset.ZBUNDLESCOPE = 0
            ORDER BY asset.ZDATECREATED DESC, asset.ZUUID ASC
        """).fetchall()
    candidates = []
    for row in rows:
        code = country_code(row["reverse_location"])
        if not code or code in EXCLUDED_COUNTRIES:
            continue
        identifier = row["uuid"] or ""
        if not UUID_PATTERN.fullmatch(identifier):
            continue
        candidates.append((dict(row), code, identifier.lower()))
    return candidates


def index_images(root, candidate_ids, library):
    """Index only candidate image paths; skip thumbnail databases and symlinks."""
    result = defaultdict(list)
    if not root.is_dir():
        return result
    for directory, subdirectories, filenames in os.walk(root, followlinks=False):
        subdirectories[:] = sorted(
            name for name in subdirectories
            if name != "thumbs" and not (Path(directory) / name).is_symlink()
        )
        for filename in filenames:
            identifier = filename[:36].lower()
            if identifier not in candidate_ids:
                continue
            path = Path(directory) / filename
            if path.suffix.lower() not in IMAGE_SUFFIXES or path.is_symlink():
                continue
            if path.is_file() and path.stat().st_size > 0 and path.resolve().is_relative_to(library):
                result[identifier].append(path)
    return result


def image_dimensions(path):
    """Read PNG/JPEG dimensions cheaply without Pillow or image conversion.

    Photos' JPEG derivatives are already oriented. Asset width/height describe
    the display orientation too; applying ZORIENTATION a second time is wrong.
    """
    try:
        with path.open("rb") as handle:
            header = handle.read(24)
            if header[:8] == b"\x89PNG\r\n\x1a\n" and len(header) == 24:
                return struct.unpack(">II", header[16:24])
            if header[:2] != b"\xff\xd8":
                return None
            handle.seek(2)
            while True:
                prefix = handle.read(1)
                if not prefix:
                    return None
                if prefix != b"\xff":
                    continue
                marker = handle.read(1)
                while marker == b"\xff":
                    marker = handle.read(1)
                if not marker or marker in {b"\xda", b"\xd9"}:
                    return None
                if marker in {b"\x01", b"\xd8"} or b"\xd0" <= marker <= b"\xd7":
                    continue
                raw_length = handle.read(2)
                if len(raw_length) != 2:
                    return None
                length = struct.unpack(">H", raw_length)[0]
                if length < 2:
                    return None
                if marker in {bytes([n]) for n in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF)}:
                    dimensions = handle.read(5)
                    if len(dimensions) != 5:
                        return None
                    height, width = struct.unpack(">HH", dimensions[1:5])
                    return width, height
                handle.seek(length - 2, 1)
    except (OSError, struct.error):
        return None


def largest_image(paths, dimensions):
    if not paths:
        return None

    def rank(path):
        size = dimensions.setdefault(path, image_dimensions(path))
        pixels = size[0] * size[1] if size else 0
        return pixels, path.stat().st_size, str(path)

    return max(paths, key=rank)


def timestamp_values(seconds, offset):
    if seconds is None:
        return None, None
    try:
        instant = APPLE_EPOCH + timedelta(seconds=float(seconds))
        local_offset = float(offset or 0)
        if not math.isfinite(local_offset) or abs(local_offset) > 86400:
            local_offset = 0
        local_date = (instant + timedelta(seconds=local_offset)).date().isoformat()
        return instant.isoformat(timespec="seconds").replace("+00:00", "Z"), local_date
    except (ValueError, TypeError, OverflowError):
        return None, None


def coordinates(latitude, longitude):
    try:
        latitude, longitude = float(latitude), float(longitude)
    except (ValueError, TypeError):
        return None, None
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return None, None
    return latitude, longitude


def build_catalog(library):
    candidates = read_assets(library)
    identifiers = {identifier for _, _, identifier in candidates}
    derivatives_root = library / "resources" / "derivatives"
    derivatives = index_images(derivatives_root, identifiers, library)
    renders = index_images(library / "resources" / "renders", identifiers, library)
    originals = index_images(library / "originals", identifiers, library)
    dimensions = {}
    photos = []
    for row, code, identifier in candidates:
        local_derivatives = derivatives.get(identifier, [])
        current_derivatives = [
            path for path in local_derivatives
            if path.suffix.lower() in BROWSER_SUFFIXES
            and "masters" not in path.relative_to(derivatives_root).parts
        ]
        render = largest_image(renders.get(identifier, []), dimensions)
        original = largest_image(originals.get(identifier, []), dimensions)
        # Older libraries may retain a non-UUID filename. Accept only an existing
        # path inside originals, with no traversal or symlink out of the library.
        if original is None and row["filename"] and row["directory"]:
            candidate = library / row["directory"] / row["filename"]
            resolved = candidate.resolve()
            if (resolved.is_relative_to(library / "originals") and candidate.is_file()
                    and candidate.stat().st_size > 0 and candidate.suffix.lower() in IMAGE_SUFFIXES):
                original = resolved
        preview = (
            largest_image(current_derivatives, dimensions)
            or render
            or original
            or largest_image(local_derivatives, dimensions)
        )
        preview_size = image_dimensions(preview) if preview else None
        captured, date = timestamp_values(row["captured"], row["timezone_offset"])
        latitude, longitude = coordinates(row["latitude"], row["longitude"])
        title, category = COUNTRIES.get(code, (code, code))
        photos.append({
            "id": identifier,
            "source": "apple",
            "title": title,
            "category": category,
            "countryCode": code,
            "locationLabel": broad_location(row["reverse_location"]),
            "capturedAt": captured,
            "date": date,
            "width": row["width"],
            "height": row["height"],
            "previewWidth": preview_size[0] if preview_size else None,
            "previewHeight": preview_size[1] if preview_size else None,
            "latitude": latitude,
            "longitude": longitude,
            "favorite": bool(row["favorite"]),
            "filename": row["original_filename"] or row["filename"],
            "hasEdits": bool(row["adjustments"]),
            "previewPath": str(preview) if preview else None,
            "renderPath": str(render) if render else None,
            "originalPath": str(original) if original else None,
            "available": preview is not None,
        })
    return {
        "version": 1,
        "importedAt": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "sourceLibrary": str(library),
        "photos": photos,
    }


def write_catalog(output, catalog):
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        # Restrictive permissions: this file contains precise private locations.
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=output.parent,
                                         prefix=".catalog-", suffix=".json", delete=False) as handle:
            temporary = Path(handle.name)
            json.dump(catalog, handle, ensure_ascii=False, indent=2, allow_nan=False)
            handle.write("\n")
        os.replace(temporary, output)
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--library", type=Path, default=DEFAULT_LIBRARY,
                        help="Path to a .photoslibrary package (read-only).")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT,
                        help="Private local catalog path; must not be inside the Photos library.")
    args = parser.parse_args()
    library = args.library.expanduser().resolve()
    output = args.output.expanduser().resolve()
    if output.is_relative_to(library):
        parser.error("The output must be outside the Photos library.")
    try:
        catalog = build_catalog(library)
        write_catalog(output, catalog)
    except ValueError as error:
        print("Import stopped: " + str(error), file=sys.stderr)
        return 1
    except (OSError, sqlite3.Error):
        # Do not leak private filenames or DB contents in routine CLI logs.
        print("Import stopped: unable to read the library or write the local catalog. "
              "Check permissions and close/reopen Photos if necessary.", file=sys.stderr)
        return 1
    photos = catalog["photos"]
    counts = Counter(photo["countryCode"] for photo in photos)
    print("Imported " + str(len(photos)) + " photos from " + str(len(counts)) + " countries.")
    for code, count in sorted(counts.items()):
        print(code + ": " + str(count))
    print("Local previews: " + str(sum(photo["available"] for photo in photos)))
    print("Local originals: " + str(sum(bool(photo["originalPath"]) for photo in photos)))
    print("Local edited renders: " + str(sum(bool(photo["renderPath"]) for photo in photos)))
    print("Selection and publication files were not changed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
