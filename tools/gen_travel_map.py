# japan.geojson → kirakira/games/travel/map-data.js 生成スクリプト
# メルカトル投影で本土を 510x470 にフィットさせ、簡略化したSVGパスを静的データとして出力する。
import json, math

SRC = "japan.geojson"  # https://raw.githubusercontent.com/dataofjapan/land/master/japan.geojson をDLして置く
OUT = "kirakira/games/travel/map-data.js"  # リポジトリルートから実行する

FIT = (8, 8, 502, 460)          # 本土フィット範囲
INSET_W, INSET_H, INSET_PAD = 118, 68, 6   # 沖縄インセット
SIMPLIFY_TOL = 0.6              # Douglas-Peucker 許容誤差(px)
MIN_AREA = 2.0                  # 小島除外の面積しきい値(px^2)

REGIONS = [
    ('北海道地方', [1]),
    ('東北地方', [2, 3, 4, 5, 6, 7]),
    ('関東地方', [8, 9, 10, 11, 12, 13, 14]),
    ('中部地方', [15, 16, 17, 18, 19, 20, 21, 22, 23]),
    ('近畿地方', [24, 25, 26, 27, 28, 29, 30]),
    ('中国地方', [31, 32, 33, 34, 35]),
    ('四国地方', [36, 37, 38, 39]),
    ('九州地方', [40, 41, 42, 43, 44, 45, 46]),
    ('沖縄地方', [47]),
]
REGION_OF = {pid: ri for ri, (_, ids) in enumerate(REGIONS) for pid in ids}


def merc(lon, lat):
    x = math.radians(lon)
    y = math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
    return x, -y  # SVGはy下向き


def rings_of(geom):
    if geom['type'] == 'Polygon':
        return [geom['coordinates'][0]]
    return [poly[0] for poly in geom['coordinates']]  # MultiPolygon外環のみ


def is_remote(ring):
    """本土ビューから除外する遠隔諸島(小笠原・伊豆南部・鹿児島南方など)"""
    lon = sum(p[0] for p in ring) / len(ring)
    lat = sum(p[1] for p in ring) / len(ring)
    if lat < 30.5:
        return True                       # 鹿児島南方・沖縄
    if lon > 138.8 and lat < 34.0:
        return True                       # 伊豆諸島南部・小笠原
    return False


def ring_area(ring):
    s = 0.0
    for i in range(len(ring) - 1):
        s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
    return abs(s) / 2


def dp_simplify(pts, tol):
    """Douglas-Peucker（反復実装）"""
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    # 閉リング(始点=終点)では基準線分が長さ0になり全点距離0で潰れるため、
    # 始点から最遠の点をアンカーにして2区間に分割する
    if pts[0] == pts[-1]:
        m = max(range(1, len(pts) - 1),
                key=lambda i: (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2)
        keep[m] = True
        stack = [(0, m), (m, len(pts) - 1)]
    else:
        stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = pts[a]
        bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        norm = math.hypot(dx, dy) or 1e-12
        dmax, imax = -1.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            d = abs(dx * (ay - py) - (ax - px) * dy) / norm
            if d > dmax:
                dmax, imax = d, i
        if dmax > tol:
            keep[imax] = True
            stack.append((a, imax))
            stack.append((imax, b))
    return [p for p, k in zip(pts, keep) if k]


def fit_transform(rings, box):
    x0, y0, x1, y1 = box
    xs = [merc(*p) for ring in rings for p in ring]
    mnx, mny = min(p[0] for p in xs), min(p[1] for p in xs)
    mxx, mxy = max(p[0] for p in xs), max(p[1] for p in xs)
    scale = min((x1 - x0) / (mxx - mnx), (y1 - y0) / (mxy - mny))
    # 中央寄せ
    ox = x0 + ((x1 - x0) - (mxx - mnx) * scale) / 2
    oy = y0 + ((y1 - y0) - (mxy - mny) * scale) / 2
    return lambda lon, lat: ((merc(lon, lat)[0] - mnx) * scale + ox,
                             (merc(lon, lat)[1] - mny) * scale + oy)


def build_path(rings, project):
    parts = []
    total_area = 0.0
    cx = cy = 0.0
    largest_area, largest_c = -1.0, (0, 0)
    for ring in rings:
        pts = [project(*p) for p in ring]
        area = ring_area(pts)
        if area < MIN_AREA:
            continue
        pts = dp_simplify(pts, SIMPLIFY_TOL)
        if len(pts) < 4:
            continue
        d = 'M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in pts) + 'Z'
        parts.append(d)
        rcx = sum(p[0] for p in pts) / len(pts)
        rcy = sum(p[1] for p in pts) / len(pts)
        cx += rcx * area
        cy += rcy * area
        total_area += area
        if area > largest_area:
            largest_area, largest_c = area, (rcx, rcy)
    # ラベル位置は最大ポリゴンの重心（飛び地に引っ張られない）
    return ''.join(parts), largest_c


def main():
    geo = json.load(open(SRC))
    feats = {f['properties']['id']: f for f in geo['features']}

    # 本土: 沖縄を除く46都道府県の遠隔諸島除外リング群でフィット
    mainland_rings = []
    per_pref_rings = {}
    for pid, f in feats.items():
        if pid == 47:
            continue
        rings = [r for r in rings_of(f['geometry']) if not is_remote(r)]
        per_pref_rings[pid] = rings
        mainland_rings.extend(rings)
    project = fit_transform(mainland_rings, FIT)

    prefs = []
    for pid in sorted(per_pref_rings):
        f = feats[pid]
        d, (lx, ly) = build_path(per_pref_rings[pid], project)
        prefs.append({
            'id': pid, 'name': f['properties']['nam_ja'], 'r': REGION_OF[pid],
            'd': d, 'lx': round(lx), 'ly': round(ly),
        })

    # 沖縄: 本島のみをインセット枠にフィット
    oki_rings = sorted(rings_of(feats[47]['geometry']),
                       key=lambda r: ring_area([merc(*p) for p in r]), reverse=True)[:1]
    oki_proj = fit_transform(oki_rings, (INSET_PAD, INSET_PAD, INSET_W - INSET_PAD, INSET_H - INSET_PAD))
    oki_d, _ = build_path(oki_rings, oki_proj)

    lines = []
    lines.append('// 自動生成: dataofjapan/land japan.geojson をメルカトル投影・簡略化したもの')
    lines.append('// 再生成: scratchpad/gen_map.py（セッション記録参照）')
    lines.append('export const VIEWBOX = [0, 0, 510, 470];')
    lines.append('export const INSET = { x: 8, y: 60, w: %d, h: %d };' % (INSET_W, INSET_H))
    lines.append('export const REGION_NAMES = %s;' % json.dumps([n for n, _ in REGIONS], ensure_ascii=False))
    lines.append("export const REGION_COLORS = ['#4a90d9','#5ba85c','#e07b2a','#c9a227','#8b5ca8','#c46ea0','#3aa8a0','#d45050','#1a9bbc'];")
    lines.append('export const OKINAWA_LOCAL = %s;' % json.dumps(oki_d))
    lines.append('export const PREFS = [')
    for p in prefs:
        lines.append('  {id:%d, name:%s, r:%d, lx:%d, ly:%d, d:%s},' % (
            p['id'], json.dumps(p['name'], ensure_ascii=False), p['r'], p['lx'], p['ly'], json.dumps(p['d'])))
    lines.append('  {id:47, name:"沖縄県", r:8, lx:0, ly:0, d:"INSET"},')
    lines.append('];')
    out = '\n'.join(lines) + '\n'
    open(OUT, 'w').write(out)
    print('written', OUT, len(out), 'bytes')
    for p in prefs[:3]:
        print(p['id'], p['name'], 'path len', len(p['d']), 'label', p['lx'], p['ly'])


main()
