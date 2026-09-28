#!/usr/bin/env python3
"""Bangun paket font Unicode (fancy fonts + multibahasa) untuk _template.html.
Unduh font OFL, subset, konversi woff2, keluarkan blok CSS @font-face.
Output: /tmp/fontfaces.css + laporan cakupan."""
import base64, io, os, urllib.request, concurrent.futures as cf

SRC = '/tmp/fontsrc'
NF = 'https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io/fonts'
FS = 'https://cdn.jsdelivr.net/npm'
os.makedirs(SRC, exist_ok=True)

def fetch(url, name):
    p = os.path.join(SRC, name)
    if not os.path.exists(p):
        print('unduh', name, flush=True)
        urllib.request.urlretrieve(url, p)
    return p

def subset_ttf(path, unicodes):
    from fontTools import subset
    from fontTools.ttLib import TTFont
    buf = io.BytesIO()
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.name_IDs = [1, 2]
    opts.notdef_outline = True
    f = subset.load_font(path, opts)
    s = subset.Subsetter(opts)
    s.populate(unicodes=unicodes)
    s.subset(f)
    f.save(buf)
    return buf.getvalue()

def b64(data):
    return base64.b64encode(data).decode()

def cmap_of(path):
    from fontTools.ttLib import TTFont
    return set(TTFont(path, fontNumber=0, lazy=True).getBestCmap().keys())

# ---------- daftar font mikro (full embed) ----------
MICRO = [
    # (nama-file notofonts, family css, unicode-range css, subset slug)
    ('NotoSansCherokee',          '13A0-13FD,AB70-ABBF'),
    ('NotoSansCanadianAboriginal','1400-167F,18B0-18F5'),
    ('NotoSansYi',                'A000-A4C6'),
    ('NotoSerifTibetan',          '0F00-0FFF'),
    ('NotoSansSyriacEastern',     '0700-074F'),
    ('NotoSansTagalog',           '1700-171F,1735-1736'),
    ('NotoSansTagbanwa',          '1760-177F'),
    ('NotoSansLimbu',             '1900-194F'),
    ('NotoSansBuginese',          '1A00-1A1F'),
    ('NotoSansTaiTham',           '1A20-1AAF'),
    ('NotoSansSundanese',         '1B80-1BBF,1CC0-1CCF'),
    ('NotoSansCham',              'AA00-AA5F'),
    ('NotoSansMeeteiMayek',       'ABC0-ABFF,AAE0-AAF6'),
    ('NotoSansWarangCiti',        '118A0-118FF'),
    ('NotoSansTaiLe',             '1950-197F'),
    ('NotoSansTaiViet',           'AA80-AADF'),
    ('NotoSansNewTaiLue',         '1980-19DF'),
    ('NotoSansMongolian',         '1800-18AF'),
    ('NotoSansSylotiNagri',       'A800-A82F'),
    ('NotoSansJavanese',          'A980-A9DF'),
    ('NotoSansBalinese',          '1B00-1B7F'),
    ('NotoSansRunic',             '16A0-16FF'),
    ('NotoSansGlagolitic',        '2C00-2C5F'),
    ('NotoSansLisu',              'A4D0-A4FF'),
    ('NotoSansVai',               'A500-A63F'),
    ('NotoSansArabic',            '0600-06FF,0750-077F,0870-088E,08A0-08FF'),
    ('NotoSansHebrew',            '0590-05FF'),
    ('NotoSansThai',              '0E00-0E7F'),
    ('NotoSansLao',               '0E80-0EFF'),
]

SUBSETS = {
    'NotoSansMath':    '20D0-20E0,2100-214F,2200-22FF,2A00-2AFF,1D400-1D7FF',
    'NotoSansSymbols': '20E0-20E3,2460-24FF,2B00-2BFF,1F100-1F1E5',
    'NotoSansSymbols2':'2600-26FF,2700-27BF',
    'NotoSans':        '0300-036F,2E00-2E7F,AB30-AB6F',
}
DEJAVU_UNI = '0300-036F,0488-0489,1D00-1D7F,2070-209F,2190-21FF,2300-23FF,2500-25FF,2B00-2BFF,FB1D-FB4F,FB50-FDFF,FE70-FEFF'
DEJAVU_UNI2 = '0370-0377,037B-037F,1F00-1FFF,2100-214F,2C60-2C7F,2600-26FF,2700-27BF,A720-A7FF'
NOTO_EMOJI_UNI = '1F1E6-1F1FF'

# fontsource inter subsets (sudah woff2, langsung embed)
INTER = [
    ('latin-ext', 400), ('latin-ext', 600), ('vietnamese', 400), ('vietnamese', 600),
    ('greek', 400), ('cyrillic', 400), ('cyrillic-ext', 400),
]
INTER_RANGE = {
    'latin-ext': 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
    'vietnamese': 'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB',
    'greek': 'U+0370-0377,U+037A-037F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03FF',
    'cyrillic': 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116',
    'cyrillic-ext': 'U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F',
}
# font bahasa via CDN (lazy, unicode-range)
CDN = [
    ('noto-sans-devanagari', 'devanagari',  'U+0900-097F,U+A830-A83F,U+A8E0-A8FF'),
    ('noto-sans-bengali',    'bengali',     'U+0980-09FF'),
    ('noto-sans-gurmukhi',   'gurmukhi',    'U+0A00-0A7F'),
    ('noto-sans-gujarati',   'gujarati',    'U+0A80-0AFF'),
    ('noto-sans-tamil',      'tamil',       'U+0B80-0BFF'),
    ('noto-sans-telugu',     'telugu',      'U+0C00-0C7F'),
    ('noto-sans-kannada',    'kannada',     'U+0C80-0CFF'),
    ('noto-sans-malayalam',  'malayalam',   'U+0D00-0D7F'),
    ('noto-sans-sinhala',    'sinhala',     'U+0D80-0DFF'),
    ('noto-sans-khmer',      'khmer',       'U+1780-17FF,U+19E0-19FF'),
    ('noto-sans-myanmar',    'myanmar',     'U+1000-109F,U+AA60-AA7F'),
    ('noto-sans-georgian',   'georgian',    'U+10A0-10FF,U+2D00-2D7F'),
    ('noto-sans-armenian',   'armenian',    'U+0530-058F,U+FB13-FB17'),
    ('noto-sans-ethiopic',   'ethiopic',    'U+1200-139F,U+AB00-AB2F'),
]
CJK = [
    ('noto-sans-tc', 'chinese-traditional', 'XTC', 'U+3100-312F'),
    ('noto-sans-jp', 'japanese',            'XJP', 'U+3000-30FF,U+31F0-31FF,U+3400-4DBF,U+4E00-9FFF,U+FF00-FFEF'),
    ('noto-sans-kr', 'korean',              'XKR', 'U+3130-318F,U+AC00-D7A3,U+D7B0-D7FF'),
]

def parse_uni(s):
    out = []
    for part in s.split(','):
        part = part.strip().replace('U+', '')
        if '-' in part:
            a, b = part.split('-'); out.append((int(a, 16), int(b, 16)))
        else:
            c = int(part, 16); out.append((c, c))
    return out

def parse_uni_list(s):
    return [cp for a, b in parse_uni(s) for cp in range(a, b + 1)]


def compact(cps):
    cps = sorted(cps); out = []; i = 0
    while i < len(cps):
        j = i
        while j + 1 < len(cps) and cps[j + 1] == cps[j] + 1: j += 1
        out.append(f'U+{cps[i]:04X}' if i == j else f'U+{cps[i]:04X}-{cps[j]:04X}')
        i = j + 1
    return ','.join(out)

CLAIMED = set()

def face_css(fam, data, note=''):
    """@font-face dgn unicode-range presisi dari cmap aktual font."""
    global CLAIMED
    from fontTools.ttLib import TTFont
    cm = set(TTFont(io.BytesIO(data), lazy=True).getBestCmap().keys())
    cps = cm - CLAIMED
    CLAIMED |= cps
    css.append(f"""  @font-face {{
    font-family: '{fam}';
    font-style: normal;
    font-weight: 400;
    font-display: block;
    src: url(data:font/woff2;base64,{b64(data)}) format('woff2');
    unicode-range: {compact(cps)};
  }}""")
    rep.append((fam + (' [' + note + ']' if note else ''), len(data), f'{len(cps)} cp'))

css = []
rep = []

# ---------- 1-2) subset Noto + DejaVu (urutan menentukan prioritas klaim) ----------
ORDER = list(SUBSETS.items()) + [('DejaVuSans', DEJAVU_UNI), ('DejaVuSans', DEJAVU_UNI2)]
for fam, uni in ORDER:
    if fam == 'DejaVuSans':
        p = fetch(f'{FS}/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf', 'DejaVuSans.ttf')
    else:
        p = fetch(f'{NF}/{fam}/hinted/ttf/{fam}-Regular.ttf', fam + '.ttf')
    data = subset_ttf(p, parse_uni_list(uni))
    face_css('NotoFancy', data, 'subset')

# ---------- 3) font mikro full ----------
def micro(fam, uni):
    p = fetch(f'{NF}/{fam}/hinted/ttf/{fam}-Regular.ttf', fam + '.ttf')
    from fontTools.ttLib import TTFont
    f = TTFont(p, flavor='woff2', lazy=True)
    buf = io.BytesIO(); f.save(buf)
    face_css('NotoFancy', buf.getvalue(), fam[8:])

with cf.ThreadPoolExecutor(6) as ex:
    list(ex.map(lambda a: micro(*a), MICRO))

# ---------- 3b) Noto Emoji (regional indicator) ----------
p = fetch('https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notoemoji/NotoEmoji%5Bwght%5D.ttf',
          'NotoEmoji-var.ttf')
data = subset_ttf(p, parse_uni_list(NOTO_EMOJI_UNI))
face_css('NotoFancy', data, 'RI-emoji')

# ---------- 3c) Hangul jamo (subset dari Noto Sans KR variable) ----------
p = fetch('https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf',
          'NotoSansKR-var.ttf')
data = subset_ttf(p, parse_uni_list('1100-11FF,A960-A97F,D7B0-D7FF'))
face_css('NotoFancy', data, 'HangulJamo')

# ---------- 4) Inter subsets ----------
for slug, w in INTER:
    u = fs_url = f'{FS}/@fontsource/inter@5.2.5/files/inter-{slug}-{w}-normal.woff2'
    p = fetch(u, f'inter-{slug}-{w}.woff2')
    css.append(f"""  @font-face {{
    font-family: 'Inter';
    font-style: normal;
    font-weight: {w};
    font-display: block;
    src: url(data:font/woff2;base64,{b64(open(p, 'rb').read())}) format('woff2');
    unicode-range: {INTER_RANGE[slug]};
  }}""")
    rep.append((f'inter-{slug}-{w}', os.path.getsize(p)))

# ---------- 5) font bahasa besar via CDN ----------
for pkg, slug, rng in CDN:
    css.append(f"""  @font-face {{
    font-family: 'XLang';
    font-style: normal;
    font-weight: 400;
    font-display: block;
    src: url({FS}/@fontsource/{pkg}@5/files/{pkg}-{slug}-400-normal.woff2) format('woff2');
    unicode-range: {rng};
  }}""")
    rep.append((f'CDN {pkg}', 0))

for pkg, slug, fam, rng in CJK:
    css.append(f"""  @font-face {{
    font-family: '{fam}';
    font-style: normal;
    font-weight: 400;
    font-display: block;
    src: url({FS}/@fontsource/{pkg}@5/files/{pkg}-{slug}-400-normal.woff2) format('woff2');
    unicode-range: {rng};
  }}""")
    rep.append((f'CDN {pkg}', 0))

out = '\n'.join(css)
open('/tmp/fontfaces.css', 'w', encoding='utf-8').write(out)
total = sum(r[1] for r in rep if len(r) > 1)
print('\n=== LAPORAN ===')
for r in rep:
    print(' '.join(str(x) for x in r))
print(f'CSS @font-face: {len(css)} face, {len(out)} bytes (base64 total ~{total * 4 // 3})')
