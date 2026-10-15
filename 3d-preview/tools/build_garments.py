"""
Builds the 3D garments used by the EliteHub 3D studio: oversized tee,
long-sleeve tee, crewneck sweatshirt, hoodie and tank top.

The garment is described as a signed distance field (boxy body + tapered
sleeves + rib collar + drape folds), meshed with marching cubes, decimated,
then cut open at the neck, cuffs and hem so it reads as fabric rather than a
solid. Output: js/studio/garments/<name>.js (quantised positions + indices + print positions).

Run:  pip install numpy scikit-image fast-simplification
      python tools/build_garments.py            # all garments
      python tools/build_garments.py hoodie     # just one
Tweak BASE / GARMENTS to change fits (length, width, sleeve angle, ribbing...).
"""
import base64, json, math, os, sys
import numpy as np
from skimage.measure import marching_cubes
import fast_simplification

BASE = dict(
    half_width=0.282,      # body half width (oversized, boxy)
    half_depth=0.122,      # body half depth at chest
    hem_y=-0.535,          # bottom of body solid (hem cut sits just above)
    top_y=0.392,           # shoulder ridge height at the neck
    shoulder_slope=0.30,   # drop per metre outward from the neck
    corner_round=0.038,
    sleeves=True,
    sleeve_angle=55.0,     # degrees below horizontal
    sleeve_len=0.322,
    sleeve_r0=0.112,       # radius at armhole
    sleeve_r1=0.094,       # radius at cuff
    cuff_rib=0.0,          # length of a ribbed cuff (0 = plain hem)
    hem_rib=0.0,           # height of a ribbed waistband (0 = plain hem)
    neck_ax=0.088, neck_az=0.074, neck_zc=0.006,
    neck_scoop=0.026,      # how far the front neckline dips
    collar=True,
    hood=False,
    pocket=False,
    armhole=None,          # (centre x, centre y, half width, half height) for sleeveless
    fold_amp=1.0,
    voxel=0.0042,
    target_faces=46000,
)

GARMENTS = {
    # The original oversized tee from the reference video.
    'tee': dict(BASE),
    'longsleeve': dict(BASE, sleeve_angle=50.0, sleeve_len=0.585, sleeve_r0=0.108, sleeve_r1=0.062,
                       cuff_rib=0.055, target_faces=40000),
    'crewneck': dict(BASE, half_depth=0.132, sleeve_angle=50.0, sleeve_len=0.585, sleeve_r0=0.116,
                     sleeve_r1=0.066, cuff_rib=0.065, hem_rib=0.07, fold_amp=0.6, target_faces=40000),
    'hoodie': dict(BASE, half_depth=0.134, sleeve_angle=50.0, sleeve_len=0.585, sleeve_r0=0.118,
                   sleeve_r1=0.066, cuff_rib=0.065, hem_rib=0.07, fold_amp=0.6, collar=False, hood=True,
                   pocket=True, neck_ax=0.098, neck_az=0.084, voxel=0.0039, target_faces=44000),
    'tank': dict(BASE, half_width=0.252, sleeves=False, neck_ax=0.104, neck_az=0.084, neck_scoop=0.06,
                 armhole=(0.268, 0.155, 0.092, 0.185), fold_amp=0.8, target_faces=34000),
}
P = dict(BASE)



def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0.0, 1.0)
    return b * (1 - h) + a * h - k * h * (1 - h)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def top_surface(x, z):
    """Height of the shoulder/yoke surface (before rounding)."""
    ax = np.abs(x)
    out = np.maximum(ax - 0.07, 0.0)
    y = P["top_y"] - P["shoulder_slope"] * out
    y -= 0.034 * (z / P["half_depth"]) ** 2                                       # dome front-to-back
    y -= P["neck_scoop"] * smoothstep(0.0, 0.11, z) * np.exp(-(x / 0.13) ** 2)    # front neck scoop
    return y


def hem_cut_y():
    return P["hem_y"] + 0.017


def body_dims(y):
    r = P["corner_round"]
    t = smoothstep(0.05, P["hem_y"], y)                # 0 at chest -> 1 at hem
    a = P["half_width"] + 0.010 * t - r
    b = P["half_depth"] - 0.008 * smoothstep(0.1, -0.15, y) + 0.004 * t - r
    if P["hem_rib"]:
        band_top = hem_cut_y() + P["hem_rib"]
        band = smoothstep(band_top + 0.012, band_top - 0.008, y)          # 1 inside the waistband
        blouse = np.exp(-((y - (band_top + 0.045)) / 0.035) ** 2)          # fabric gathering above it
        a = a - 0.026 * band + 0.010 * blouse
        b = b - 0.014 * band + 0.008 * blouse
    return a, b, r


def body_sdf(x, y, z):
    a, b, r = body_dims(y)
    n = 2.7
    ux, uz = np.abs(x) / a + 1e-6, np.abs(z) / b + 1e-6
    rr = (ux ** n + uz ** n) ** (1 / n)
    gx = ux ** (n - 1) / a
    gz = uz ** (n - 1) / b
    grad = rr ** (1 - n) * np.sqrt(gx ** 2 + gz ** 2)
    d2 = (rr - 1) / np.maximum(grad, 1e-6)
    dy = np.maximum((P["hem_y"] + r) - y, y - (top_surface(x, z) - r))
    d = np.sqrt(np.maximum(d2, 0) ** 2 + np.maximum(dy, 0) ** 2) + np.minimum(np.maximum(d2, dy), 0) - r

    fa = P["fold_amp"]
    amp = 0.0075 * fa * smoothstep(-0.02, P["hem_y"], y)
    if P["hem_rib"]:
        amp = amp * (1 - smoothstep(hem_cut_y() + P["hem_rib"] + 0.01, hem_cut_y() + P["hem_rib"] - 0.01, y))
    d += amp * np.sin(x * 23.0 + 1.6 * np.sin(y * 6.0 + z * 9.0) + 0.7) * (0.6 + 0.4 * np.sign(z) * np.sin(x * 9.0))
    ax = np.abs(x)
    s = ax * 0.62 + (y - 0.12) * 0.78
    w = np.exp(-((ax - 0.19) ** 2) / 0.006 - ((y - 0.06) ** 2) / 0.018)
    d += 0.0034 * fa * w * np.sin(s * 46.0)
    d += 0.0018 * np.sin(x * 11 + y * 7) * np.sin(y * 13 - z * 17 + 1.0)
    if P["hem_rib"]:
        d += 0.0014 * np.exp(-((y - (hem_cut_y() + P["hem_rib"])) / 0.003) ** 2)   # seam where the band joins
    return d


def _sleeve_p0():
    # sleeve top edge passes through the dropped shoulder point
    a = math.radians(P["sleeve_angle"])
    cx = P["half_width"] + 0.003
    cy = P["top_y"] - P["shoulder_slope"] * (cx - 0.07) - 0.006
    return (cx - P["sleeve_r0"] * math.sin(a), cy - P["sleeve_r0"] * math.cos(a))


SLEEVE_P0 = _sleeve_p0()


def sleeve_frame(side):
    ang = math.radians(P["sleeve_angle"])
    p0 = np.array([side * SLEEVE_P0[0], SLEEVE_P0[1], 0.0])
    dvec = np.array([side * math.cos(ang), -math.sin(ang), 0.0])
    return p0, dvec


def sleeve_sdf(x, y, z, side):
    p0, dv = sleeve_frame(side)
    px, py, pz = x - p0[0], y - p0[1], z - p0[2]
    t = px * dv[0] + py * dv[1] + pz * dv[2]
    L = P["sleeve_len"]
    tc = np.clip(t, 0, L)
    qx, qy, qz = px - tc * dv[0], py - tc * dv[1], pz - tc * dv[2]
    radial = np.sqrt(qx ** 2 + qy ** 2 + (qz * 1.16) ** 2)
    rad = P["sleeve_r0"] + (P["sleeve_r1"] - P["sleeve_r0"]) * (tc / L)
    cr = P["cuff_rib"]
    if cr:
        cuff_start = L - cr
        band = smoothstep(cuff_start - 0.012, cuff_start + 0.006, tc)
        blouse = np.exp(-((tc - (cuff_start - 0.045)) / 0.04) ** 2)
        rad = rad * (1 - 0.2 * band) + 0.011 * blouse
    else:
        rad = rad + 0.006 * smoothstep(L * 0.75, L, tc)               # tiny cuff flare
    dr = radial - rad
    dt = t - L
    d = np.sqrt(np.maximum(dr, 0) ** 2 + np.maximum(dt, 0) ** 2) + np.minimum(np.maximum(dr, dt), 0)
    ux_, uy_ = side * dv[1], -side * dv[0]
    under = np.clip((qx * ux_ + qy * uy_) / 0.1, 0, 1)
    d += 0.0035 * under * np.sin(tc * 44.0 + qz * 30.0) * (1 - tc / L)
    ang_around = np.arctan2(qz, qx * side * 0.6 + qy * 0.8)
    d += 0.0030 * np.sin(ang_around * 3.0 + tc * 9.0) * smoothstep(0.05, L, tc)
    d += 0.0017 * np.exp(-((t - 0.088) ** 2) / 0.00002)              # drop-shoulder seam
    if cr:
        d += 0.0014 * np.exp(-((t - (L - cr)) ** 2) / 0.00001)        # cuff seam
    d = np.maximum(d, y - (top_surface(x, z) - 0.004))                # never rise above the shoulder line
    return d


def rib_sdf(x, y, z):
    ax, az, zc = P["neck_ax"], P["neck_az"], P["neck_zc"]
    e = np.sqrt((x / ax) ** 2 + ((z - zc) / az) ** 2)
    q = (e - 1.0) * (ax + az) * 0.5
    yc = top_surface(x, z) + 0.003
    hx, hy = 0.0062, 0.0115
    dx = np.abs(q - 0.0062) - hx
    dy = np.abs(y - yc) - hy
    rr = 0.004
    return np.sqrt(np.maximum(dx + rr, 0) ** 2 + np.maximum(dy + rr, 0) ** 2) + np.minimum(np.maximum(dx, dy), 0) - rr


def hood_centre():
    return np.array([0.0, P["top_y"] + 0.095, -0.05])


def hood_sdf(x, y, z):
    c = hood_centre()
    rx, ry, rz = 0.122, 0.165, 0.14
    px, py, pz = (x - c[0]) / rx, (y - c[1]) / ry, (z - c[2]) / rz
    k = np.sqrt(px ** 2 + py ** 2 + pz ** 2)
    d = (k - 1.0) * min(rx, ry, rz)
    # the hood sags onto the shoulders at the back and is slightly pinched at the crown
    d += 0.012 * np.exp(-((y - (c[1] + 0.15)) / 0.05) ** 2) * np.exp(-(x / 0.05) ** 2)
    d += 0.0025 * np.sin(y * 40 + z * 25) * smoothstep(c[1] - 0.05, c[1] + 0.1, y)
    d += 0.0022 * np.exp(-(x / 0.0045) ** 2) * smoothstep(c[1] - 0.06, c[1] + 0.02, y)   # centre seam
    return d


def front_z(x, y):
    """Approximate z of the body's front surface (used to lay the pocket flat on it)."""
    a, b, r = body_dims(y)
    aa, bb = a + r, b + r
    n = 2.7
    u = np.clip(np.abs(x) / aa, 0, 0.999)
    return bb * (1 - u ** n) ** (1 / n)


def pocket_sdf(x, y, z):
    yb = hem_cut_y() + P["hem_rib"] + 0.012
    yt = yb + 0.25
    hw_b, hw_t = 0.175, 0.125
    tt = np.clip((y - yb) / (yt - yb), 0, 1)
    hw = hw_b + (hw_t - hw_b) * tt
    dx = np.abs(x) - hw
    dy = np.maximum(yb - y, y - yt)
    d2 = np.sqrt(np.maximum(dx, 0) ** 2 + np.maximum(dy, 0) ** 2) + np.minimum(np.maximum(dx, dy), 0) - 0.006
    zf = front_z(x, y)
    dz = np.abs(z - (zf - 0.002)) - 0.0075
    return np.maximum(d2, dz)


def string_sdf(x, y, z, side):
    yb = P["top_y"] - 0.245
    a = np.array([side * 0.052, P["top_y"] - 0.035, 0.132])
    b = np.array([side * 0.06, yb, float(front_z(np.array([0.06]), np.array([yb]))[0]) + 0.0045])
    pa = np.stack([x - a[0], y - a[1], z - a[2]])
    ba = b - a
    h = np.clip((pa[0] * ba[0] + pa[1] * ba[1] + pa[2] * ba[2]) / ba.dot(ba), 0, 1)
    dx, dy, dz = pa[0] - ba[0] * h, pa[1] - ba[1] * h, pa[2] - ba[2] * h
    r = 0.0052 + 0.0022 * smoothstep(0.92, 0.97, h)   # aglet at the tip
    return np.sqrt(dx * dx + dy * dy + dz * dz) - r


def garment_sdf(x, y, z):
    d = body_sdf(x, y, z)
    if P["sleeves"]:
        d = smin(d, sleeve_sdf(x, y, z, 1), 0.045)
        d = smin(d, sleeve_sdf(x, y, z, -1), 0.045)
    if P["collar"]:
        d = smin(d, rib_sdf(x, y, z), 0.004)
    if P["pocket"]:
        d = smin(d, pocket_sdf(x, y, z), 0.003)
    if P["hood"]:
        d = smin(d, hood_sdf(x, y, z), 0.05)
        d = np.minimum(d, string_sdf(x, y, z, 1))
        d = np.minimum(d, string_sdf(x, y, z, -1))
    return d


def keep_fn(p):
    """>0 keep, <0 cut away (openings)."""
    x, y, z = p[:, 0], p[:, 1], p[:, 2]
    if P["hood"]:
        # face opening on the front of the hood
        c = hood_centre()
        e = np.sqrt((x / 0.088) ** 2 + ((y - (c[1] - 0.02)) / 0.118) ** 2)
        g = np.where((z > c[2] + 0.02) & (y > P["top_y"] - 0.02), (e - 1.0) * 0.1, 1.0)
    else:
        ax, az, zc = P["neck_ax"], P["neck_az"], P["neck_zc"]
        e = np.sqrt((x / ax) ** 2 + ((z - zc) / az) ** 2)
        q = (e - 1.0) * (ax + az) * 0.5
        g = np.where(y > 0.15, q + (0.0016 if P["collar"] else -0.004), 1.0)
    hem = y - (hem_cut_y() + 0.0035 * np.sin(x * 17 + 0.4) * (0 if P["hem_rib"] else 1) + 0.002 * np.sin(z * 30))
    g = np.minimum(g, hem)
    if P["sleeves"]:
        for side in (1, -1):
            p0, dv = sleeve_frame(side)
            rel = p - p0
            t = rel @ dv
            radial = np.linalg.norm(rel - np.outer(t, dv), axis=1)
            cut = (P["sleeve_len"] - 0.014) - t
            near_cuff = (radial < max(P["sleeve_r1"], 0.06) * 1.2) & (side * x > P["half_width"] + 0.006)
            g = np.minimum(g, np.where(near_cuff, cut, 1.0))
    if P["armhole"]:
        cx, cy, hx, hy = P["armhole"]
        e = np.sqrt(((np.abs(x) - cx) / hx) ** 2 + ((y - cy) / hy) ** 2)
        g = np.minimum(g, (e - 1.0) * 0.08)
    return g


def clip_mesh(V, F, fn):
    g = fn(V)
    keep = g >= 0
    out_faces = []
    newV = list(V)
    edge_cache = {}

    def edge_vertex(i, j):
        key = (min(i, j), max(i, j))
        if key in edge_cache:
            return edge_cache[key]
        a, b = V[i], V[j]
        ga, gb = g[i], g[j]
        lo, hi = (a, b) if ga < 0 else (b, a)
        # bisection refine for an accurate edge
        t0, t1 = 0.0, 1.0
        for _ in range(12):
            tm = 0.5 * (t0 + t1)
            pm = lo + (hi - lo) * tm
            if fn(pm[None, :])[0] < 0:
                t0 = tm
            else:
                t1 = tm
        p = lo + (hi - lo) * t1
        newV.append(p)
        edge_cache[key] = len(newV) - 1
        return edge_cache[key]

    k = keep[F]
    full = F[k.all(axis=1)]
    mixed = F[k.any(axis=1) & ~k.all(axis=1)]
    for tri in mixed:
        poly = []
        for e in range(3):
            i, j = tri[e], tri[(e + 1) % 3]
            if keep[i]:
                poly.append(i)
            if keep[i] != keep[j]:
                poly.append(edge_vertex(i, j))
        for m in range(1, len(poly) - 1):
            out_faces.append((poly[0], poly[m], poly[m + 1]))
    F2 = np.vstack([full, np.array(out_faces, dtype=F.dtype)]) if out_faces else full
    V2 = np.array(newV)
    used = np.unique(F2)
    remap = -np.ones(len(V2), dtype=np.int64)
    remap[used] = np.arange(len(used))
    return V2[used], remap[F2]


def vertex_normals(V, F):
    fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    n = np.zeros_like(V)
    for c in range(3):
        np.add.at(n, F[:, c], fn)
    n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
    return n


def add_rims(V, F, thickness=0.0045):
    """Give cut edges a little fabric thickness by folding a strip inward."""
    edges = np.vstack([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]])
    key = np.sort(edges, axis=1)
    uniq, inv, cnt = np.unique(key, axis=0, return_inverse=True, return_counts=True)
    boundary = edges[cnt[inv.ravel()] == 1]          # keep original orientation
    N = vertex_normals(V, F)
    bverts = np.unique(boundary)
    inner = {}
    newV = list(V)
    for v in bverts:
        newV.append(V[v] - N[v] * thickness)
        inner[v] = len(newV) - 1
    faces = []
    for a, b in boundary:
        ia, ib = inner[a], inner[b]
        faces.append((b, a, ia))
        faces.append((b, ia, ib))
    return np.array(newV), np.vstack([F, np.array(faces)]), len(bverts)


def print_presets(centre):
    """Print positions in the exported mesh's coordinates (metres, centred)."""
    L = lambda x, y, z: [round(x - centre[0], 5), round(y - centre[1], 5), round(z - centre[2], 5)]
    ray = lambda pid, label, x, y, z_dir, size: {
        'id': pid, 'label': label, 'origin': L(x, y, z_dir), 'target': L(x, y, 0.0), 'size': size}
    hood, tank = P['hood'], not P['sleeves']
    out = [
        ray('front', 'Front centre', 0, 0.11 if hood else 0.15, 1, 0.24 if tank else 0.27),
        ray('chest', 'Left chest', 0.125 if hood else (0.09 if tank else 0.105), 0.215 if hood else 0.235, 1, 0.08),
        ray('back', 'Back', 0, 0.06 if hood else 0.19, -1, 0.3),
    ]
    if P['pocket']:
        yb = hem_cut_y() + P['hem_rib'] + 0.012
        out.append(ray('pocket', 'Pocket', 0, yb + 0.12, 1, 0.15))
    if P['sleeves']:
        a = math.radians(P['sleeve_angle'])
        t = 0.17 if P['sleeve_len'] < 0.4 else 0.3
        for side, pid, label in ((1, 'sleeveL', 'Left sleeve'), (-1, 'sleeveR', 'Right sleeve')):
            m = [side * (SLEEVE_P0[0] + math.cos(a) * t), SLEEVE_P0[1] - math.sin(a) * t, 0.0]
            n = np.array([side * math.sin(a), math.cos(a) * 0.7, 0.45])
            n /= np.linalg.norm(n)
            out.append({'id': pid, 'label': label, 'origin': L(m[0] + n[0], m[1] + n[1], m[2] + n[2]),
                        'target': L(*m), 'size': 0.07})
    if P['hood']:
        c = hood_centre()
        out.append({'id': 'hood', 'label': 'Hood', 'origin': L(0.9, c[1], c[2] - 0.2), 'target': L(0, c[1], c[2] - 0.02), 'size': 0.09})
    return out


def build(name):
    global P, SLEEVE_P0
    P = dict(GARMENTS[name])
    SLEEVE_P0 = _sleeve_p0()
    vx = P["voxel"]
    reach = P["half_width"] + 0.06
    if P["sleeves"]:
        a = math.radians(P["sleeve_angle"])
        reach = max(reach, SLEEVE_P0[0] + math.cos(a) * P["sleeve_len"] + P["sleeve_r0"] + 0.04)
    ytop = P["top_y"] + (0.31 if P["hood"] else 0.06)
    zext = P["half_depth"] + (0.13 if P["hood"] else 0.08)
    xs = np.arange(-reach, reach + vx, vx, dtype=np.float32)
    ys = np.arange(P["hem_y"] - 0.05, ytop + vx, vx, dtype=np.float32)
    zs = np.arange(-zext, zext + vx, vx, dtype=np.float32)
    print(name, "grid", len(xs), len(ys), len(zs))
    vol = np.empty((len(xs), len(ys), len(zs)), dtype=np.float32)
    Y, Z = np.meshgrid(ys, zs, indexing="ij")
    for i, x in enumerate(xs):
        vol[i] = garment_sdf(np.full_like(Y, x), Y, Z)
    verts, faces, _, _ = marching_cubes(vol, 0.0, spacing=(vx, vx, vx))
    verts += np.array([xs[0], ys[0], zs[0]])
    ratio = 1 - P["target_faces"] / len(faces)
    v2, f2 = fast_simplification.simplify(verts.astype(np.float32), faces.astype(np.int32), ratio)
    v3, f3 = clip_mesh(v2.astype(np.float64), f2.astype(np.int64), keep_fn)
    v4, f4, nb = add_rims(v3, f3)
    print(name, "faces", len(f4), "boundary verts", nb)

    mn, mx = v4.min(0), v4.max(0)
    centre = (mn + mx) / 2
    v4 -= centre
    mn, mx = v4.min(0), v4.max(0)
    q = np.round((v4 - mn) / (mx - mn) * 65535).astype(np.uint16)
    idx = f4.astype(np.uint16 if len(v4) < 65536 else np.uint32)
    out = {
        "presets": print_presets(centre),
        "min": [round(float(c), 6) for c in mn],
        "max": [round(float(c), 6) for c in mx],
        "indexType": "u16" if idx.dtype == np.uint16 else "u32",
        "positions": base64.b64encode(q.tobytes()).decode(),
        "indices": base64.b64encode(idx.tobytes()).decode(),
    }
    here = os.path.dirname(os.path.abspath(__file__))
    dest = os.path.join(here, "..", "js", "studio", "garments", f"{name}.js")
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "w") as fh:
        fh.write("// Generated by tools/build_garments.py. Do not edit by hand.\n")
        fh.write("export const MESH = " + json.dumps(out) + ";\n")
    print("wrote", dest, os.path.getsize(dest) // 1024, "KB")


if __name__ == "__main__":
    names = sys.argv[1:] or list(GARMENTS)
    for n in names:
        build(n)
