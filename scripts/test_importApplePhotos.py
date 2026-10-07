"""Synthetic location parser tests; never open or modify a Photos library."""

import plistlib
import unittest

from importApplePhotos import broad_location, country_code


def archive_blob(state="東京都", city="新宿区", *, extras=None):
    objects = [
        "$null",
        {"countryCode": plistlib.UID(6), "postalAddress": plistlib.UID(2)},
        {
            "$class": plistlib.UID(3),
            "_state": plistlib.UID(4),
            "_city": plistlib.UID(5),
            "_ISOCountryCode": plistlib.UID(6),
        },
        {"$classname": "CNPostalAddress", "$classes": ["CNPostalAddress", "NSObject"]},
        state,
        city,
        "JP",
    ]
    if extras:
        objects[2].update(extras)
    return {
        "$archiver": "NSKeyedArchiver",
        "$version": 100000,
        "$top": {"root": plistlib.UID(1)},
        "$objects": objects,
    }


def encode(archive):
    return plistlib.dumps(archive, fmt=plistlib.FMT_BINARY)


class BroadLocationTests(unittest.TestCase):
    def test_resolves_postal_address_and_value_uid_chains(self):
        archive = archive_blob()
        archive["$objects"].extend([plistlib.UID(2), plistlib.UID(4)])
        archive["$objects"][1]["postalAddress"] = plistlib.UID(7)
        archive["$objects"][2]["_state"] = plistlib.UID(8)
        self.assertEqual(broad_location(encode(archive)), "東京都・新宿区")

    def test_trims_and_deduplicates_state_and_city(self):
        self.assertEqual(broad_location(encode(archive_blob(" シンガポール ", "シンガポール"))), "シンガポール")

    def test_null_sentinel_and_missing_parts(self):
        archive = archive_blob("京畿道")
        archive["$objects"][2]["_city"] = plistlib.UID(0)
        self.assertEqual(broad_location(encode(archive)), "京畿道")
        archive["$objects"][2]["_state"] = plistlib.UID(0)
        self.assertIsNone(broad_location(encode(archive)))
        del archive["$objects"][2]["_state"]
        self.assertIsNone(broad_location(encode(archive)))
        self.assertEqual(broad_location(encode(archive_blob("$null", "ローマ"))), "ローマ")

    def test_ignores_every_field_except_direct_state_and_city(self):
        archive = archive_blob("$null", "$null", extras={
            "_street": "PRIVATE STREET",
            "_postalCode": "PRIVATE POSTCODE",
            "_subLocality": "PRIVATE NEIGHBORHOOD",
            "_subAdministrativeArea": "UNREQUESTED DISTRICT",
            "_formattedAddress": "PRIVATE ADDRESS",
            "mapItem": {"latitude": 1.234, "longitude": 2.345},
            "nested": {"_state": "NESTED STATE", "_city": "NESTED CITY"},
        })
        archive["$objects"][1].update({
            "addressString": "PRIVATE ADDRESS", "_state": "WRONG STATE", "_city": "WRONG CITY",
        })
        archive["$objects"].append({"_state": "UNRELATED STATE", "_city": "UNRELATED CITY"})
        self.assertIsNone(broad_location(encode(archive)))

    def test_requires_known_postal_address_class(self):
        for class_value in ["UnexpectedClass", "$null"]:
            with self.subTest(class_value=class_value):
                archive = archive_blob()
                archive["$objects"][3]["$classname"] = class_value
                self.assertIsNone(broad_location(encode(archive)))
        archive = archive_blob()
        del archive["$objects"][2]["$class"]
        self.assertIsNone(broad_location(encode(archive)))

    def test_invalid_uid_and_cycles_are_ignored(self):
        for value in [plistlib.UID(999), plistlib.UID(7)]:
            with self.subTest(value=value):
                archive = archive_blob()
                archive["$objects"].append(plistlib.UID(7))
                archive["$objects"][1]["postalAddress"] = value
                self.assertIsNone(broad_location(encode(archive)))
        archive = archive_blob()
        archive["$objects"].extend([plistlib.UID(8), plistlib.UID(7)])
        archive["$objects"][2]["_state"] = plistlib.UID(7)
        self.assertEqual(broad_location(encode(archive)), "新宿区")

    def test_malformed_values_controls_and_length_are_rejected(self):
        for state in [42, True, [], {"NS.string": "NOT PLAIN TEXT"}, b"bytes", "", "   ",
                      "x" * 81, "new\nline", "tab\tname", "hidden\u200bname", "line\u2028break"]:
            with self.subTest(state=state):
                self.assertEqual(broad_location(encode(archive_blob(state, "ローマ"))), "ローマ")
        self.assertEqual(broad_location(encode(archive_blob("x" * 80, "$null"))), "x" * 80)

    def test_malformed_archive_is_ignored(self):
        for value in [None, b"", b"not a plist", b"bplist00broken", b"<?xml version='1.0'?><plist><broken>",
                      encode([]), encode({"$objects": []}),
                      encode({"$archiver": "NSKeyedArchiver", "$objects": "not a list"})]:
            with self.subTest(value=value):
                self.assertIsNone(broad_location(value))

    def test_country_code_behavior_is_unchanged(self):
        archive = archive_blob()
        self.assertEqual(country_code(encode(archive)), "JP")
        archive["$objects"][1]["countryCode"] = "kr"
        self.assertEqual(country_code(encode(archive)), "KR")
        del archive["$objects"][1]["countryCode"]
        self.assertEqual(country_code(encode(archive)), "JP")


if __name__ == "__main__":
    unittest.main()
