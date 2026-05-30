#!/usr/bin/env python3
"""Convert the legal .docx files in public/terms to clean markdown in
src/content/legal/. Heading level is inferred from Word paragraph style
(Heading1/2/3, Title) with a numeric-prefix fallback ("1." -> h2, "4.1" -> h3).
List items (bullets/numbering) become markdown "- " lines.

Run: python3 scripts/docx-to-md.py
"""
import zipfile, re, os, html

SRC = "public/terms"
OUT = "src/content/legal"

# (docx filename, output basename, lang)
MAP = [
    ("Cairnly_Terms_of_Service_EN.docx",            "terms-of-service.en.md", "en"),
    ("Cairnly_Algemene_Voorwaarden_NL.docx",        "terms-of-service.nl.md", "nl"),
    ("Cairnly_Privacyverklaring_NL.docx",           "privacy-policy.nl.md",   "nl"),
    ("Cairnly_Referral_Programme_Terms_EN.docx",    "referral-terms.en.md",   "en"),
    ("Cairnly_Voorwaarden_Referral_Programma_NL.docx","referral-terms.nl.md", "nl"),
]

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
import xml.etree.ElementTree as ET

def w(tag): return f"{{{NS['w']}}}{tag}"

def para_text(p):
    parts = []
    for t in p.iter(w("t")):
        parts.append(t.text or "")
    return "".join(parts)

def para_style(p):
    pPr = p.find(w("pPr"))
    if pPr is None: return None, False
    style = None
    pStyle = pPr.find(w("pStyle"))
    if pStyle is not None:
        style = pStyle.get(w("val"))
    is_list = pPr.find(w("numPr")) is not None
    return style, is_list

def heading_level(style, text):
    if style:
        s = style.lower()
        if s in ("title",): return 1
        m = re.match(r"heading(\d)", s)
        if m: return min(int(m.group(1)) + 0, 3) if False else int(m.group(1))
    # numeric-prefix fallback
    if re.match(r"^\d+\.\d+\s", text): return 3
    if re.match(r"^\d+\.\s", text): return 2
    return 0

def normalize_headings(lines):
    """First heading -> h1; subsequent headings -> h2, except numeric "N.M"
    prefixes -> h3. Robust against docx files that style every section as
    Word Heading 1."""
    seen_h1 = False
    out = []
    for l in lines:
        m = re.match(r"^#+\s+(.*)$", l)
        if m:
            text = m.group(1)
            if not seen_h1:
                out.append(f"# {text}"); seen_h1 = True
            elif re.match(r"^\d+\.\d+", text):
                out.append(f"### {text}")
            else:
                out.append(f"## {text}")
        else:
            out.append(l)
    return out


def convert(path):
    z = zipfile.ZipFile(path)
    root = ET.fromstring(z.read("word/document.xml"))
    body = root.find(w("body"))
    out = []
    first_para = True
    for p in body.findall(w("p")):
        text = para_text(p).strip()
        if not text:
            continue
        style, is_list = para_style(p)
        # First non-empty paragraph = document title (h1)
        if first_para:
            out.append(f"# {text}")
            first_para = False
            continue
        if is_list:
            out.append(f"- {text}")
            continue
        lvl = heading_level(style, text)
        if lvl == 1:
            out.append(f"# {text}")
        elif lvl == 2:
            out.append(f"## {text}")
        elif lvl == 3:
            out.append(f"### {text}")
        else:
            out.append(text)
    out = normalize_headings(out)
    # join with blank lines, but keep consecutive list items tight
    md = []
    for i, line in enumerate(out):
        md.append(line)
        nxt = out[i+1] if i+1 < len(out) else ""
        if line.startswith("- ") and nxt.startswith("- "):
            continue  # no blank line between list items
        md.append("")
    return "\n".join(md).strip() + "\n"

os.makedirs(OUT, exist_ok=True)
for fn, out_name, lang in MAP:
    src = os.path.join(SRC, fn)
    if not os.path.exists(src):
        print(f"SKIP (missing): {fn}")
        continue
    md = convert(src)
    with open(os.path.join(OUT, out_name), "w") as f:
        f.write(md)
    print(f"OK {out_name}: {len(md)} chars, {md.count(chr(10)+'#')} headings, {md.count(chr(10)+'- ')} list items")
