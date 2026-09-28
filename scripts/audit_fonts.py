#!/usr/bin/env python3
"""Audit cakupan: karakter di sample-fancy.txt yang tidak diklaim oleh
@font-face mana pun di api/_template.html (font fallback OS tak dihitung).
Pakai: python3 scripts/audit_fonts.py  [sample-fancy.txt]"""
import re, sys, os
import unicodedata

TPL = os.path.join(os.path.dirname(__file__), '..', 'api', '_template.html')
SAMPLE = os.path.join(os.path.dirname(__file__), 'sample-fancy.txt')

css = open(TPL, encoding='utf-8').read()
ranges = []  # (family, a, b)
for m in re.finditer(r"@font-face\s*\{(.*?)\}", css, re.S):
    body = m.group(1)
    fam = re.search(r"font-family:\s*'([^']+)'", body)
    ur = re.search(r"unicode-range:\s*([^;]+);", body)
    if not fam or not ur:
        # face tanpa unicode-range = klaim semua (Inter latin lama)
        ranges.append((fam.group(1) if fam else '?', 0, 0x10FFFF))
        continue
    for part in ur.group(1).split(','):
        part = part.strip().replace('U+', '')
        if not part: continue
        if '-' in part:
            a, b = part.split('-'); ranges.append((fam.group(1), int(a, 16), int(b, 16)))
        else:
            c = int(part, 16); ranges.append((fam.group(1), c, c))

def siapa(cp):
    return sorted({f for f, a, b in ranges if a <= cp <= b})

text = open(SAMPLE, encoding='utf-8').read()
missing = {}
for ch in text:
    cp = ord(ch)
    if cp in (0x0A, 0x0D, 0x09, 0x20, 0x200B): continue
    if not siapa(cp):
        missing.setdefault(cp, 0)
        missing[cp] += 1

if not missing:
    print('SEMUA karakter tercakup ✓')
else:
    print(f'{len(missing)} codepoint TIDAK tercakup:')
    def blok(cp):
        try: return unicodedata.name(chr(cp))[:48]
        except ValueError: return '?'
    for cp in sorted(missing):
        print(f"  U+{cp:05X} {chr(cp)} x{missing[cp]:<3} {blok(cp)}")
