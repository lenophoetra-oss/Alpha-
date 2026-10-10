import struct
import zlib
import hashlib
import subprocess
import os
import sys
import base64
import json

APP_URL = "https://ais-pre-mepg7bs4c56nwygjtymarj-965899113239.asia-east1.run.app"
PACKAGE_NAME = "id.kasirkonter.gadaipro"
APP_NAME = "Kasir Konter & Gadai Pro"
APK_VERSION_NAME = "3.1.0"
APK_VERSION_CODE = 7

def uleb128(val):
    out = bytearray()
    while True:
        byte = val & 0x7F
        val >>= 7
        if val != 0:
            byte |= 0x80
        out.append(byte)
        if val == 0:
            break
    return bytes(out)

# ---------------------------------------------------------------------------
# 1. Generate 192x192 PNG Icon (Emerald & Slate Kasir Icon)
# ---------------------------------------------------------------------------
def make_png_icon(width=192, height=192):
    raw_rows = bytearray()
    cx, cy = width / 2.0, height / 2.0
    for y in range(height):
        raw_rows.append(0)
        for x in range(width):
            dx = max(abs(x - cx) - (width * 0.32), 0.0)
            dy = max(abs(y - cy) - (height * 0.32), 0.0)
            dist = (dx * dx + dy * dy) ** 0.5
            radius = width * 0.16

            if dist > radius:
                raw_rows.extend((0, 0, 0, 0))
            else:
                r, g, b, a = 15, 23, 42, 255
                nx = (x - width * 0.5) / (width * 0.5)
                ny = (y - height * 0.5) / (height * 0.5)

                in_k_left = (-0.38 <= nx <= -0.20) and (-0.42 <= ny <= 0.42)
                in_k_diag1 = (-0.20 <= nx <= 0.32) and abs(ny + (nx + 0.20) * 0.8) < 0.11 and (ny <= 0.05)
                in_k_diag2 = (-0.20 <= nx <= 0.35) and abs(ny - (nx + 0.20) * 0.8) < 0.11 and (ny >= -0.05)

                if in_k_left or in_k_diag1 or in_k_diag2:
                    r, g, b = 16, 185, 129
                elif abs(nx) < 0.65 and abs(ny) < 0.65 and (abs(abs(nx) - 0.62) < 0.03 or abs(abs(ny) - 0.62) < 0.03):
                    r, g, b = 30, 41, 59
                raw_rows.extend((r, g, b, a))

    def png_chunk(chunk_type, data):
        chunk = struct.pack(">I", len(data)) + chunk_type + data
        crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
        return chunk + struct.pack(">I", crc)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    compressed = zlib.compress(bytes(raw_rows), 9)
    return (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", ihdr)
        + png_chunk(b"IDAT", compressed)
        + png_chunk(b"IEND", b"")
    )

# ---------------------------------------------------------------------------
# 2. Generate Compiled Android Resources Table (resources.arsc)
# ---------------------------------------------------------------------------
def make_utf16_string_pool(strings):
    count = len(strings)
    header_size = 28
    offsets = []
    str_buf = bytearray()
    for s in strings:
        offsets.append(len(str_buf))
        u16 = s.encode("utf-16le")
        char_len = len(s)
        str_buf.extend(struct.pack("<H", char_len))
        str_buf.extend(u16)
        str_buf.extend(b"\x00\x00")

    while len(str_buf) % 4 != 0:
        str_buf.append(0)

    strings_start = header_size + 4 * count
    total_size = strings_start + len(str_buf)
    header = struct.pack(
        "<HHIIIIII",
        0x0001,
        header_size,
        total_size,
        count,
        0,
        0,
        strings_start,
        0,
    )
    offset_bytes = b"".join(struct.pack("<I", o) for o in offsets)
    return header + offset_bytes + bytes(str_buf)

def make_resources_arsc():
    global_pool = make_utf16_string_pool(["res/drawable/icon.png"])
    type_pool = make_utf16_string_pool(["drawable"])
    key_pool = make_utf16_string_pool(["icon"])

    type_spec = struct.pack(
        "<HHIBBHII",
        0x0202,
        16,
        20,
        1,
        0,
        0,
        1,
        0,
    )

    config = struct.pack("<I", 36) + (b"\x00" * 32)
    entry_and_val = struct.pack("<HHI", 8, 0, 0) + struct.pack("<HBBI", 8, 0, 0x03, 0)

    type_header_size = 20 + len(config)
    entries_start = type_header_size + 4
    type_total_size = entries_start + len(entry_and_val)

    type_chunk = (
        struct.pack(
            "<HHIBBHII",
            0x0201,
            type_header_size,
            type_total_size,
            1,
            0,
            0,
            1,
            entries_start,
        )
        + config
        + struct.pack("<I", 0)
        + entry_and_val
    )

    pkg_header_size = 288
    pkg_name_u16 = PACKAGE_NAME.encode("utf-16le")
    pkg_name_padded = pkg_name_u16 + b"\x00" * (256 - len(pkg_name_u16))

    type_strings_offset = pkg_header_size
    key_strings_offset = type_strings_offset + len(type_pool)
    pkg_body = type_pool + key_pool + type_spec + type_chunk
    pkg_total_size = pkg_header_size + len(pkg_body)

    pkg_header = (
        struct.pack("<HHI", 0x0200, pkg_header_size, pkg_total_size)
        + struct.pack("<I", 0x7F)
        + pkg_name_padded
        + struct.pack(
            "<IIIII",
            type_strings_offset,
            1,
            key_strings_offset,
            1,
            0,
        )
    )
    assert len(pkg_header) == 288

    pkg_chunk = pkg_header + pkg_body
    total_table_size = 12 + len(global_pool) + len(pkg_chunk)
    table_header = struct.pack("<HHII", 0x0002, 12, total_table_size, 1)
    return table_header + global_pool + pkg_chunk

# ---------------------------------------------------------------------------
# 3. Generate Compiled Binary AndroidManifest.xml (AXML)
#    Includes INTERNET, ACCESS_NETWORK_STATE, and READ_CONTACTS permissions
# ---------------------------------------------------------------------------
def make_axml_manifest():
    attr_specs = [
        ("theme", 0x01010000),
        ("label", 0x01010001),
        ("icon", 0x01010002),
        ("name", 0x01010003),
        ("exported", 0x01010010),
        ("configChanges", 0x0101001F),
        ("minSdkVersion", 0x0101020C),
        ("versionCode", 0x0101021B),
        ("versionName", 0x0101021C),
        ("targetSdkVersion", 0x01010270),
        ("hardwareAccelerated", 0x010102D3),
        ("usesCleartextTraffic", 0x010104EC),
    ]
    other_strings = [
        "http://schemas.android.com/apk/res/android",
        "android",
        "manifest",
        "package",
        PACKAGE_NAME,
        APK_VERSION_NAME,
        "uses-sdk",
        "uses-permission",
        "android.permission.INTERNET",
        "android.permission.ACCESS_NETWORK_STATE",
        "android.permission.READ_CONTACTS",
        "application",
        APP_NAME,
        "activity",
        PACKAGE_NAME + ".MainActivity",
        "intent-filter",
        "action",
        "android.intent.action.MAIN",
        "category",
        "android.intent.category.LAUNCHER",
    ]
    all_strings = [a[0] for a in attr_specs] + other_strings
    s_idx = {s: i for i, s in enumerate(all_strings)}

    string_pool = make_utf16_string_pool(all_strings)

    res_ids = [a[1] for a in attr_specs]
    res_map_size = 8 + 4 * len(res_ids)
    res_map_chunk = struct.pack("<HHI", 0x0180, 8, res_map_size) + b"".join(
        struct.pack("<I", rid) for rid in res_ids
    )

    ns_uri = s_idx["http://schemas.android.com/apk/res/android"]
    ns_prefix = s_idx["android"]

    def make_start_ns(line=1):
        return struct.pack("<HHIII", 0x0100, 16, 24, line, 0xFFFFFFFF) + struct.pack("<II", ns_prefix, ns_uri)

    def make_end_ns(line=1):
        return struct.pack("<HHIII", 0x0101, 16, 24, line, 0xFFFFFFFF) + struct.pack("<II", ns_prefix, ns_uri)

    def make_attr(ns, name_str, raw_val_str, val_type, val_data):
        name_i = s_idx[name_str]
        raw_i = s_idx[raw_val_str] if raw_val_str is not None else 0xFFFFFFFF
        return struct.pack(
            "<IIIHBBI",
            ns & 0xFFFFFFFF,
            name_i,
            raw_i,
            8,
            0,
            val_type,
            val_data & 0xFFFFFFFF,
        )

    def make_start_el(tag_str, attrs, line=1):
        attr_bytes = b"".join(attrs)
        total_len = 36 + len(attr_bytes)
        return (
            struct.pack(
                "<HHIIIIIHHHHHH",
                0x0102,
                16,
                total_len,
                line,
                0xFFFFFFFF,
                0xFFFFFFFF,
                s_idx[tag_str],
                20,
                20,
                len(attrs),
                0,
                0,
                0,
            )
            + attr_bytes
        )

    def make_end_el(tag_str, line=1):
        return struct.pack(
            "<HHIIIII",
            0x0103,
            16,
            24,
            line,
            0xFFFFFFFF,
            0xFFFFFFFF,
            s_idx[tag_str],
        )

    TYPE_REFERENCE = 0x01
    TYPE_STRING = 0x03
    TYPE_INT_DEC = 0x10
    TYPE_INT_HEX = 0x11
    TYPE_INT_BOOL = 0x12

    chunks = [
        string_pool,
        res_map_chunk,
        make_start_ns(2),
        make_start_el(
            "manifest",
            [
                make_attr(ns_uri, "versionCode", None, TYPE_INT_DEC, APK_VERSION_CODE),
                make_attr(ns_uri, "versionName", APK_VERSION_NAME, TYPE_STRING, s_idx[APK_VERSION_NAME]),
                make_attr(0xFFFFFFFF, "package", PACKAGE_NAME, TYPE_STRING, s_idx[PACKAGE_NAME]),
            ],
            2,
        ),
        make_start_el(
            "uses-sdk",
            [
                make_attr(ns_uri, "minSdkVersion", None, TYPE_INT_DEC, 21),
                make_attr(ns_uri, "targetSdkVersion", None, TYPE_INT_DEC, 29),
            ],
            3,
        ),
        make_end_el("uses-sdk", 3),
        make_start_el(
            "uses-permission",
            [
                make_attr(
                    ns_uri,
                    "name",
                    "android.permission.INTERNET",
                    TYPE_STRING,
                    s_idx["android.permission.INTERNET"],
                )
            ],
            4,
        ),
        make_end_el("uses-permission", 4),
        make_start_el(
            "uses-permission",
            [
                make_attr(
                    ns_uri,
                    "name",
                    "android.permission.ACCESS_NETWORK_STATE",
                    TYPE_STRING,
                    s_idx["android.permission.ACCESS_NETWORK_STATE"],
                )
            ],
            5,
        ),
        make_end_el("uses-permission", 5),
        make_start_el(
            "uses-permission",
            [
                make_attr(
                    ns_uri,
                    "name",
                    "android.permission.READ_CONTACTS",
                    TYPE_STRING,
                    s_idx["android.permission.READ_CONTACTS"],
                )
            ],
            6,
        ),
        make_end_el("uses-permission", 6),
        make_start_el(
            "application",
            [
                make_attr(ns_uri, "theme", None, TYPE_REFERENCE, 0x01030006),
                make_attr(ns_uri, "label", APP_NAME, TYPE_STRING, s_idx[APP_NAME]),
                make_attr(ns_uri, "icon", None, TYPE_REFERENCE, 0x7F010000),
                make_attr(ns_uri, "hardwareAccelerated", None, TYPE_INT_BOOL, 0xFFFFFFFF),
                make_attr(ns_uri, "usesCleartextTraffic", None, TYPE_INT_BOOL, 0xFFFFFFFF),
            ],
            7,
        ),
        make_start_el(
            "activity",
            [
                make_attr(ns_uri, "label", APP_NAME, TYPE_STRING, s_idx[APP_NAME]),
                make_attr(
                    ns_uri,
                    "name",
                    PACKAGE_NAME + ".MainActivity",
                    TYPE_STRING,
                    s_idx[PACKAGE_NAME + ".MainActivity"],
                ),
                make_attr(ns_uri, "exported", None, TYPE_INT_BOOL, 0xFFFFFFFF),
                make_attr(ns_uri, "configChanges", None, TYPE_INT_HEX, 0x04A0),
            ],
            8,
        ),
        make_start_el("intent-filter", [], 9),
        make_start_el(
            "action",
            [
                make_attr(
                    ns_uri,
                    "name",
                    "android.intent.action.MAIN",
                    TYPE_STRING,
                    s_idx["android.intent.action.MAIN"],
                )
            ],
            10,
        ),
        make_end_el("action", 10),
        make_start_el(
            "category",
            [
                make_attr(
                    ns_uri,
                    "name",
                    "android.intent.category.LAUNCHER",
                    TYPE_STRING,
                    s_idx["android.intent.category.LAUNCHER"],
                )
            ],
            11,
        ),
        make_end_el("category", 11),
        make_end_el("intent-filter", 9),
        make_end_el("activity", 8),
        make_end_el("application", 7),
        make_end_el("manifest", 2),
        make_end_ns(2),
    ]

    body = b"".join(chunks)
    header = struct.pack("<HHI", 0x0003, 8, 8 + len(body))
    return header + body

# ---------------------------------------------------------------------------
# 4. Generate Dalvik Executable (classes.dex) for MainActivity & ChromeClient
#    Supports Native Android Contact Picker (Intent.ACTION_PICK) + WebView
# ---------------------------------------------------------------------------
def assemble_dalvik(items):
    """Two-pass assembler for Dalvik instructions with automatic branch offset computation."""
    labels = {}
    unit_offset = 0
    for item in items:
        kind = item[0]
        if kind == "label":
            labels[item[1]] = unit_offset
        elif kind == "bytes":
            assert len(item[1]) % 2 == 0
            unit_offset += len(item[1]) // 2
        elif kind in ("if_eqz", "if_nez", "if_ltz", "if_gez", "if_ne"):
            unit_offset += 2
        else:
            raise ValueError(f"Unknown instruction item: {item}")

    out = bytearray()
    cur_unit = 0
    opcode_map = {
        "if_eqz": 0x38,
        "if_nez": 0x39,
        "if_ltz": 0x3A,
        "if_gez": 0x3B,
    }
    for item in items:
        kind = item[0]
        if kind == "label":
            continue
        elif kind == "bytes":
            out.extend(item[1])
            cur_unit += len(item[1]) // 2
        elif kind in opcode_map:
            _, reg, target = item
            rel = labels[target] - cur_unit
            out.extend(struct.pack("<BBh", opcode_map[kind], reg & 0xFF, rel))
            cur_unit += 2
        elif kind == "if_ne":
            _, reg_a, reg_b, target = item
            rel = labels[target] - cur_unit
            reg_byte = ((reg_b & 0x0F) << 4) | (reg_a & 0x0F)
            out.extend(struct.pack("<BBh", 0x33, reg_byte, rel))
            cur_unit += 2
    return bytes(out)

def make_classes_dex():
    UA_STR = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
    URL_STR = "file:///android_asset/index.html"
    CONTACTS_URI_STR = "content://com.android.contacts/data/phones"
    ACTION_PICK_STR = "android.intent.action.PICK"
    ACTION_VIEW_STR = "android.intent.action.VIEW"
    PICK_CMD_STR = "PICK_CONTACT"
    EXIT_CMD_STR = "EXIT_APP"
    JS_BACK_STR = "javascript:window.__onAndroidBackPressed&&window.__onAndroidBackPressed()"
    COL_NAME_STR = "display_name"
    COL_PHONE_STR = "data1"
    JS_PREFIX_STR = "javascript:window.__onAndroidContactPicked&&window.__onAndroidContactPicked('"
    JS_MID_STR = "','"
    JS_SUFFIX_STR = "')"
    EMPTY_STR = ""

    raw_strings = [
        EMPTY_STR,
        "<init>",
        "ChromeClient.java",
        "I",
        "II",
        "L",
        "LI",
        "LL",
        "LLLLL",
        "LLLLLL",
        " Landroid/app/Activity;".strip(),
        "Landroid/content/ContentResolver;",
        "Landroid/content/Context;",
        "Landroid/content/Intent;",
        "Landroid/database/Cursor;",
        "Landroid/net/Uri;",
        "Landroid/os/Bundle;",
        "Landroid/view/View;",
        "Landroid/webkit/JsPromptResult;",
        "Landroid/webkit/JsResult;",
        "Landroid/webkit/WebChromeClient;",
        "Landroid/webkit/WebSettings;",
        "Landroid/webkit/WebView;",
        "Lid/kasirkonter/gadaipro/ChromeClient;",
        "Lid/kasirkonter/gadaipro/MainActivity;",
        "Ljava/lang/Object;",
        "Ljava/lang/String;",
        "[Ljava/lang/String;",
        "MainActivity.java",
        UA_STR,
        PICK_CMD_STR,
        EXIT_CMD_STR,
        JS_BACK_STR,
        "V",
        "VI",
        "VII",
        "VIIL",
        "VL",
        "VLI",
        "VLL",
        "VZ",
        "Z",
        "ZL",
        "ZLLLLL",
        "act",
        ACTION_PICK_STR,
        ACTION_VIEW_STR,
        "canGoBack",
        "cancel",
        "close",
        "concat",
        CONTACTS_URI_STR,
        COL_PHONE_STR,
        COL_NAME_STR,
        "encode",
        "equals",
        URL_STR,
        "getColumnIndex",
        "getContentResolver",
        "getData",
        "getSettings",
        "getString",
        "goBack",
        JS_PREFIX_STR,
        JS_MID_STR,
        JS_SUFFIX_STR,
        "loadUrl",
        "moveToFirst",
        "onActivityResult",
        "onBackPressed",
        "onBridgeCmd",
        "onCreate",
        "onJsPrompt",
        "parse",
        "query",
        "setContentView",
        "setDatabaseEnabled",
        "setDomStorageEnabled",
        "setJavaScriptEnabled",
        "setUserAgentString",
        "setWebChromeClient",
        "startActivity",
        "startActivityForResult",
        "wv",
    ]
    strings = sorted(set(raw_strings))
    s_idx = {s: i for i, s in enumerate(strings)}

    raw_types = [
        "I",
        "Landroid/app/Activity;",
        "Landroid/content/ContentResolver;",
        "Landroid/content/Context;",
        "Landroid/content/Intent;",
        "Landroid/database/Cursor;",
        "Landroid/net/Uri;",
        "Landroid/os/Bundle;",
        "Landroid/view/View;",
        "Landroid/webkit/JsPromptResult;",
        "Landroid/webkit/JsResult;",
        "Landroid/webkit/WebChromeClient;",
        "Landroid/webkit/WebSettings;",
        "Landroid/webkit/WebView;",
        "Lid/kasirkonter/gadaipro/ChromeClient;",
        "Lid/kasirkonter/gadaipro/MainActivity;",
        "Ljava/lang/Object;",
        "Ljava/lang/String;",
        "[Ljava/lang/String;",
        "V",
        "Z",
    ]
    types = sorted(raw_types, key=lambda t: s_idx[t])
    t_idx = {t: i for i, t in enumerate(types)}

    raw_protos = [
        ("V", "V", []),
        ("Z", "Z", []),
        ("I", "I", []),
        ("IL", "I", ["Ljava/lang/String;"]),
        ("L", "Landroid/content/ContentResolver;", []),
        ("L", "Landroid/net/Uri;", []),
        ("L", "Landroid/webkit/WebSettings;", []),
        ("LI", "Ljava/lang/String;", ["I"]),
        ("LL", "Landroid/net/Uri;", ["Ljava/lang/String;"]),
        ("LL", "Ljava/lang/String;", ["Ljava/lang/String;"]),
        (
            "LLLLLL",
            "Landroid/database/Cursor;",
            [
                "Landroid/net/Uri;",
                "[Ljava/lang/String;",
                "Ljava/lang/String;",
                "[Ljava/lang/String;",
                "Ljava/lang/String;",
            ],
        ),
        ("VIIL", "V", ["I", "I", "Landroid/content/Intent;"]),
        ("VL", "V", ["Landroid/content/Context;"]),
        ("VL", "V", ["Landroid/content/Intent;"]),
        ("VL", "V", ["Landroid/os/Bundle;"]),
        ("VL", "V", ["Landroid/view/View;"]),
        ("VL", "V", ["Landroid/webkit/WebChromeClient;"]),
        ("VL", "V", ["Lid/kasirkonter/gadaipro/MainActivity;"]),
        ("VL", "V", ["Ljava/lang/String;"]),
        ("VLI", "V", ["Landroid/content/Intent;", "I"]),
        ("VLL", "V", ["Ljava/lang/String;", "Landroid/net/Uri;"]),
        ("VZ", "V", ["Z"]),
        ("ZL", "Z", ["Ljava/lang/Object;"]),
        (
            "ZLLLLL",
            "Z",
            [
                "Landroid/webkit/WebView;",
                "Ljava/lang/String;",
                "Ljava/lang/String;",
                "Ljava/lang/String;",
                "Landroid/webkit/JsPromptResult;",
            ],
        ),
    ]
    for shorty, _, _ in raw_protos:
        if shorty not in s_idx:
            strings.append(shorty)
    strings = sorted(set(strings))
    s_idx = {s: i for i, s in enumerate(strings)}
    types = sorted(raw_types, key=lambda t: s_idx[t])
    t_idx = {t: i for i, t in enumerate(types)}

    raw_protos.sort(key=lambda p: (t_idx[p[1]], [t_idx[x] for x in p[2]]))
    p_idx = {(p[1], tuple(p[2])): i for i, p in enumerate(raw_protos)}

    raw_fields = [
        ("Lid/kasirkonter/gadaipro/ChromeClient;", "Lid/kasirkonter/gadaipro/MainActivity;", "act"),
        ("Lid/kasirkonter/gadaipro/MainActivity;", "Landroid/webkit/WebView;", "wv"),
    ]
    raw_fields.sort(key=lambda f: (t_idx[f[0]], s_idx[f[2]], t_idx[f[1]]))
    f_idx = {(f[0], f[2], f[1]): i for i, f in enumerate(raw_fields)}

    raw_methods = [
        ("Landroid/app/Activity;", ("Landroid/content/ContentResolver;", ()), "getContentResolver"),
        ("Landroid/app/Activity;", ("V", ()), "<init>"),
        ("Landroid/app/Activity;", ("V", ("I", "I", "Landroid/content/Intent;")), "onActivityResult"),
        ("Landroid/app/Activity;", ("V", ()), "onBackPressed"),
        ("Landroid/app/Activity;", ("V", ("Landroid/os/Bundle;",)), "onCreate"),
        ("Landroid/app/Activity;", ("V", ("Landroid/view/View;",)), "setContentView"),
        ("Landroid/app/Activity;", ("V", ("Landroid/content/Intent;",)), "startActivity"),
        ("Landroid/app/Activity;", ("V", ("Landroid/content/Intent;", "I")), "startActivityForResult"),
        (
            "Landroid/content/ContentResolver;",
            (
                "Landroid/database/Cursor;",
                (
                    "Landroid/net/Uri;",
                    "[Ljava/lang/String;",
                    "Ljava/lang/String;",
                    "[Ljava/lang/String;",
                    "Ljava/lang/String;",
                ),
            ),
            "query",
        ),
        ("Landroid/content/Intent;", ("V", ("Ljava/lang/String;", "Landroid/net/Uri;")), "<init>"),
        ("Landroid/content/Intent;", ("Landroid/net/Uri;", ()), "getData"),
        ("Landroid/database/Cursor;", ("V", ()), "close"),
        ("Landroid/database/Cursor;", ("I", ("Ljava/lang/String;",)), "getColumnIndex"),
        ("Landroid/database/Cursor;", ("Ljava/lang/String;", ("I",)), "getString"),
        ("Landroid/database/Cursor;", ("Z", ()), "moveToFirst"),
        ("Landroid/net/Uri;", ("Ljava/lang/String;", ("Ljava/lang/String;",)), "encode"),
        ("Landroid/net/Uri;", ("Landroid/net/Uri;", ("Ljava/lang/String;",)), "parse"),
        ("Landroid/webkit/JsResult;", ("V", ()), "cancel"),
        ("Landroid/webkit/WebChromeClient;", ("V", ()), "<init>"),
        ("Landroid/webkit/WebSettings;", ("V", ("Z",)), "setDatabaseEnabled"),
        ("Landroid/webkit/WebSettings;", ("V", ("Z",)), "setDomStorageEnabled"),
        ("Landroid/webkit/WebSettings;", ("V", ("Z",)), "setJavaScriptEnabled"),
        ("Landroid/webkit/WebSettings;", ("V", ("Ljava/lang/String;",)), "setUserAgentString"),
        ("Landroid/webkit/WebView;", ("V", ("Landroid/content/Context;",)), "<init>"),
        ("Landroid/webkit/WebView;", ("Z", ()), "canGoBack"),
        ("Landroid/webkit/WebView;", ("Landroid/webkit/WebSettings;", ()), "getSettings"),
        ("Landroid/webkit/WebView;", ("V", ()), "goBack"),
        ("Landroid/webkit/WebView;", ("V", ("Ljava/lang/String;",)), "loadUrl"),
        ("Landroid/webkit/WebView;", ("V", ("Landroid/webkit/WebChromeClient;",)), "setWebChromeClient"),
        ("Lid/kasirkonter/gadaipro/ChromeClient;", ("V", ("Lid/kasirkonter/gadaipro/MainActivity;",)), "<init>"),
        (
            "Lid/kasirkonter/gadaipro/ChromeClient;",
            (
                "Z",
                (
                    "Landroid/webkit/WebView;",
                    "Ljava/lang/String;",
                    "Ljava/lang/String;",
                    "Ljava/lang/String;",
                    "Landroid/webkit/JsPromptResult;",
                ),
            ),
            "onJsPrompt",
        ),
        ("Lid/kasirkonter/gadaipro/MainActivity;", ("V", ()), "<init>"),
        ("Lid/kasirkonter/gadaipro/MainActivity;", ("V", ("I", "I", "Landroid/content/Intent;")), "onActivityResult"),
        ("Lid/kasirkonter/gadaipro/MainActivity;", ("V", ()), "onBackPressed"),
        ("Lid/kasirkonter/gadaipro/MainActivity;", ("V", ("Ljava/lang/String;",)), "onBridgeCmd"),
        ("Lid/kasirkonter/gadaipro/MainActivity;", ("V", ("Landroid/os/Bundle;",)), "onCreate"),
        ("Ljava/lang/String;", ("Ljava/lang/String;", ("Ljava/lang/String;",)), "concat"),
        ("Ljava/lang/String;", ("Z", ("Ljava/lang/Object;",)), "equals"),
    ]
    raw_methods.sort(key=lambda m: (t_idx[m[0]], s_idx[m[2]], p_idx[m[1]]))
    m_idx = {(m[0], m[2], m[1]): i for i, m in enumerate(raw_methods)}

    # --- 1. ChromeClient.<init>(MainActivity) ---
    f_cc_act = f_idx[("Lid/kasirkonter/gadaipro/ChromeClient;", "act", "Lid/kasirkonter/gadaipro/MainActivity;")]
    m_wcc_init = m_idx[("Landroid/webkit/WebChromeClient;", "<init>", ("V", ()))]
    insns_cc_init = (
        struct.pack("<BBHH", 0x70, 0x10, m_wcc_init, 0x0000)
        + struct.pack("<BBH", 0x5B, 0x01, f_cc_act)
        + struct.pack("<BB", 0x0E, 0x00)
    )
    code_cc_init = struct.pack("<HHHHII", 2, 2, 1, 0, 0, len(insns_cc_init) // 2) + insns_cc_init

    # --- 2. ChromeClient.onJsPrompt(WebView, String, String, String, JsPromptResult)Z ---
    # registers_size=7, ins_size=6 (v1=this, v2=view, v3=url, v4=message, v5=defaultVal, v6=result)
    m_jsresult_cancel = m_idx[("Landroid/webkit/JsResult;", "cancel", ("V", ()))]
    m_main_onbridge = m_idx[("Lid/kasirkonter/gadaipro/MainActivity;", "onBridgeCmd", ("V", ("Ljava/lang/String;",)))]
    insns_cc_prompt = assemble_dalvik([
        ("bytes", struct.pack("<BBHH", 0x6E, 0x10, m_jsresult_cancel, 0x0006)),
        ("bytes", struct.pack("<BBH", 0x54, 0x10, f_cc_act)),  # iget-object v0, v1, act
        ("if_eqz", 0, "done_prompt"),
        ("bytes", struct.pack("<BBHH", 0x6E, 0x20, m_main_onbridge, 0x0040)),  # v0.onBridgeCmd(v4)
        ("label", "done_prompt"),
        ("bytes", struct.pack("<BB", 0x12, 0x10)),  # const/4 v0, 1
        ("bytes", struct.pack("<BB", 0x0F, 0x00)),  # return v0
    ])
    code_cc_prompt = struct.pack("<HHHHII", 7, 6, 2, 0, 0, len(insns_cc_prompt) // 2) + insns_cc_prompt

    # --- 3. MainActivity.<init>()V ---
    m_act_init = m_idx[("Landroid/app/Activity;", "<init>", ("V", ()))]
    insns_init = struct.pack("<BBHH", 0x70, 0x10, m_act_init, 0x0000) + struct.pack("<BB", 0x0E, 0x00)
    code_init = struct.pack("<HHHHII", 1, 1, 1, 0, 0, len(insns_init) // 2) + insns_init

    # --- 4. MainActivity.onActivityResult(int req, int res, Intent data)V ---
    # registers_size=10, ins_size=4 (v6=this, v7=req, v8=res, v9=data)
    m_super_onactres = m_idx[("Landroid/app/Activity;", "onActivityResult", ("V", ("I", "I", "Landroid/content/Intent;")))]
    m_intent_getdata = m_idx[("Landroid/content/Intent;", "getData", ("Landroid/net/Uri;", ()))]
    m_act_getcr = m_idx[("Landroid/app/Activity;", "getContentResolver", ("Landroid/content/ContentResolver;", ()))]
    m_cr_query = m_idx[(
        "Landroid/content/ContentResolver;",
        "query",
        (
            "Landroid/database/Cursor;",
            (
                "Landroid/net/Uri;",
                "[Ljava/lang/String;",
                "Ljava/lang/String;",
                "[Ljava/lang/String;",
                "Ljava/lang/String;",
            ),
        ),
    )]
    m_cur_first = m_idx[("Landroid/database/Cursor;", "moveToFirst", ("Z", ()))]
    m_cur_colidx = m_idx[("Landroid/database/Cursor;", "getColumnIndex", ("I", ("Ljava/lang/String;",)))]
    m_cur_getstr = m_idx[("Landroid/database/Cursor;", "getString", ("Ljava/lang/String;", ("I",)))]
    m_cur_close = m_idx[("Landroid/database/Cursor;", "close", ("V", ()))]
    m_uri_encode = m_idx[("Landroid/net/Uri;", "encode", ("Ljava/lang/String;", ("Ljava/lang/String;",)))]
    m_str_concat = m_idx[("Ljava/lang/String;", "concat", ("Ljava/lang/String;", ("Ljava/lang/String;",)))]
    m_wv_loadurl = m_idx[("Landroid/webkit/WebView;", "loadUrl", ("V", ("Ljava/lang/String;",)))]
    f_wv = f_idx[("Lid/kasirkonter/gadaipro/MainActivity;", "wv", "Landroid/webkit/WebView;")]

    insns_onactres = assemble_dalvik([
        ("bytes", struct.pack("<BBHH", 0x6F, 0x40, m_super_onactres, 0x9876)),
        ("bytes", struct.pack("<BBh", 0x13, 0x00, 101)),  # const/16 v0, 101
        ("if_ne", 7, 0, "done"),
        ("bytes", struct.pack("<BBh", 0x13, 0x00, -1)),   # const/16 v0, -1 (RESULT_OK)
        ("if_ne", 8, 0, "done"),
        ("if_eqz", 9, "done"),
        ("bytes", struct.pack("<BBHH", 0x6E, 0x10, m_intent_getdata, 0x0009)),  # v9.getData()
        ("bytes", struct.pack("<BB", 0x0C, 0x01)),  # move-result-object v1 (uri)
        ("if_eqz", 1, "done"),
        ("bytes", struct.pack("<BBHH", 0x6E, 0x10, m_act_getcr, 0x0006)),  # v6.getContentResolver()
        ("bytes", struct.pack("<BB", 0x0C, 0x00)),  # move-result-object v0 (cr)
        ("bytes", struct.pack("<BB", 0x12, 0x02)),  # const/4 v2, 0
        ("bytes", struct.pack("<BB", 0x12, 0x03)),  # const/4 v3, 0
        ("bytes", struct.pack("<BB", 0x12, 0x04)),  # const/4 v4, 0
        ("bytes", struct.pack("<BB", 0x12, 0x05)),  # const/4 v5, 0
        ("bytes", struct.pack("<BBHH", 0x74, 6, m_cr_query, 0x0000)),  # invoke-virtual/range {v0..v5}
        ("bytes", struct.pack("<BB", 0x0C, 0x01)),  # move-result-object v1 (Cursor c)
        ("if_eqz", 1, "done"),
        ("bytes", struct.pack("<BBHH", 0x72, 0x10, m_cur_first, 0x0001)),  # c.moveToFirst()
        ("bytes", struct.pack("<BB", 0x0A, 0x00)),  # move-result v0
        ("if_eqz", 0, "close_cur"),
        # Read display_name
        ("bytes", struct.pack("<BBH", 0x1A, 0x00, s_idx[COL_NAME_STR])),
        ("bytes", struct.pack("<BBHH", 0x72, 0x20, m_cur_colidx, 0x0001)),
        ("bytes", struct.pack("<BB", 0x0A, 0x00)),
        ("bytes", struct.pack("<BBH", 0x1A, 0x02, s_idx[EMPTY_STR])),
        ("if_ltz", 0, "skip_name"),
        ("bytes", struct.pack("<BBHH", 0x72, 0x20, m_cur_getstr, 0x0001)),
        ("bytes", struct.pack("<BB", 0x0C, 0x02)),
        ("label", "skip_name"),
        ("bytes", struct.pack("<BBHH", 0x71, 0x10, m_uri_encode, 0x0002)),
        ("bytes", struct.pack("<BB", 0x0C, 0x02)),
        ("if_nez", 2, "name_ok"),
        ("bytes", struct.pack("<BBH", 0x1A, 0x02, s_idx[EMPTY_STR])),
        ("label", "name_ok"),
        # Read data1 (phone number)
        ("bytes", struct.pack("<BBH", 0x1A, 0x00, s_idx[COL_PHONE_STR])),
        ("bytes", struct.pack("<BBHH", 0x72, 0x20, m_cur_colidx, 0x0001)),
        ("bytes", struct.pack("<BB", 0x0A, 0x00)),
        ("bytes", struct.pack("<BBH", 0x1A, 0x03, s_idx[EMPTY_STR])),
        ("if_ltz", 0, "skip_phone"),
        ("bytes", struct.pack("<BBHH", 0x72, 0x20, m_cur_getstr, 0x0001)),
        ("bytes", struct.pack("<BB", 0x0C, 0x03)),
        ("label", "skip_phone"),
        ("bytes", struct.pack("<BBHH", 0x71, 0x10, m_uri_encode, 0x0003)),
        ("bytes", struct.pack("<BB", 0x0C, 0x03)),
        ("if_nez", 3, "phone_ok"),
        ("bytes", struct.pack("<BBH", 0x1A, 0x03, s_idx[EMPTY_STR])),
        ("label", "phone_ok"),
        # Build JS string
        ("bytes", struct.pack("<BBH", 0x1A, 0x00, s_idx[JS_PREFIX_STR])),
        ("bytes", struct.pack("<BBHH", 0x6E, 0x20, m_str_concat, 0x0020)),
        ("bytes", struct.pack("<BB", 0x0C, 0x00)),
        ("bytes", struct.pack("<BBH", 0x1A, 0x02, s_idx[JS_MID_STR])),
        ("bytes", struct.pack("<BBHH", 0x6E, 0x20, m_str_concat, 0x0020)),
        ("bytes", struct.pack("<BB", 0x0C, 0x00)),
        ("bytes", struct.pack("<BBHH", 0x6E, 0x20, m_str_concat, 0x0030)),
        ("bytes", struct.pack("<BB", 0x0C, 0x00)),
        ("bytes", struct.pack("<BBH", 0x1A, 0x02, s_idx[JS_SUFFIX_STR])),
        ("bytes", struct.pack("<BBHH", 0x6E, 0x20, m_str_concat, 0x0020)),
        ("bytes", struct.pack("<BB", 0x0C, 0x00)),
        # Call this.wv.loadUrl(js)
        ("bytes", struct.pack("<BBH", 0x54, 0x62, f_wv)),  # iget-object v2, v6, wv
        ("if_eqz", 2, "close_cur"),
        ("bytes", struct.pack("<BBHH", 0x6E, 0x20, m_wv_loadurl, 0x0002)),
        ("label", "close_cur"),
        ("bytes", struct.pack("<BBHH", 0x72, 0x10, m_cur_close, 0x0001)),
        ("label", "done"),
        ("bytes", struct.pack("<BB", 0x0E, 0x00)),
    ])
    code_onactres = struct.pack("<HHHHII", 10, 4, 6, 0, 0, len(insns_onactres) // 2) + insns_onactres

    # --- 5. MainActivity.onBackPressed()V ---
    # Always delegate Back button to JS window.__onAndroidBackPressed() so modals, drawer, and tabs navigate back cleanly without exiting the app
    m_super_back = m_idx[("Landroid/app/Activity;", "onBackPressed", ("V", ()))]
    insns_back = assemble_dalvik([
        ("bytes", struct.pack("<BBH", 0x54, 0x20, f_wv)),  # iget-object v0, v2 (this), wv
        ("if_eqz", 0, "call_super"),
        ("bytes", struct.pack("<BBH", 0x1A, 0x01, s_idx[JS_BACK_STR])),  # const-string v1, JS_BACK_STR
        ("bytes", struct.pack("<BBHH", 0x6E, 0x20, m_wv_loadurl, 0x0010)),  # v0.loadUrl(v1)
        ("bytes", struct.pack("<BB", 0x0E, 0x00)),  # return-void
        ("label", "call_super"),
        ("bytes", struct.pack("<BBHH", 0x6F, 0x10, m_super_back, 0x0002)),  # super.onBackPressed()
        ("bytes", struct.pack("<BB", 0x0E, 0x00)),  # return-void
    ])
    code_back = struct.pack("<HHHHII", 3, 1, 2, 0, 0, len(insns_back) // 2) + insns_back

    # --- 6. MainActivity.onBridgeCmd(String cmd)V ---
    # registers_size=5, ins_size=2 (v3=this, v4=cmd)
    m_str_equals = m_idx[("Ljava/lang/String;", "equals", ("Z", ("Ljava/lang/Object;",)))]
    m_uri_parse = m_idx[("Landroid/net/Uri;", "parse", ("Landroid/net/Uri;", ("Ljava/lang/String;",)))]
    t_intent = t_idx["Landroid/content/Intent;"]
    m_intent_init = m_idx[("Landroid/content/Intent;", "<init>", ("V", ("Ljava/lang/String;", "Landroid/net/Uri;")))]
    m_act_startforres = m_idx[("Landroid/app/Activity;", "startActivityForResult", ("V", ("Landroid/content/Intent;", "I")))]
    m_act_start = m_idx[("Landroid/app/Activity;", "startActivity", ("V", ("Landroid/content/Intent;",)))]

    insns_onbridge = assemble_dalvik([
        ("if_eqz", 4, "done_bridge"),
        # Check EXIT_APP command (triggered when user double-presses Back on Beranda)
        ("bytes", struct.pack("<BBH", 0x1A, 0x00, s_idx[EXIT_CMD_STR])),
        ("bytes", struct.pack("<BBHH", 0x6E, 0x20, m_str_equals, 0x0040)),
        ("bytes", struct.pack("<BB", 0x0A, 0x00)),
        ("if_eqz", 0, "check_pick"),
        ("bytes", struct.pack("<BBHH", 0x6F, 0x10, m_super_back, 0x0003)),  # super.onBackPressed()
        ("bytes", struct.pack("<BB", 0x0E, 0x00)),
        # Check PICK_CONTACT command
        ("label", "check_pick"),
        ("bytes", struct.pack("<BBH", 0x1A, 0x00, s_idx[PICK_CMD_STR])),
        ("bytes", struct.pack("<BBHH", 0x6E, 0x20, m_str_equals, 0x0040)),
        ("bytes", struct.pack("<BB", 0x0A, 0x00)),
        ("if_eqz", 0, "open_view"),
        # PICK_CONTACT branch
        ("bytes", struct.pack("<BBH", 0x1A, 0x00, s_idx[CONTACTS_URI_STR])),
        ("bytes", struct.pack("<BBHH", 0x71, 0x10, m_uri_parse, 0x0000)),
        ("bytes", struct.pack("<BB", 0x0C, 0x00)),
        ("bytes", struct.pack("<BBH", 0x22, 0x01, t_intent)),
        ("bytes", struct.pack("<BBH", 0x1A, 0x02, s_idx[ACTION_PICK_STR])),
        ("bytes", struct.pack("<BBHH", 0x70, 0x30, m_intent_init, 0x0021)),
        ("bytes", struct.pack("<BBh", 0x13, 0x00, 101)),
        ("bytes", struct.pack("<BBHH", 0x6E, 0x30, m_act_startforres, 0x0013)),
        ("bytes", struct.pack("<BB", 0x0E, 0x00)),
        # ACTION_VIEW branch
        ("label", "open_view"),
        ("bytes", struct.pack("<BBHH", 0x71, 0x10, m_uri_parse, 0x0004)),
        ("bytes", struct.pack("<BB", 0x0C, 0x00)),
        ("bytes", struct.pack("<BBH", 0x22, 0x01, t_intent)),
        ("bytes", struct.pack("<BBH", 0x1A, 0x02, s_idx[ACTION_VIEW_STR])),
        ("bytes", struct.pack("<BBHH", 0x70, 0x30, m_intent_init, 0x0021)),
        ("bytes", struct.pack("<BBHH", 0x6E, 0x20, m_act_start, 0x0013)),
        ("label", "done_bridge"),
        ("bytes", struct.pack("<BB", 0x0E, 0x00)),
    ])
    code_onbridge = struct.pack("<HHHHII", 5, 2, 3, 0, 0, len(insns_onbridge) // 2) + insns_onbridge

    # --- 7. MainActivity.onCreate(Bundle)V ---
    m_super_oncreate = m_idx[("Landroid/app/Activity;", "onCreate", ("V", ("Landroid/os/Bundle;",)))]
    t_webview = t_idx["Landroid/webkit/WebView;"]
    m_wv_init = m_idx[("Landroid/webkit/WebView;", "<init>", ("V", ("Landroid/content/Context;",)))]
    m_wv_getsettings = m_idx[("Landroid/webkit/WebView;", "getSettings", ("Landroid/webkit/WebSettings;", ()))]
    m_ws_js = m_idx[("Landroid/webkit/WebSettings;", "setJavaScriptEnabled", ("V", ("Z",)))]
    m_ws_dom = m_idx[("Landroid/webkit/WebSettings;", "setDomStorageEnabled", ("V", ("Z",)))]
    m_ws_db = m_idx[("Landroid/webkit/WebSettings;", "setDatabaseEnabled", ("V", ("Z",)))]
    s_ua = s_idx[UA_STR]
    m_ws_ua = m_idx[("Landroid/webkit/WebSettings;", "setUserAgentString", ("V", ("Ljava/lang/String;",)))]
    t_cc = t_idx["Lid/kasirkonter/gadaipro/ChromeClient;"]
    m_cc_init = m_idx[("Lid/kasirkonter/gadaipro/ChromeClient;", "<init>", ("V", ("Lid/kasirkonter/gadaipro/MainActivity;",)))]
    m_wv_setwcc = m_idx[("Landroid/webkit/WebView;", "setWebChromeClient", ("V", ("Landroid/webkit/WebChromeClient;",)))]
    m_act_setcv = m_idx[("Landroid/app/Activity;", "setContentView", ("V", ("Landroid/view/View;",)))]
    s_url = s_idx[URL_STR]

    insns_oncreate = b"".join([
        struct.pack("<BBHH", 0x6F, 0x20, m_super_oncreate, 0x0043),
        struct.pack("<BBH", 0x22, 0x00, t_webview),
        struct.pack("<BBHH", 0x70, 0x20, m_wv_init, 0x0030),
        struct.pack("<BBH", 0x5B, 0x30, f_wv),
        struct.pack("<BBHH", 0x6E, 0x10, m_wv_getsettings, 0x0000),
        struct.pack("<BB", 0x0C, 0x01),
        struct.pack("<BB", 0x12, 0x12),
        struct.pack("<BBHH", 0x6E, 0x20, m_ws_js, 0x0021),
        struct.pack("<BBHH", 0x6E, 0x20, m_ws_dom, 0x0021),
        struct.pack("<BBHH", 0x6E, 0x20, m_ws_db, 0x0021),
        struct.pack("<BBH", 0x1A, 0x02, s_ua),
        struct.pack("<BBHH", 0x6E, 0x20, m_ws_ua, 0x0021),
        struct.pack("<BBH", 0x22, 0x01, t_cc),
        struct.pack("<BBHH", 0x70, 0x20, m_cc_init, 0x0031),
        struct.pack("<BBHH", 0x6E, 0x20, m_wv_setwcc, 0x0010),
        struct.pack("<BBHH", 0x6E, 0x20, m_act_setcv, 0x0003),
        struct.pack("<BBH", 0x1A, 0x01, s_url),
        struct.pack("<BBHH", 0x6E, 0x20, m_wv_loadurl, 0x0010),
        struct.pack("<BB", 0x0E, 0x00),
    ])
    code_oncreate = struct.pack("<HHHHII", 5, 2, 2, 0, 0, len(insns_oncreate) // 2) + insns_oncreate

    # Calculate section offsets (2 classes in class_defs = 64 bytes)
    header_size = 0x70
    string_ids_off = header_size
    type_ids_off = string_ids_off + len(strings) * 4
    proto_ids_off = type_ids_off + len(types) * 4
    field_ids_off = proto_ids_off + len(raw_protos) * 12
    method_ids_off = field_ids_off + len(raw_fields) * 8
    class_defs_off = method_ids_off + len(raw_methods) * 8
    data_off = class_defs_off + (2 * 32)

    data_buf = bytearray()

    def align4():
        while (data_off + len(data_buf)) % 4 != 0:
            data_buf.append(0)

    # 1. type_list items
    align4()
    type_lists_off = data_off + len(data_buf)
    proto_param_offsets = {}
    type_list_count = 0
    for shorty, ret_t, params in raw_protos:
        key = tuple(params)
        if not key:
            proto_param_offsets[key] = 0
        elif key not in proto_param_offsets:
            align4()
            proto_param_offsets[key] = data_off + len(data_buf)
            data_buf.extend(struct.pack("<I", len(params)))
            for pt in params:
                data_buf.extend(struct.pack("<H", t_idx[pt]))
            type_list_count += 1

    # 2. code_item items (7 methods total)
    align4()
    code_items_off = data_off + len(data_buf)
    code_cc_init_off = data_off + len(data_buf)
    data_buf.extend(code_cc_init)
    align4()
    code_cc_prompt_off = data_off + len(data_buf)
    data_buf.extend(code_cc_prompt)
    align4()
    code_init_off = data_off + len(data_buf)
    data_buf.extend(code_init)
    align4()
    code_onactres_off = data_off + len(data_buf)
    data_buf.extend(code_onactres)
    align4()
    code_back_off = data_off + len(data_buf)
    data_buf.extend(code_back)
    align4()
    code_onbridge_off = data_off + len(data_buf)
    data_buf.extend(code_onbridge)
    align4()
    code_oncreate_off = data_off + len(data_buf)
    data_buf.extend(code_oncreate)

    # 3. string_data_item items
    string_data_off = data_off + len(data_buf)
    string_data_offsets = []
    for s in strings:
        string_data_offsets.append(data_off + len(data_buf))
        utf8_bytes = s.encode("utf-8")
        data_buf.extend(uleb128(len(s)))
        data_buf.extend(utf8_bytes)
        data_buf.append(0)

    # 4. class_data_item for ChromeClient & MainActivity
    class_data_off = data_off + len(data_buf)
    m_cc_prompt = m_idx[(
        "Lid/kasirkonter/gadaipro/ChromeClient;",
        "onJsPrompt",
        (
            "Z",
            (
                "Landroid/webkit/WebView;",
                "Ljava/lang/String;",
                "Ljava/lang/String;",
                "Ljava/lang/String;",
                "Landroid/webkit/JsPromptResult;",
            ),
        ),
    )]
    class_data_cc_off = data_off + len(data_buf)
    class_data_cc = b"".join([
        uleb128(0),  # static_fields_size
        uleb128(1),  # instance_fields_size
        uleb128(1),  # direct_methods_size
        uleb128(1),  # virtual_methods_size
        uleb128(f_cc_act),
        uleb128(0x0001),
        uleb128(m_cc_init),
        uleb128(0x10001),
        uleb128(code_cc_init_off),
        uleb128(m_cc_prompt),
        uleb128(0x0001),
        uleb128(code_cc_prompt_off),
    ])
    data_buf.extend(class_data_cc)

    class_data_main_off = data_off + len(data_buf)
    m_main_init = m_idx[("Lid/kasirkonter/gadaipro/MainActivity;", "<init>", ("V", ()))]
    m_main_onactres = m_idx[("Lid/kasirkonter/gadaipro/MainActivity;", "onActivityResult", ("V", ("I", "I", "Landroid/content/Intent;")))]
    m_main_back = m_idx[("Lid/kasirkonter/gadaipro/MainActivity;", "onBackPressed", ("V", ()))]
    m_main_oncreate = m_idx[("Lid/kasirkonter/gadaipro/MainActivity;", "onCreate", ("V", ("Landroid/os/Bundle;",)))]

    assert m_main_onactres < m_main_back < m_main_onbridge < m_main_oncreate

    class_data_main = b"".join([
        uleb128(0),  # static_fields_size
        uleb128(1),  # instance_fields_size
        uleb128(1),  # direct_methods_size
        uleb128(4),  # virtual_methods_size
        uleb128(f_wv),
        uleb128(0x0001),
        uleb128(m_main_init),
        uleb128(0x10001),
        uleb128(code_init_off),
        uleb128(m_main_onactres),
        uleb128(0x0001),
        uleb128(code_onactres_off),
        uleb128(m_main_back - m_main_onactres),
        uleb128(0x0001),
        uleb128(code_back_off),
        uleb128(m_main_onbridge - m_main_back),
        uleb128(0x0001),
        uleb128(code_onbridge_off),
        uleb128(m_main_oncreate - m_main_onbridge),
        uleb128(0x0001),
        uleb128(code_oncreate_off),
    ])
    data_buf.extend(class_data_main)

    # 5. map_list (aligned to 4 bytes)
    align4()
    map_list_off = data_off + len(data_buf)
    map_items = [
        (0x0000, 1, 0),
        (0x0001, len(strings), string_ids_off),
        (0x0002, len(types), type_ids_off),
        (0x0003, len(raw_protos), proto_ids_off),
        (0x0004, len(raw_fields), field_ids_off),
        (0x0005, len(raw_methods), method_ids_off),
        (0x0006, 2, class_defs_off),
        (0x1001, type_list_count, type_lists_off),
        (0x2001, 7, code_items_off),
        (0x2002, len(strings), string_data_off),
        (0x2000, 2, class_data_off),
        (0x1000, 1, map_list_off),
    ]
    data_buf.extend(struct.pack("<I", len(map_items)))
    for m_type, m_count, m_off in map_items:
        data_buf.extend(struct.pack("<HHII", m_type, 0, m_count, m_off))

    # Build index tables
    string_ids_bytes = b"".join(struct.pack("<I", off) for off in string_data_offsets)
    type_ids_bytes = b"".join(struct.pack("<I", s_idx[t]) for t in types)
    proto_ids_bytes = b"".join(
        struct.pack("<III", s_idx[shorty], t_idx[ret_t], proto_param_offsets[tuple(params)])
        for shorty, ret_t, params in raw_protos
    )
    field_ids_bytes = b"".join(
        struct.pack("<HHI", t_idx[c], t_idx[ft], s_idx[fn])
        for c, ft, fn in raw_fields
    )
    method_ids_bytes = b"".join(
        struct.pack("<HHI", t_idx[c], p_idx[pk], s_idx[mn])
        for c, pk, mn in raw_methods
    )
    class_defs_bytes = (
        struct.pack(
            "<IIIIIIII",
            t_idx["Lid/kasirkonter/gadaipro/ChromeClient;"],
            0x0001,
            t_idx["Landroid/webkit/WebChromeClient;"],
            0,
            s_idx["ChromeClient.java"],
            0,
            class_data_cc_off,
            0,
        )
        + struct.pack(
            "<IIIIIIII",
            t_idx["Lid/kasirkonter/gadaipro/MainActivity;"],
            0x0001,
            t_idx["Landroid/app/Activity;"],
            0,
            s_idx["MainActivity.java"],
            0,
            class_data_main_off,
            0,
        )
    )

    file_size = data_off + len(data_buf)
    data_size = len(data_buf)

    header_prefix = b"dex\n035\x00"
    header_rest = struct.pack(
        "<IIIIIIIIIIIIIIIIIIII",
        file_size,
        header_size,
        0x12345678,  # ENDIAN_CONSTANT
        0,           # link_size
        0,           # link_off
        map_list_off,
        len(strings),
        string_ids_off,
        len(types),
        type_ids_off,
        len(raw_protos),
        proto_ids_off,
        len(raw_fields),
        field_ids_off,
        len(raw_methods),
        method_ids_off,
        2,
        class_defs_off,
        data_size,
        data_off,
    )

    body_after_sig = (
        header_rest
        + string_ids_bytes
        + type_ids_bytes
        + proto_ids_bytes
        + field_ids_bytes
        + method_ids_bytes
        + class_defs_bytes
        + bytes(data_buf)
    )
    sha1_sig = hashlib.sha1(body_after_sig).digest()
    adler_val = zlib.adler32(sha1_sig + body_after_sig) & 0xFFFFFFFF

    dex_bytes = header_prefix + struct.pack("<I", adler_val) + sha1_sig + body_after_sig
    assert len(dex_bytes) == file_size
    return dex_bytes

# ---------------------------------------------------------------------------
# 5. Compile Full Production App Bundle (assets/index.html + assets/app.bundle.js)
# ---------------------------------------------------------------------------
def build_production_bundle(from_dist=False, fast_repack=False):
    import glob

    if not from_dist and not fast_repack:
        subprocess.run(["npx", "vite", "build"], check=True)
    css_files = sorted(glob.glob("dist/assets/index-*.css"))
    js_files = sorted(glob.glob("dist/assets/index-*.js"))
    if not css_files or not js_files:
        subprocess.run(["npx", "vite", "build"], check=True)
        css_files = sorted(glob.glob("dist/assets/index-*.css"))
        js_files = sorted(glob.glob("dist/assets/index-*.js"))
    if not css_files or not js_files:
        raise RuntimeError("Missing compiled CSS or JS in dist/assets/")

    css_text = open(css_files[0], "r", encoding="utf-8").read()
    iife_out = "/tmp/kasir_app_iife.js"
    if not (fast_repack and os.path.exists(iife_out)):
        subprocess.run(
            [
                "./node_modules/.bin/esbuild",
                js_files[0],
                "--bundle",
                "--format=iife",
                "--platform=browser",
                "--target=es2020",
                f"--outfile={iife_out}",
            ],
            check=True,
        )
    js_text = open(iife_out, "r", encoding="utf-8").read()
    safe_js = js_text.replace("</script", "<\\/script")

    html = f"""<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>{APP_NAME}</title>
  <script>
    window.__IS_ANDROID_APK__ = true;
    /*__APK_TRIAL_CONFIG_PLACEHOLDER__*/
    window.__onAndroidBackPressed = function() {{
      var overlays = document.querySelectorAll('div.fixed.inset-0.z-50');
      if (overlays && overlays.length > 0) {{
        overlays[overlays.length - 1].click();
        return;
      }}
    }};
    try {{
      localStorage.setItem('kasir_auth_mode_v1', 'local');
    }} catch (e) {{}}
    document.addEventListener('click', function(e) {{
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      var href = a.getAttribute('href') || '';
      if (href.indexOf('https://wa.me/') === 0 || href.indexOf('whatsapp:') === 0 || href.indexOf('tel:') === 0) {{
        e.preventDefault();
        window.prompt(href);
      }}
    }}, true);
  </script>
  <style>{css_text}</style>
</head>
<body class="bg-slate-50 text-slate-900 antialiased">
  <div id="root"></div>
  <script>{safe_js}</script>
</body>
</html>
"""
    return (
        html.encode("utf-8"),
        js_text.encode("utf-8"),
        css_text.encode("utf-8"),
    )

# ---------------------------------------------------------------------------
# 6. Build Aligned ZIP + V1 JAR Signature + V2 APK Signature Scheme v2
# ---------------------------------------------------------------------------
def build_signed_apk(output_paths, from_dist=False, fast_repack=False, only_trial=False):
    key_dir = "scripts/apk_keys"
    os.makedirs(key_dir, exist_ok=True)
    os.makedirs("/tmp/apk_keys", exist_ok=True)
    key_pem = os.path.join(key_dir, "key.pem")
    cert_pem = os.path.join(key_dir, "cert.pem")
    cert_der_path = os.path.join(key_dir, "cert.der")
    spki_der_path = os.path.join(key_dir, "spki.der")

    # Reuse existing key from /tmp/apk_keys if present so upgrades preserve signature
    if not os.path.exists(key_pem) and os.path.exists("/tmp/apk_keys/key.pem"):
        import shutil
        for fname in ("key.pem", "cert.pem", "cert.der", "spki.der"):
            src_f = os.path.join("/tmp/apk_keys", fname)
            if os.path.exists(src_f):
                shutil.copy2(src_f, os.path.join(key_dir, fname))

    if not os.path.exists(key_pem):
        subprocess.run(
            [
                "openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
                "-keyout", key_pem, "-out", cert_pem,
                "-days", "10000", "-sha256",
                "-subj", "/CN=Kasir Konter Gadai Pro/O=Kasir Konter/C=ID",
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        subprocess.run(
            ["openssl", "x509", "-in", cert_pem, "-outform", "DER", "-out", cert_der_path],
            check=True,
        )
        subprocess.run(
            ["openssl", "rsa", "-in", key_pem, "-pubout", "-outform", "DER", "-out", spki_der_path],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    cert_der = open(cert_der_path, "rb").read()
    spki_der = open(spki_der_path, "rb").read()

    manifest_xml = make_axml_manifest()
    resources_arsc = make_resources_arsc()
    if os.path.exists("public/pwa-512x512.png"):
        icon_png = open("public/pwa-512x512.png", "rb").read()
    else:
        icon_png = make_png_icon()
    classes_dex = make_classes_dex()
    asset_html, asset_js, asset_css = build_production_bundle(from_dist=from_dist, fast_repack=fast_repack)

    def sign_and_write_apk(html_bytes, targets):
        app_files = [
            ("AndroidManifest.xml", manifest_xml, True),
            ("resources.arsc", resources_arsc, False),       # Uncompressed & 4-byte aligned
            ("res/drawable/icon.png", icon_png, False),      # Uncompressed & 4-byte aligned
            ("classes.dex", classes_dex, True),
            ("assets/index.html", html_bytes, True),
            ("assets/app.bundle.js", asset_js, True),
            ("assets/app.bundle.css", asset_css, True),
        ]
        if os.path.exists("public/pwa-192x192.png"):
            app_files.append(("assets/pwa-192x192.png", open("public/pwa-192x192.png", "rb").read(), False))
        if os.path.exists("public/pwa-512x512.png"):
            app_files.append(("assets/pwa-512x512.png", open("public/pwa-512x512.png", "rb").read(), False))

        # Build V1 META-INF/MANIFEST.MF
        mf_lines = [
            "Manifest-Version: 1.0",
            "Created-By: 1.0 (Android)",
            "",
        ]
        sf_sections = []
        for name, raw_data, _ in app_files:
            b64_sha256 = base64.b64encode(hashlib.sha256(raw_data).digest()).decode("ascii")
            section = f"Name: {name}\r\nSHA-256-Digest: {b64_sha256}\r\n\r\n"
            mf_lines.append(f"Name: {name}")
            mf_lines.append(f"SHA-256-Digest: {b64_sha256}")
            mf_lines.append("")
            sf_digest = base64.b64encode(hashlib.sha256(section.encode("utf-8")).digest()).decode("ascii")
            sf_sections.append((name, sf_digest))

        manifest_mf_bytes = "\r\n".join(mf_lines).encode("utf-8")
        mf_sha256 = base64.b64encode(hashlib.sha256(manifest_mf_bytes).digest()).decode("ascii")

        sf_lines = [
            "Signature-Version: 1.0",
            f"SHA-256-Digest-Manifest: {mf_sha256}",
            "Created-By: 1.0 (Android)",
            "",
        ]
        for name, sf_digest in sf_sections:
            sf_lines.append(f"Name: {name}")
            sf_lines.append(f"SHA-256-Digest: {sf_digest}")
            sf_lines.append("")

        cert_sf_bytes = "\r\n".join(sf_lines).encode("utf-8")
        sf_path = "/tmp/apk_keys/CERT.SF"
        rsa_path = "/tmp/apk_keys/CERT.RSA"
        with open(sf_path, "wb") as f:
            f.write(cert_sf_bytes)

        subprocess.run(
            [
                "openssl", "cms", "-sign", "-binary", "-noattr", "-md", "sha256",
                "-in", sf_path, "-signer", cert_pem, "-inkey", key_pem,
                "-outform", "DER", "-out", rsa_path,
            ],
            check=True,
        )
        cert_rsa_bytes = open(rsa_path, "rb").read()

        all_entries = app_files + [
            ("META-INF/MANIFEST.MF", manifest_mf_bytes, True),
            ("META-INF/CERT.SF", cert_sf_bytes, True),
            ("META-INF/CERT.RSA", cert_rsa_bytes, True),
        ]

        # Pack ZIP with 4-byte alignment for uncompressed entries
        entries_buf = bytearray()
        cd_buf = bytearray()

        for name, raw_data, compress in all_entries:
            name_bytes = name.encode("utf-8")
            crc = zlib.crc32(raw_data) & 0xFFFFFFFF
            uncomp_size = len(raw_data)

            if compress:
                comp_obj = zlib.compressobj(9, zlib.DEFLATED, -zlib.MAX_WBITS)
                comp_data = comp_obj.compress(raw_data) + comp_obj.flush()
                method = 8
            else:
                comp_data = raw_data
                method = 0

            comp_size = len(comp_data)
            local_header_offset = len(entries_buf)

            # Calculate 4-byte alignment padding for uncompressed entries
            extra_bytes = b""
            if not compress:
                data_start = local_header_offset + 30 + len(name_bytes)
                pad = (4 - (data_start % 4)) % 4
                extra_bytes = b"\x00" * pad

            lfh = struct.pack(
                "<IHHHHHIIIHH",
                0x04034B50,
                20,
                0,
                method,
                0,
                0x5421,  # DOS date
                crc,
                comp_size,
                uncomp_size,
                len(name_bytes),
                len(extra_bytes),
            )
            entries_buf.extend(lfh)
            entries_buf.extend(name_bytes)
            entries_buf.extend(extra_bytes)
            if not compress:
                assert len(entries_buf) % 4 == 0, f"Unaligned entry {name}"
            entries_buf.extend(comp_data)

            cdh = struct.pack(
                "<IHHHHHHIIIHHHHHII",
                0x02014B50,
                20,
                20,
                0,
                method,
                0,
                0x5421,
                crc,
                comp_size,
                uncomp_size,
                len(name_bytes),
                0,
                0,
                0,
                0,
                0,
                local_header_offset,
            )
            cd_buf.extend(cdh)
            cd_buf.extend(name_bytes)

        cd_offset = len(entries_buf)
        cd_size = len(cd_buf)
        num_entries = len(all_entries)

        eocd_for_v2 = struct.pack(
            "<IHHHHIIH",
            0x06054B50,
            0,
            0,
            num_entries,
            num_entries,
            cd_size,
            cd_offset,
            0,
        )

        # Compute APK Signature Scheme v2 digest over [entries_buf, cd_buf, eocd_for_v2]
        CHUNK_SIZE = 1048576
        chunk_digests = []
        for section in (bytes(entries_buf), bytes(cd_buf), eocd_for_v2):
            pos = 0
            while pos < len(section):
                chunk = section[pos : pos + CHUNK_SIZE]
                pos += CHUNK_SIZE
                h = hashlib.sha256()
                h.update(b"\xa5")
                h.update(struct.pack("<I", len(chunk)))
                h.update(chunk)
                chunk_digests.append(h.digest())

        top_h = hashlib.sha256()
        top_h.update(b"\x5a")
        top_h.update(struct.pack("<I", len(chunk_digests)))
        for d in chunk_digests:
            top_h.update(d)
        top_level_digest = top_h.digest()

        def lp(b):
            return struct.pack("<I", len(b)) + b

        SIG_ALGO = 0x0103  # RSA_PKCS1_V1_5_WITH_SHA256
        digests_block = lp(lp(struct.pack("<I", SIG_ALGO) + lp(top_level_digest)))
        certs_block = lp(lp(cert_der))
        attr_block = lp(b"")
        signed_data = digests_block + certs_block + attr_block

        sd_path = "/tmp/apk_keys/signed_data.bin"
        sig_path = "/tmp/apk_keys/v2_sig.bin"
        with open(sd_path, "wb") as f:
            f.write(signed_data)

        subprocess.run(
            ["openssl", "dgst", "-sha256", "-sign", key_pem, "-out", sig_path, sd_path],
            check=True,
        )
        v2_sig_bytes = open(sig_path, "rb").read()

        signatures_block = lp(lp(struct.pack("<I", SIG_ALGO) + lp(v2_sig_bytes)))
        public_key_block = lp(spki_der)
        signer_block = lp(lp(signed_data) + signatures_block + public_key_block)
        signers_sequence = lp(signer_block)

        v2_pair = struct.pack("<QI", 4 + len(signers_sequence), 0x7109871A) + signers_sequence

        # Optional padding pair (0x42726577) so total APK Signing Block is a multiple of 4096 bytes
        raw_block_len = 8 + len(v2_pair) + 8 + 16
        rem = raw_block_len % 4096
        if rem != 0:
            pad_needed = 4096 - rem
            if pad_needed < 12:
                pad_needed += 4096
            pad_val_len = pad_needed - 12
            pad_pair = struct.pack("<QI", 4 + pad_val_len, 0x42726577) + (b"\x00" * pad_val_len)
            pairs_bytes = v2_pair + pad_pair
        else:
            pairs_bytes = v2_pair

        block_size_field = len(pairs_bytes) + 8 + 16
        apk_sig_block = (
            struct.pack("<Q", block_size_field)
            + pairs_bytes
            + struct.pack("<Q", block_size_field)
            + b"APK Sig Block 42"
        )
        assert len(apk_sig_block) % 4096 == 0

        new_cd_offset = cd_offset + len(apk_sig_block)
        final_eocd = struct.pack(
            "<IHHHHIIH",
            0x06054B50,
            0,
            0,
            num_entries,
            num_entries,
            cd_size,
            new_cd_offset,
            0,
        )

        final_apk = bytes(entries_buf) + apk_sig_block + bytes(cd_buf) + final_eocd

        for out_path in targets:
            os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
            with open(out_path, "wb") as f:
                f.write(final_apk)
            print(f"Created signed APK: {out_path} ({len(final_apk)} bytes)")

    # 1. Sign & write Full / Admin APK
    if not only_trial:
        full_html = asset_html.replace(b"/*__APK_TRIAL_CONFIG_PLACEHOLDER__*/", b"")
        sign_and_write_apk(full_html, output_paths)

    # 2. Sign & write Customer Trial APK (auto-starts trial with Admin's configured duration on first launch)
    trial_duration_ms = 3 * 24 * 60 * 60 * 1000
    admin_wa = "081529285782"
    license_price = "Rp 150.000 (Aktif Selamanya)"
    if os.path.exists("trial-config.json"):
        try:
            cfg = json.loads(open("trial-config.json", "r", encoding="utf-8").read())
            if isinstance(cfg.get("trialDurationMs"), (int, float)) and cfg["trialDurationMs"] >= 10000:
                trial_duration_ms = int(cfg["trialDurationMs"])
            if cfg.get("adminWaNumber"):
                admin_wa = str(cfg["adminWaNumber"])
            if cfg.get("licensePriceText"):
                license_price = str(cfg["licensePriceText"])
        except Exception as e:
            print("Warning reading trial-config.json:", e)

    trial_flag_script = (
        f"window.__APK_DEFAULT_TRIAL_MODE__ = true;\n"
        f"    window.__APK_DEFAULT_TRIAL_DURATION_MS__ = {trial_duration_ms};\n"
        f"    window.__APK_DEFAULT_ADMIN_WA__ = {json.dumps(admin_wa)};\n"
        f"    window.__APK_DEFAULT_LICENSE_PRICE__ = {json.dumps(license_price)};"
    ).encode("utf-8")
    trial_html = asset_html.replace(b"/*__APK_TRIAL_CONFIG_PLACEHOLDER__*/", trial_flag_script)
    assert b"window.__APK_DEFAULT_TRIAL_MODE__ = true;" in trial_html, "Failed to inject __APK_DEFAULT_TRIAL_MODE__"

    trial_targets = [
        "Kasir-Konter-Trial-3Hari.apk",
        "Kasir-Konter-Trial-3Hari-v3.0.apk",
        "public/Kasir-Konter-Trial-3Hari.apk",
        "public/Kasir-Konter-Trial-3Hari-v3.0.apk",
    ]
    if os.path.isdir("dist"):
        trial_targets.extend([
            "dist/Kasir-Konter-Trial-3Hari.apk",
            "dist/Kasir-Konter-Trial-3Hari-v3.0.apk",
        ])
    sign_and_write_apk(trial_html, trial_targets)

if __name__ == "__main__":
    use_from_dist = "--from-dist" in sys.argv
    use_fast_repack = "--fast-repack" in sys.argv
    use_only_trial = "--only-trial" in sys.argv
    targets = [
        "Kasir-Konter-Gadai-Pro.apk",
        "Kasir-Konter-Gadai-Pro-v3.0.apk",
        "Kasir-Konter-Gadai-Pro-v2.9.apk",
        "Kasir-Konter-Gadai-Pro-v2.7.apk",
        "public/Kasir-Konter-Gadai-Pro.apk",
        "public/Kasir-Konter-Gadai-Pro-v3.0.apk",
        "public/Kasir-Konter-Gadai-Pro-v2.9.apk",
    ]
    if os.path.isdir("dist"):
        targets.extend([
            "dist/Kasir-Konter-Gadai-Pro.apk",
            "dist/Kasir-Konter-Gadai-Pro-v3.0.apk",
            "dist/Kasir-Konter-Gadai-Pro-v2.9.apk",
            "dist/Kasir-Konter-Gadai-Pro-v2.7.apk",
        ])
    build_signed_apk(targets, from_dist=use_from_dist, fast_repack=use_fast_repack, only_trial=use_only_trial)
