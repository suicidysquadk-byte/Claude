# Reels "Móvel planejado começa antes da obra" (AlphaHome) - render pipeline
import numpy as np, cv2, subprocess, json, math, sys, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

S = os.path.dirname(os.path.abspath(__file__))
W, H, FPS = 1080, 1920, 30
DUR = 43.30
SRC = {k: f"{S}/src/{k}.mp4" for k in "ABCDE"}
FPSSRC = {"A": 60.0, "B": 30.0, "C": 30.0, "D": 30.0, "E": 59.94}
F = f"{S}/fonts/"
IVORY = np.array([242, 238, 230], np.float32) / 255
GOLD = np.array([195, 153, 83], np.float32) / 255
GOLD_SOFT = np.array([224, 191, 133], np.float32) / 255
BLACK = np.zeros(3, np.float32)

def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def ramp(t, a, b): return clamp((t - a) / (b - a)) if b > a else float(t >= a)
def smooth(x): x = clamp(x); return x * x * (3 - 2 * x)
def eout(x): x = clamp(x); return 1 - (1 - x) ** 3
def einout(x): x = clamp(x); return 4 * x ** 3 if x < .5 else 1 - (-2 * x + 2) ** 3 / 2
def eback(x):
    x = clamp(x)
    if x <= 0.0: return 0.0
    c1 = 1.70158; c3 = c1 + 1
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2

# ---------------------------------------------------------------- fonts / text
_fc = {}
def font(name, size):
    k = (name, size)
    if k not in _fc: _fc[k] = ImageFont.truetype(F + name, size)
    return _fc[k]

def text_mask(text, fnt, spacing=0):
    """Return (mask float32 HxW 0..1, ascent) of text with letter spacing; baseline at y=asc."""
    asc, desc = fnt.getmetrics()
    pad = 12
    wid = int(sum(fnt.getlength(c) + spacing for c in text) - spacing + 2 * pad) if spacing else int(fnt.getlength(text) + 2 * pad)
    img = Image.new("L", (max(wid, 4), asc + desc + 2 * pad), 0)
    d = ImageDraw.Draw(img)
    if spacing:
        x = pad
        for c in text:
            d.text((x, pad + asc), c, font=fnt, fill=255, anchor="ls"); x += fnt.getlength(c) + spacing
    else:
        d.text((pad, pad + asc), text, font=fnt, fill=255, anchor="ls")
    return np.asarray(img, np.float32) / 255, pad + asc, pad

_tm = {}
def tmask(text, fname, size, spacing=0):
    k = (text, fname, size, spacing)
    if k not in _tm:
        m, base, pad = text_mask(text, font(fname, size), spacing)
        sh = cv2.GaussianBlur(m, (0, 0), 5)
        _tm[k] = (m, sh, base, pad)
    return _tm[k]

def paste(frame, mask, x, y, color, alpha):
    """alpha-composite a color through mask at top-left (x,y) (float coords rounded)."""
    if alpha <= 0.001: return
    x, y = int(round(x)), int(round(y))
    h, w = mask.shape
    x0, y0, x1, y1 = max(x, 0), max(y, 0), min(x + w, W), min(y + h, H)
    if x1 <= x0 or y1 <= y0: return
    m = mask[y0 - y:y1 - y, x0 - x:x1 - x][..., None] * alpha
    reg = frame[y0:y1, x0:x1]
    reg *= (1 - m); reg += m * color

def draw_text(frame, text, fname, size, x, y_base, color, alpha, spacing=0, align="left", shadow=0.45):
    m, sh, base, pad = tmask(text, fname, size, spacing)
    w = m.shape[1] - 2 * pad
    if align == "center": x = x - w / 2
    elif align == "right": x = x - w
    if shadow > 0: paste(frame, sh, x - pad, y_base - base + 3, BLACK, alpha * shadow)
    paste(frame, m, x - pad, y_base - base, color, alpha)
    return w

def text_width(text, fname, size, spacing=0):
    m, sh, base, pad = tmask(text, fname, size, spacing); return m.shape[1] - 2 * pad

# ---------------------------------------------------------------- vector helpers (AA via cv2, composited as masks)
SH = 4  # subpixel bits
def P(p): return (int(round(p[0] * (1 << SH))), int(round(p[1] * (1 << SH))))

class Layer:
    """single-color coverage mask to composite"""
    def __init__(self): self.m = np.zeros((H, W), np.uint8)
    def line(self, a, b, th=2):
        cv2.line(self.m, P(a), P(b), 255, th, cv2.LINE_AA, SH); return self
    def poly_partial(self, pts, prog, th=2):
        if prog <= 0: return self
        segs = [(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
        L = [math.dist(a, b) for a, b in segs]; tot = sum(L); left = tot * clamp(prog)
        for (a, b), l in zip(segs, L):
            if left <= 0: break
            f = min(1, left / l) if l > 0 else 1
            self.line(a, (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f), th); left -= l
        return self
    def dashed(self, a, b, prog=1.0, dash=16, gap=10, th=2):
        l = math.dist(a, b); 
        if l == 0 or prog <= 0: return self
        dx, dy = (b[0] - a[0]) / l, (b[1] - a[1]) / l; s = 0; end = l * clamp(prog)
        while s < end:
            e = min(s + dash, end)
            self.line((a[0] + dx * s, a[1] + dy * s), (a[0] + dx * e, a[1] + dy * e), th); s += dash + gap
        return self
    def circle(self, c, r, th=2, fill=False):
        cv2.circle(self.m, P(c), int(round(r * (1 << SH))), 255, -1 if fill else th, cv2.LINE_AA, SH); return self
    def rect(self, x0, y0, x1, y1, fill=False, th=2):
        if fill: cv2.rectangle(self.m, (int(x0), int(y0)), (int(x1), int(y1)), 255, -1)
        else:
            for a, b in [((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)), ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0))]: self.line(a, b, th)
        return self
    def rrect(self, x0, y0, x1, y1, r, th=2):
        m = self.m
        for a, b in [((x0 + r, y0), (x1 - r, y0)), ((x0 + r, y1), (x1 - r, y1)), ((x0, y0 + r), (x0, y1 - r)), ((x1, y0 + r), (x1, y1 - r))]: self.line(a, b, th)
        for c, a0 in [((x0 + r, y0 + r), 180), ((x1 - r, y0 + r), 270), ((x1 - r, y1 - r), 0), ((x0 + r, y1 - r), 90)]:
            cv2.ellipse(m, P(c), (r << SH, r << SH), 0, a0, a0 + 90, 255, th, cv2.LINE_AA, SH)
        return self
    def comp(self, frame, color, alpha):
        if alpha <= 0.001: return
        ys, xs = np.nonzero(self.m[::4, ::4]) if False else (None, None)
        m = self.m.astype(np.float32)[..., None] * (alpha / 255.0)
        frame *= (1 - m); frame += m * color

def comp_mask_bbox(frame, layer, color, alpha, bbox):
    if alpha <= 0.001: return
    x0, y0, x1, y1 = [int(v) for v in bbox]
    x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, W), min(y1, H)
    m = layer.m[y0:y1, x0:x1].astype(np.float32)[..., None] * (alpha / 255.0)
    reg = frame[y0:y1, x0:x1]; reg *= (1 - m); reg += m * color

def corner_marks(frame, x0, y0, x1, y1, L, color, alpha, th=2):
    ly = Layer()
    for (cx, cy, sx, sy) in [(x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)]:
        ly.line((cx, cy), (cx + sx * L, cy), th); ly.line((cx, cy), (cx, cy + sy * L), th)
    comp_mask_bbox(frame, ly, color, alpha, (x0 - 4, y0 - 4, x1 + 5, y1 + 5))

# ---------------------------------------------------------------- source readers
class Reader:
    def __init__(self, key, ss, dur):
        self.key, self.ss, self.fps = key, ss, FPSSRC[key]
        self.p = subprocess.Popen(["ffmpeg", "-v", "error", "-ss", f"{ss:.3f}", "-i", SRC[key], "-t", f"{dur + 0.5:.3f}",
                                   "-vf", "scale=1080:1920:flags=lanczos", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                                  stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=W * H * 3 * 2)
        self.idx, self.cur = -1, None
    def get(self, ts):
        want = max(0, int(round((ts - self.ss) * self.fps)))
        while self.idx < want:
            b = self.p.stdout.read(W * H * 3)
            if len(b) < W * H * 3: break
            self.cur = np.frombuffer(b, np.uint8).reshape(H, W, 3); self.idx += 1
        return self.cur
    def close(self):
        try: self.p.kill()
        except Exception: pass

def still(path):
    return cv2.cvtColor(cv2.imread(path), cv2.COLOR_BGR2RGB)

# ---------------------------------------------------------------- grading
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
VIG = 1 - 0.20 * np.clip(((xx - W / 2) / (W * 0.62)) ** 2 + ((yy - H / 2) / (H * 0.60)) ** 2, 0, 1.4) ** 1.3
VIG = VIG[..., None].astype(np.float32)
GRAD = np.clip((yy - 980) / (H - 980), 0, 1) ** 1.25 * 0.58   # bottom darkening for captions
GRAD += np.clip((260 - yy) / 260, 0, 1) ** 1.6 * 0.30          # top darkening for tags
GRAD = GRAD[..., None].astype(np.float32)

def make_lut(exposure=0.0, temp=0.0, tint=0.0, contrast=0.12, lift=0.018, gamma=1.0, hi=0.97):
    x = np.arange(256, dtype=np.float32) / 255
    luts = []
    for ch, wb in enumerate([1 + temp - tint * 0.3, 1 + tint, 1 - temp - tint * 0.3]):
        y = np.clip(x * (2 ** exposure) * wb, 0, 1) ** gamma
        s = y * y * (3 - 2 * y)
        y = y * (1 - contrast) + s * contrast
        y = lift + y * (hi - lift)
        luts.append(np.clip(y * 255, 0, 255).astype(np.uint8))
    return np.stack(luts, 1)  # 256x3

_lutc = {}
def grade(img_u8, g):
    k = tuple(sorted(g.items()))
    if k not in _lutc:
        gg = dict(g); sat = gg.pop("sat", 0.9); _lutc[k] = (make_lut(**gg), sat)
    lut, sat = _lutc[k]
    out = np.empty_like(img_u8)
    for c in range(3): out[..., c] = cv2.LUT(img_u8[..., c], lut[:, c])
    f = out.astype(np.float32) * (1 / 255)
    if abs(sat - 1) > 1e-3:
        lum = f @ np.array([0.2126, 0.7152, 0.0722], np.float32)
        f = lum[..., None] + (f - lum[..., None]) * sat
    return f

def zoom(img, z, cx=W / 2, cy=H / 2, dx=0, dy=0):
    if abs(z - 1) < 1e-4 and dx == 0 and dy == 0: return img
    M = np.float32([[z, 0, cx - z * cx + dx], [0, z, cy - z * cy + dy]])
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)

def zpt(p, z, cx=W / 2, cy=H / 2, dx=0, dy=0): return (cx + (p[0] - cx) * z + dx, cy + (p[1] - cy) * z + dy)

def blur_dark(f, sigma_frac, dark, desat):
    if sigma_frac > 0.01:
        small = cv2.resize(f, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
        small = cv2.GaussianBlur(small, (0, 0), 1 + 7 * sigma_frac)
        b = cv2.resize(small, (W, H), interpolation=cv2.INTER_LINEAR)
        f = f * (1 - min(1, sigma_frac * 1.6)) + b * min(1, sigma_frac * 1.6)
    if desat > 0:
        lum = f @ np.array([0.2126, 0.7152, 0.0722], np.float32)
        f = f + (lum[..., None] - f) * desat
    return f * (1 - dark)

BASE_G = dict(exposure=0.0, temp=0.02, contrast=0.14, lift=0.02, sat=0.90)
def G(**kw): d = dict(BASE_G); d.update(kw); return d

# ---------------------------------------------------------------- timeline
SHOTS = [
    dict(n="S1", t0=0.00, t1=2.64, src="E", ss=0.00, rate=0.5, z=(1.00, 1.07), c=(560, 900), g=G(exposure=-0.10, temp=0.03)),
    dict(n="S2", t0=2.64, t1=3.30, src="C", ss=0.40, rate=1.0, z=(1.12, 1.17), c=(430, 690), g=G(exposure=-0.05, temp=0.0, sat=0.88)),
    dict(n="S3", t0=3.30, t1=6.30, kind="blueprint"),
    dict(n="S4", t0=5.95, fi=0.35, t1=10.62, src="A", ss=0.00, rate=0.5, z=(1.00, 1.05), c=(540, 820), g=G(exposure=-0.12, temp=0.03, sat=0.95, contrast=0.18)),
    dict(n="S5", t0=10.62, t1=14.40, src="B", ss=0.90, rate=1.0, z=(1.02, 1.05), c=(540, 900), g=G(exposure=-0.10, temp=0.03, contrast=0.18)),
    dict(n="S6", t0=14.40, t1=26.35, kind="drywall"),
    dict(n="S8", t0=26.05, fi=0.30, t1=27.70, src="C", ss=9.70, rate=1.0, z=(1.0, 1.0), g=G(exposure=-0.05, temp=0.0, sat=0.88), kind="markers"),
    dict(n="S9", t0=27.70, t1=30.40, src="C", ss=12.00, rate=1.0, z=(1.05, 1.09), c=(560, 700), g=G(exposure=-0.05, temp=0.0, sat=0.88)),
    dict(n="S10", t0=30.40, t1=33.90, src="D", ss=4.93, rate=1.0, z=(1.02, 1.06), c=(540, 900), g=G(exposure=-0.02, temp=0.035)),
    dict(n="S11", t0=33.90, t1=37.02, src="B", ss=4.68, rate=1.0, z=(1.02, 1.06), c=(540, 900), g=G(exposure=-0.10, temp=0.03, contrast=0.18)),
    dict(n="S12", t0=37.02, t1=38.85, src="A", ss=2.26, rate=0.5, z=(1.02, 1.08), c=(640, 520), g=G(exposure=-0.12, temp=0.03, sat=0.95, contrast=0.18)),
    dict(n="S13", t0=38.55, fi=0.30, t1=DUR + 0.01, kind="endcard"),
]

CAPTIONS = [
    (0.29, 3.12, "O móvel planejado não começa na *montagem.*"),
    (3.47, 5.80, "Ele começa *antes da obra.*"),
    (6.25, 8.47, "Na AlphaHome, desenvolvemos *projetos*"),
    (8.53, 10.58, "tanto para construção em *alvenaria*"),
    (10.65, 12.40, "quanto para *contêineres.*"),
    (12.77, 14.40, "Neste projeto, por exemplo,"),
    (14.47, 16.75, "as estruturas internas são em *drywall.*"),
    (18.11, 20.35, "Por isso, ainda na *fase de projeto,*"),
    (20.47, 22.97, "já orientamos onde devem ser previstos"),
    (23.03, 24.95, "os *pontos de reforço* necessários"),
    (25.03, 27.40, "para a instalação dos *móveis planejados.*"),
    (27.89, 30.37, "Assim, quando chega a hora da *montagem,*"),
    (30.42, 33.78, "tudo já está *preparado* para receber a marcenaria."),
    (34.81, 36.28, "Vai construir ou *reformar?*"),
    (36.45, 38.62, "Planeje seus móveis *antes da obra* começar."),
]
# speech end inside each caption window (for word pacing)
SPEECH_END = [3.03, 5.47, 8.43, 10.49, 11.95, 14.31, 16.55, 20.17, 22.91, 24.79, 26.97, 30.30, 33.61, 36.13, 38.61]

TAGS = [  # (t0, t1, text)
    (3.60, 5.95, "PROJETO"),
    (6.55, 10.45, "TRÊS LAGOAS · MS"),
    (10.90, 14.25, "PROJETO EM CONTÊINER"),
    (14.60, 16.45, "INTERIOR EM DRYWALL"),
]

# ---------------------------------------------------------------- captions
CAP_Y = 1318          # vertical centre of caption block
CAP_MAXW = 880
N_FONT, N_SIZE = "Montserrat-Medium.ttf", 50
H_FONT, H_SIZE = "Marcellus-Regular.ttf", 58
LINE_H = 70

def layout_caption(text):
    toks = []; hl = False
    for raw in text.split(" "):
        w = raw
        start_hl = w.startswith("*"); 
        if start_hl: hl = True; w = w[1:]
        end_hl = w.endswith("*") or w.endswith("*,") or w.endswith("*.")
        clean = w.replace("*", "")
        toks.append((clean, hl))
        if end_hl: hl = False
    space = font(N_FONT, N_SIZE).getlength(" ")
    lines = [[]]; cur = 0
    for wd, h in toks:
        wdt = text_width(wd, H_FONT if h else N_FONT, H_SIZE if h else N_SIZE)
        if lines[-1] and cur + space + wdt > CAP_MAXW:
            lines.append([]); cur = 0
        cur += (space if lines[-1] else 0) + wdt
        lines[-1].append((wd, h, wdt))
    # balance two lines: move words from first to second while it reduces max width
    if len(lines) == 2:
        def lw(l): return sum(x[2] for x in l) + space * (len(l) - 1)
        while len(lines[0]) > 1:
            a0, a1 = lines[0][:-1], [lines[0][-1]] + lines[1]
            if max(lw(a0), lw(a1)) < max(lw(lines[0]), lw(lines[1])) and lw(a1) <= CAP_MAXW:
                lines[0], lines[1] = a0, a1
            else: break
    placed = []
    n = len(lines); top_base = CAP_Y - (n - 1) * LINE_H / 2 + 16
    for li, l in enumerate(lines):
        tw = sum(x[2] for x in l) + space * (len(l) - 1); x = W / 2 - tw / 2
        for wd, h, wdt in l:
            placed.append((wd, h, x, top_base + li * LINE_H)); x += wdt + space
    return placed

_caps = []
for i, (s, e, txt) in enumerate(CAPTIONS):
    pl = layout_caption(txt)
    se = SPEECH_END[i]
    wts = [len(w) + 2.2 for (w, h, x, y) in pl]; tot = sum(wts); t = s - 0.06; times = []
    for wt in wts: times.append(t); t += (se - s) * wt / tot
    _caps.append((s, e, pl, times))

_bd = {}
def cap_backdrop(i, pl):
    if i not in _bd:
        x0 = min(x for (w, h, x, y) in pl) - 70; x1 = max(x + text_width(w, H_FONT if h else N_FONT, H_SIZE if h else N_SIZE) for (w, h, x, y) in pl) + 70
        y0 = min(y for (w, h, x, y) in pl) - 95; y1 = max(y for (w, h, x, y) in pl) + 55
        bx0, by0, bx1, by1 = int(max(0, x0 - 120)), int(max(0, y0 - 120)), int(min(W, x1 + 120)), int(min(H, y1 + 120))
        m = np.zeros((by1 - by0, bx1 - bx0), np.float32)
        cv2.rectangle(m, (int(x0 - bx0), int(y0 - by0)), (int(x1 - bx0), int(y1 - by0)), 1.0, -1)
        m = cv2.GaussianBlur(m, (0, 0), 38)
        _bd[i] = (m / max(m.max(), 1e-6), bx0, by0)
    return _bd[i]

def draw_captions(frame, T):
    for ci, (s, e, pl, times) in enumerate(_caps):
        if T < s - 0.1 or T > e + 0.01: continue
        out = 1 - ramp(T, e - 0.16, e)
        m, bx0, by0 = cap_backdrop(ci, pl)
        paste(frame, m, bx0, by0, BLACK, 0.34 * eout(ramp(T, s - 0.1, s + 0.25)) * out)
        for (wd, h, x, yb), tw in zip(pl, times):
            a = eout(ramp(T, tw, tw + 0.28)) * out
            if a <= 0: continue
            dy = (1 - eout(ramp(T, tw, tw + 0.36))) * 14
            if h: draw_text(frame, wd, H_FONT, H_SIZE, x, yb + dy, GOLD_SOFT, a, shadow=0.55)
            else: draw_text(frame, wd, N_FONT, N_SIZE, x, yb + dy, IVORY, a, shadow=0.55)

def draw_tags(frame, T):
    for (s, e, txt) in TAGS:
        if T < s or T > e: continue
        a = eout(ramp(T, s, s + 0.4)) * (1 - ramp(T, e - 0.3, e))
        dx = (1 - eout(ramp(T, s, s + 0.5))) * -14
        ly = Layer().circle((98 + dx, 318), 5, fill=True)
        comp_mask_bbox(frame, ly, GOLD_SOFT, a, (80, 300, 120, 340))
        draw_text(frame, txt, "Montserrat-SemiBold.ttf", 24, 116 + dx, 327, IVORY, a * 0.95, spacing=5, shadow=0.5)
        ln = Layer().line((116 + dx, 344), (116 + dx + 46 * eout(ramp(T, s + 0.2, s + 0.8)), 344), 2)
        comp_mask_bbox(frame, ln, GOLD, a * 0.9, (100, 340, 200, 350))

# ---------------------------------------------------------------- S3: blueprint over empty room (freeze D@2.4)
BP_STILL = None
def shot_blueprint(T):
    global BP_STILL
    if BP_STILL is None: BP_STILL = still(f"{S}/stills/D_2.4.png")
    z = 1.0 + 0.045 * einout(ramp(T, 3.30, 6.30)); cx, cy = 420, 980
    img = zoom(BP_STILL, z, cx, cy)
    f = grade(img, G(exposure=-0.02, temp=0.035))
    b = einout(ramp(T, 3.32, 3.85))
    f = blur_dark(f, 0.0, 0.52 * b, 0.62 * b)
    f[..., 0] *= 1 + 0.03 * b; f[..., 2] *= 1 - 0.05 * b
    q = lambda p: zpt(p, z, cx, cy)
    # geometry in source coords
    wall = [(0, 270), (702, 272), (698, 1396), (0, 1392)]
    ceil = [(702, 272), (992, 8)]
    floor = [(694, 1398), (1000, 1890)]
    slats = [436, 478, 524, 566, 612, 660]
    L1 = Layer().poly_partial([q(p) for p in wall], einout(ramp(T, 3.45, 4.15)), 2)
    L1.poly_partial([q(p) for p in ceil], einout(ramp(T, 3.85, 4.35)), 2)
    L1.poly_partial([q(p) for p in floor], einout(ramp(T, 3.85, 4.35)), 2)
    L1.comp(f, IVORY, 0.9)
    L2 = Layer()
    for i, x in enumerate(slats):
        L2.poly_partial([q((x, 290)), q((x, 1380))], einout(ramp(T, 3.95 + i * 0.07, 4.55 + i * 0.07)), 1)
    L2.comp(f, IVORY, 0.45)
    # electrical points
    L3 = Layer()
    for i, p in enumerate([(78, 852), (80, 1197)]):
        k = eback(ramp(T, 4.45 + i * 0.12, 4.85 + i * 0.12))
        if k > 0.02: L3.circle(q(p), 16 * k, 2)
    L3.comp(f, IVORY, 0.9)
    a_lab = eout(ramp(T, 4.65, 5.05))
    p = q((112, 860)); draw_text(f, "PONTOS ELÉTRICOS", "Montserrat-Medium.ttf", 20, p[0], p[1], IVORY, a_lab * 0.85, spacing=3)
    # reinforcement line (gold)
    L4 = Layer().dashed(q((14, 1030)), q((690, 1030)), einout(ramp(T, 4.75, 5.45)), dash=18, gap=10, th=3)
    L5 = Layer()
    for i, x in enumerate([120, 290, 460, 630]):
        k = eback(ramp(T, 5.05 + i * 0.08, 5.40 + i * 0.08))
        if k > 0:
            c = q((x, 1030)); s = 9 * k
            L5.rect(c[0] - s, c[1] - s, c[0] + s, c[1] + s, fill=True)
    L4.comp(f, GOLD_SOFT, 0.95); L5.comp(f, GOLD_SOFT, 0.95)
    p = q((48, 1004)); draw_text(f, "REFORÇOS PREVISTOS", "Montserrat-SemiBold.ttf", 20, p[0], p[1], GOLD_SOFT, eout(ramp(T, 5.25, 5.65)), spacing=3)
    corner_marks(f, 70, 230, 1010, 1640, 30, IVORY, 0.55 * eout(ramp(T, 3.40, 3.80)))
    return f

# ---------------------------------------------------------------- S6/S7: drywall room + diagram (continuous D stream)
DX0, DX1, DTOP, DBOT = 150, 930, 480, 1100
STUDS = [165, 355, 540, 725, 915]
BAYS = [(STUDS[i] + 8, STUDS[i + 1] - 8) for i in range(4)]
PTS = [((a + b) / 2, 792) for a, b in BAYS]
REF_Y0, REF_Y1 = 774, 810
SLAB = (150, 716, 930, 754)
HEADERS = [  # (t0, t1, num, title, sub)
    (16.95, 20.42, "01", "ESTRUTURA EM DRYWALL", "perfis metálicos e placas de gesso"),
    (20.42, 24.92, "02", "REFORÇO PREVISTO NO PROJETO", "no ponto exato de cada móvel"),
    (24.92, 26.60, "03", "MÓVEL PLANEJADO", "fixação firme, sem improviso"),
]
def draw_header(f, T, fade):
    for (s, e, num, title, sub) in HEADERS:
        if T < s - 0.01 or T > e + 0.3: continue
        a = eout(ramp(T, s, s + 0.35)) * (1 - ramp(T, e - 0.05, e + 0.25)) * fade
        if a <= 0: continue
        dy = (1 - eout(ramp(T, s, s + 0.5))) * 12
        draw_text(f, num, "Marcellus-Regular.ttf", 72, 150, 372 + dy, GOLD_SOFT, a, shadow=0.3)
        ly = Layer().line((252, 300 + dy), (252, 384 + dy), 2); comp_mask_bbox(f, ly, IVORY, a * 0.45, (245, 290, 260, 400))
        draw_text(f, title, "Montserrat-SemiBold.ttf", 28, 276, 334 + dy, IVORY, a, spacing=4, shadow=0.3)
        draw_text(f, sub, "Montserrat-LightItalic.ttf", 27, 276, 374 + dy, IVORY, a * 0.72, shadow=0.3)

def draw_diagram(f, T, fade):
    if fade <= 0: return
    # grid + frame
    ga = eout(ramp(T, 16.85, 17.4)) * fade
    if ga > 0:
        gl = Layer()
        for x in range(110, 971, 40): gl.line((x, 440), (x, 1140), 1)
        for y in range(440, 1141, 40): gl.line((110, y), (970, y), 1)
        comp_mask_bbox(f, gl, IVORY, 0.045 * ga, (100, 430, 980, 1150))
        corner_marks(f, 110, 440, 970, 1140, 28, IVORY, 0.5 * ga)
    draw_header(f, T, fade)
    # tracks
    tp = einout(ramp(T, 17.00, 17.60))
    L = Layer()
    L.poly_partial([(DX0, DTOP), (DX1, DTOP)], tp); L.poly_partial([(DX0, DTOP + 14), (DX1, DTOP + 14)], tp)
    L.poly_partial([(DX0, DBOT), (DX1, DBOT)], tp); L.poly_partial([(DX0, DBOT - 14), (DX1, DBOT - 14)], tp)
    # studs (left part fully visible)
    boardk = einout(ramp(T, 18.25, 19.15))
    Lb = Layer()  # studs behind board (dimmer)
    for i, x in enumerate(STUDS):
        p = einout(ramp(T, 17.20 + i * 0.13, 17.95 + i * 0.13))
        tgt = Lb if x > 545 else L
        tgt.poly_partial([(x - 7, DTOP + 14), (x - 7, DBOT - 14)], p)
        tgt.poly_partial([(x + 7, DTOP + 14), (x + 7, DBOT - 14)], p)
    L.comp(f, IVORY, 0.88 * fade)
    Lb.comp(f, IVORY, (0.88 - 0.5 * boardk) * fade)
    # board (right half, translucent)
    if boardk > 0:
        bx0 = 548; bx1 = 548 + (DX1 - 548) * boardk
        fill = Layer().rect(bx0, DTOP + 15, bx1, DBOT - 15, fill=True)
        comp_mask_bbox(f, fill, IVORY, 0.10 * fade, (bx0, DTOP, DX1 + 2, DBOT))
        ol = Layer().rect(bx0, DTOP + 15, bx1, DBOT - 15, th=2)
        comp_mask_bbox(f, ol, IVORY, 0.75 * fade, (bx0 - 3, DTOP + 10, DX1 + 4, DBOT - 10))
        sm = Layer().dashed((725, DTOP + 20), (725, DBOT - 20), boardk, dash=10, gap=8, th=1)
        comp_mask_bbox(f, sm, IVORY, 0.5 * fade, (720, DTOP, 730, DBOT))
        # small labels
        la = eout(ramp(T, 18.9, 19.4)) * fade * (1 - 0.6 * ramp(T, 20.4, 20.8))
        draw_text(f, "PERFIL METÁLICO", "Montserrat-Medium.ttf", 19, 262, DBOT + 38, IVORY, la * 0.8, spacing=3, align="center", shadow=0.4)
        draw_text(f, "PLACA DE GESSO", "Montserrat-Medium.ttf", 19, 739, DBOT + 38, IVORY, la * 0.8, spacing=3, align="center", shadow=0.4)
        lk = Layer().line((262, DBOT + 8), (262, DBOT + 16), 2).line((739, DBOT + 8), (739, DBOT + 16), 2)
        comp_mask_bbox(f, lk, IVORY, la * 0.6, (250, DBOT, 750, DBOT + 20))
    # planned line
    pl = einout(ramp(T, 20.50, 21.40))
    if pl > 0:
        dl = Layer().dashed((120, 792), (960, 792), pl, dash=18, gap=10, th=2)
        dl.line((120, 780), (120, 804), 2)
        if pl >= 1: dl.line((960, 780), (960, 804), 2)
        comp_mask_bbox(f, dl, GOLD_SOFT, 0.95 * fade, (110, 770, 970, 810))
        draw_text(f, "altura definida no projeto", "Montserrat-LightItalic.ttf", 24, 960, 738, GOLD_SOFT, eout(ramp(T, 21.2, 21.7)) * fade * (1 - ramp(T, 24.2, 24.6)), align="right", shadow=0.4)
    # reinforcement blocks
    for i, (a, b) in enumerate(BAYS):
        k = einout(ramp(T, 23.03 + i * 0.16, 23.55 + i * 0.16))
        if k <= 0.02: continue
        rb = Layer().rect(a, REF_Y0, a + (b - a) * k, REF_Y1, fill=True)
        comp_mask_bbox(f, rb, GOLD, 0.82 * fade, (a, REF_Y0, b + 1, REF_Y1 + 1))
        ro = Layer().rect(a, REF_Y0, a + (b - a) * k, REF_Y1, th=2)
        comp_mask_bbox(f, ro, GOLD_SOFT, 0.9 * fade, (a - 2, REF_Y0 - 2, b + 3, REF_Y1 + 3))
    # fixing points
    for i, p in enumerate(PTS):
        t0 = 23.62 + i * 0.18
        k = eback(ramp(T, t0, t0 + 0.35))
        if k <= 0.02: continue
        dot = Layer().circle(p, 7 * k, fill=True)
        comp_mask_bbox(f, dot, IVORY, fade, (p[0] - 20, p[1] - 20, p[0] + 20, p[1] + 20))
        ring = Layer().circle(p, 13 * k, 2)
        comp_mask_bbox(f, ring, INK_RING, 0.9 * fade, (p[0] - 24, p[1] - 24, p[0] + 24, p[1] + 24))
        pk = ramp(T, t0 + 0.1, t0 + 0.9)
        if 0 < pk < 1:
            pr = Layer().circle(p, 14 + 30 * eout(pk), 2)
            comp_mask_bbox(f, pr, GOLD_SOFT, (1 - pk) * 0.9 * fade, (p[0] - 50, p[1] - 50, p[0] + 50, p[1] + 50))
    # slab (móvel)
    sk = einout(ramp(T, 24.95, 25.75))
    if sk > 0:
        x0, y0, x1, y1 = SLAB
        so = Layer().poly_partial([(x0, y1), (x0, y0), (x1, y0), (x1, y1), (x0, y1)], sk, 2)
        comp_mask_bbox(f, so, IVORY, 0.95 * fade, (x0 - 3, y0 - 3, x1 + 4, y1 + 4))
        fk = ramp(T, 25.35, 25.85)
        if fk > 0:
            sf = Layer().rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, fill=True)
            comp_mask_bbox(f, sf, np.array([150, 104, 66], np.float32) / 255, 0.55 * fk * fade, (x0, y0, x1, y1 + 1))
            br = Layer()
            for p in PTS: br.rect(p[0] - 11, y1, p[0] + 11, p[1] + 2, th=2)
            comp_mask_bbox(f, br, IVORY, 0.8 * fk * fade, (x0, y1 - 2, x1, REF_Y1 + 4))
        # dashed cabinet silhouette under slab (suspended drawer)
        ck = ramp(T, 25.45, 26.05)
        if ck > 0:
            cl = Layer()
            cl.dashed((560, 754), (560, 900), ck, 10, 8, 2).dashed((900, 754), (900, 900), ck, 10, 8, 2).dashed((560, 900), (900, 900), ck, 10, 8, 2)
            cl.dashed((560, 828), (900, 828), ck, 10, 8, 1)
            comp_mask_bbox(f, cl, IVORY, 0.6 * fade, (550, 745, 910, 910))
    # track labels
INK_RING = GOLD_SOFT

D_STILL_BG = None
def shot_drywall(T, rd):
    # D stream: 14.40-16.80 at 1x from 0.0 ; 16.80-26.35 slowed from 2.4
    src_t = (T - 14.40) if T < 16.80 else 2.4 + (T - 16.80) * 0.63
    img = rd.get(src_t)
    z = 1.02 + 0.03 * ramp(T, 14.40, 16.80) if T < 16.8 else 1.05 + 0.03 * ramp(T, 16.8, 26.35)
    img = zoom(img, z, 540, 900)
    f = grade(img, G(exposure=-0.02, temp=0.035))
    bk = einout(ramp(T, 16.30, 16.95))
    if bk > 0:
        f = blur_dark(f, bk, 0.70 * bk, 0.55 * bk)
        f[..., 0] *= 1 + 0.02 * bk; f[..., 2] *= 1 - 0.04 * bk
    if T >= 16.8: draw_diagram(f, T, 1.0)
    return f

# ---------------------------------------------------------------- S8: tracked markers on the real brackets
TRK = json.load(open(f"{S}/track.json"))
def trk(src_t):
    i = int(round((src_t - TRK["start"]) * 30)); i = max(0, min(len(TRK["b1"]) - 1, i))
    x, y, _ = TRK["b1"][i]; return x, y

def draw_markers(f, T, src_t):
    bx, by = trk(src_t)
    ox, oy = bx - 100, by - 693
    pts = [(100 + ox, 693 + oy), (400 + ox, 673 + oy), (548 + ox, 672 + oy)]
    a = 1.0
    dl = Layer().dashed((pts[0][0] - 90, pts[0][1] + 6), (1080, pts[0][1] - 70), einout(ramp(T, 26.15, 26.85)), 18, 10, 2)
    dl.comp(f, GOLD_SOFT, 0.85)
    for i, p in enumerate(pts):
        t0 = 26.30 + i * 0.14
        k = eback(ramp(T, t0, t0 + 0.35))
        if k <= 0.02: continue
        r = Layer().circle(p, 30 * k, 3)
        comp_mask_bbox(f, r, GOLD_SOFT, 0.95, (p[0] - 45, p[1] - 45, p[0] + 45, p[1] + 45))
        pk = ramp(T, t0 + 0.1, t0 + 1.0)
        if 0 < pk < 1:
            pr = Layer().circle(p, 30 + 34 * eout(pk), 2)
            comp_mask_bbox(f, pr, GOLD_SOFT, (1 - pk) * 0.8, (p[0] - 70, p[1] - 70, p[0] + 70, p[1] + 70))
    # label with leader from the held bracket
    la = eout(ramp(T, 26.65, 27.05)) * (1 - ramp(T, 27.45, 27.70))
    p = pts[2]; q1 = (p[0] + 22, p[1] - 22); q2 = (p[0] + 90, p[1] - 150); q3 = (q2[0] + 36, q2[1])
    ld = Layer().poly_partial([q1, q2, q3], einout(ramp(T, 26.55, 26.95)), 2)
    ld.comp(f, GOLD_SOFT, 0.9 * (1 - ramp(T, 27.45, 27.70)))
    draw_text(f, "PONTO DE REFORÇO", "Montserrat-SemiBold.ttf", 24, q3[0] + 12, q3[1] + 9, IVORY, la, spacing=4, shadow=0.6)

# ---------------------------------------------------------------- S13: end card
END_STILL = None; LOGO = None
def shot_endcard(T):
    global END_STILL, LOGO
    if END_STILL is None:
        END_STILL = still(f"{S}/stills/D_3.3.png")
        lg = Image.open(os.path.normpath(os.path.join(S, "..", "..", "site", "assets", "logo-ah.png"))).convert("RGBA")
        w = 250; lg = lg.resize((w, int(lg.height * w / lg.width)), Image.LANCZOS)
        LOGO = np.asarray(lg, np.float32) / 255
    z = 1.06 + 0.07 * ramp(T, 38.55, DUR)
    img = zoom(END_STILL, z, 540, 960)
    f = grade(img, G(exposure=-0.05, temp=0.04))
    f = blur_dark(f, 0.55, 0.70, 0.35)
    # logo
    k = eout(ramp(T, 38.95, 39.75))
    if k > 0:
        s = 0.94 + 0.06 * k
        lg = cv2.resize(LOGO, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
        h, w = lg.shape[:2]; x = int(540 - w / 2); y = int(770 - h / 2)
        a = lg[..., 3:4] * k
        reg = f[y:y + h, x:x + w]; reg *= (1 - a); reg += a * lg[..., :3]
    lk = einout(ramp(T, 39.45, 40.15))
    if lk > 0:
        ln = Layer().line((540 - 120 * lk, 905), (540 + 120 * lk, 905), 2)
        comp_mask_bbox(f, ln, GOLD, 0.95, (400, 895, 680, 915))
    a1 = eout(ramp(T, 39.60, 40.30)); dy = (1 - a1) * 16
    draw_text(f, "ALPHAHOME", "Marcellus-Regular.ttf", 74, 540, 1004 + dy, IVORY, a1, spacing=14, align="center", shadow=0.4)
    a2 = eout(ramp(T, 39.85, 40.50))
    draw_text(f, "AMBIENTES PLANEJADOS", "Montserrat-Medium.ttf", 24, 540, 1058, GOLD_SOFT, a2, spacing=9, align="center", shadow=0.4)
    a3 = eout(ramp(T, 40.30, 40.95)); dy3 = (1 - a3) * 18
    if a3 > 0:
        pw, ph = 440, 88; x0, y0 = 540 - pw / 2, 1200 + dy3
        pf = Layer(); cv2.rectangle(pf.m, (int(x0 + 44), int(y0)), (int(x0 + pw - 44), int(y0 + ph)), 255, -1)
        cv2.circle(pf.m, (int(x0 + 44), int(y0 + ph / 2)), 44, 255, -1, cv2.LINE_AA); cv2.circle(pf.m, (int(x0 + pw - 44), int(y0 + ph / 2)), 44, 255, -1, cv2.LINE_AA)
        comp_mask_bbox(f, pf, GOLD, 0.16 * a3, (x0 - 2, y0 - 2, x0 + pw + 2, y0 + ph + 2))
        po = Layer().rrect(int(x0), int(y0), int(x0 + pw), int(y0 + ph), 44, 2)
        comp_mask_bbox(f, po, GOLD_SOFT, 0.95 * a3, (x0 - 4, y0 - 4, x0 + pw + 4, y0 + ph + 4))
        draw_text(f, "CHAME NO DIRECT", "Montserrat-SemiBold.ttf", 30, 540, y0 + 55, IVORY, a3, spacing=6, align="center", shadow=0.3)
    a4 = eout(ramp(T, 40.75, 41.40))
    draw_text(f, "Alvenaria  ·  Contêiner  ·  Três Lagoas - MS", "Montserrat-Regular.ttf", 25, 540, 1372, IVORY, a4 * 0.72, align="center", shadow=0.3)
    corner_marks(f, 110, 560, 970, 1440, 30, IVORY, 0.35 * eout(ramp(T, 38.9, 39.6)))
    return f

# ---------------------------------------------------------------- grain
rng = np.random.default_rng(7)
GRAIN = []
for i in range(6):
    g = rng.normal(0, 1, (H // 2, W // 2)).astype(np.float32)
    g = cv2.resize(cv2.GaussianBlur(g, (0, 0), 0.7), (W, H), interpolation=cv2.INTER_LINEAR)
    GRAIN.append((g * 0.011)[..., None])

# ---------------------------------------------------------------- frame renderer
class Renderer:
    def __init__(self): self.readers = {}
    def reader(self, sh, T):
        n = sh["n"]
        if n not in self.readers:
            if sh.get("kind") == "drywall": self.readers[n] = Reader("D", 0.0, 12.5)
            else: self.readers[n] = Reader(sh["src"], sh["ss"], (sh["t1"] - sh["t0"]) * sh["rate"] + 0.3)
        return self.readers[n]
    def release(self, T):
        for sh in SHOTS:
            if sh["n"] in self.readers and T > sh["t1"] + 0.05:
                self.readers[sh["n"]].close(); del self.readers[sh["n"]]
    def shot_frame(self, sh, T):
        kind = sh.get("kind")
        if kind == "blueprint": return shot_blueprint(T)
        if kind == "endcard": return shot_endcard(T)
        if kind == "drywall": return shot_drywall(T, self.reader(sh, T))
        rd = self.reader(sh, T)
        src_t = sh["ss"] + (T - sh["t0"]) * sh["rate"]
        img = rd.get(src_t)
        zz = sh["z"][0] + (sh["z"][1] - sh["z"][0]) * einout(ramp(T, sh["t0"], sh["t1"]))
        cx, cy = sh.get("c", (W / 2, H / 2))
        f = grade(zoom(img, zz, cx, cy), sh["g"])
        if kind == "markers": draw_markers(f, T, src_t)
        return f
    def frame(self, T):
        out = None
        for sh in SHOTS:
            if not (sh["t0"] <= T < sh["t1"]): continue
            fr = self.shot_frame(sh, T)
            w = smooth(ramp(T, sh["t0"], sh["t0"] + sh["fi"])) if "fi" in sh and out is not None else 1.0
            out = fr if out is None or w >= 1 else out * (1 - w) + fr * w
        out = out * VIG
        out = out * (1 - GRAD)
        draw_tags(out, T)
        draw_captions(out, T)
        out += GRAIN[int(T * FPS) % len(GRAIN)]
        self.release(T)
        return np.clip(out * 255 + 0.5, 0, 255).astype(np.uint8)

if __name__ == "__main__":
    mode = sys.argv[1]
    if mode == "preview":
        ts = [float(x) for x in sys.argv[2].split(",")]
        os.makedirs(f"{S}/preview", exist_ok=True)
        for T in ts:
            r = Renderer(); img = r.frame(T)
            for rd in r.readers.values(): rd.close()
            Image.fromarray(img).save(f"{S}/preview/p_{T:06.2f}.jpg", quality=92)
            print("ok", T)
    elif mode == "render":
        t_from = float(sys.argv[2]); t_to = float(sys.argv[3]); outp = sys.argv[4]
        enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                                "-c:v", "libx264", "-preset", "slow", "-crf", "12", "-pix_fmt", "yuv420p", outp], stdin=subprocess.PIPE)
        r = Renderer()
        n0 = int(round(t_from * FPS)); n1 = int(round(t_to * FPS))
        import time; st = time.time()
        for n in range(n0, n1):
            T = n / FPS
            enc.stdin.write(r.frame(T).tobytes())
            if n % 30 == 0: print(f"{T:6.2f}s  {time.time() - st:6.1f}s elapsed", flush=True)
        enc.stdin.close(); enc.wait()
        for rd in r.readers.values(): rd.close()
        print("done", outp)
