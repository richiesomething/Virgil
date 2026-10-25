"""Authors the plan-frame drawings (data-src/<book>/atlas/art-<frame>.json).

Each drawing is a list of features in the frame's x/y space (y down):
  {"k": kind, "poly": [[x,y],...]} filled shape   {"k": kind, "line": [[x,y],...]} stroke
  optional "curve": true (smooth), "w": stroke width, "r": circle radius with "at"
Kinds map to theme colours in the app (water, sand, grass, forest, rock, building, wall, road, path, rail, floor, pitch, mangrove, garden, deep).
Drawn from each book's own descriptions. Run: python3 scripts/atlas/draw-plans.py
"""
import json, math, os, random

ROOT = os.path.join(os.path.dirname(__file__), '..', '..', 'data-src')

def rect(x0, y0, x1, y1):
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]

def blob(cx, cy, rx, ry, n=14, jitter=0.12, seed=1):
    rnd = random.Random(seed)
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        k = 1 + rnd.uniform(-jitter, jitter)
        pts.append([round(cx + rx * k * math.cos(a)), round(cy + ry * k * math.sin(a))])
    return pts

def trees(x0, y0, x1, y1, count, seed=3, r=(9, 15)):
    rnd = random.Random(seed)
    return [{"k": "tree", "at": [rnd.randint(x0, x1), rnd.randint(y0, y1)], "r": rnd.randint(*r)} for _ in range(count)]

def write(book, frame, art):
    path = os.path.join(ROOT, book, 'atlas', f'art-{frame}.json')
    with open(path, 'w') as f:
        json.dump(art, f, separators=(',', ':'))
    print('wrote', path)

# ---------------- Harry Potter: Hogwarts & its grounds (1000 x 760) ----------------
forest = [[840, 0], [1000, 0], [1000, 760], [880, 760], [845, 680], [870, 600], [830, 520], [855, 430], [820, 360], [850, 270], [825, 170], [850, 80]]
lake = [[230, 430], [330, 385], [470, 395], [560, 380], [690, 405], [790, 470], [800, 570], [730, 655], [590, 700], [420, 690], [300, 650], [215, 560]]
features = [
    {"k": "rock", "poly": [[0, 0], [840, 0], [820, 60], [700, 85], [560, 70], [430, 95], [300, 70], [150, 90], [0, 70]], "curve": True},
    {"k": "forest", "poly": forest, "curve": True},
    *trees(860, 20, 990, 740, 70, seed=11),
    {"k": "water", "poly": lake, "curve": True},
    # the cliff and the castle on it
    {"k": "rock", "poly": [[370, 300], [400, 330], [470, 345], [540, 345], [610, 330], [640, 300], [620, 280], [380, 280]], "curve": True},
    {"k": "building", "poly": rect(410, 180, 600, 300)},
    {"k": "building", "poly": rect(380, 150, 425, 300)},
    {"k": "building", "poly": rect(585, 120, 630, 300)},
    {"k": "building", "poly": rect(480, 140, 530, 185)},
    {"k": "building", "at": [402, 140], "r": 22},
    {"k": "building", "at": [607, 112], "r": 24},
    {"k": "building", "at": [505, 132], "r": 16},
    # paths
    {"k": "path", "line": [[470, 300], [470, 330], [440, 360], [360, 360]], "curve": True},
    {"k": "path", "line": [[530, 300], [600, 315], [700, 318], [800, 330]], "curve": True},
    {"k": "path", "line": [[410, 300], [330, 290], [270, 260]], "curve": True},
    # greenhouses
    {"k": "glass", "poly": rect(652, 286, 672, 312)},
    {"k": "glass", "poly": rect(678, 286, 698, 312)},
    {"k": "glass", "poly": rect(704, 286, 724, 312)},
    # Hagrid's hut and its pumpkin patch
    {"k": "garden", "poly": blob(780, 360, 26, 14, seed=4), "curve": True},
    {"k": "building", "at": [800, 330], "r": 11},
    # Quidditch pitch
    {"k": "pitch", "poly": blob(210, 250, 85, 48, n=24, jitter=0), "curve": True},
    {"k": "pitch-line", "line": [[140, 250], [280, 250]]},
    # railway, station and the walk to the boats
    {"k": "rail", "line": [[0, 700], [120, 692], [175, 690], [230, 700], [330, 760]], "curve": True},
    {"k": "building", "poly": rect(150, 668, 195, 684)},
    {"k": "path", "line": [[180, 684], [230, 655], [290, 628]], "curve": True},
    {"k": "building", "poly": rect(60, 610, 80, 626)}, {"k": "building", "poly": rect(90, 622, 110, 638)}, {"k": "building", "poly": rect(70, 646, 92, 660)},
]
write('harry-potter-1', 'hogwarts', {"bg": "grass", "features": features, "labels": [
    {"text": "mountains", "at": [250, 40], "kind": "area"},
    {"text": "railway", "at": [60, 712], "kind": "minor"},
]})

# ---------------- Harry Potter: inside the castle, cut-away by floor (1000 x 840) ----------------
bands = [
    ("Tower tops", 30, 150), ("Upper floors", 160, 320), ("Third floor", 330, 400), ("Second floor", 410, 470),
    ("First floor", 480, 540), ("Ground floor", 550, 620), ("Dungeons", 630, 700), ("Deep below", 715, 830),
]
features = [{"k": "deep", "poly": rect(0, 708, 1000, 840)}]
for i, (name, y0, y1) in enumerate(bands[1:7]):
    features.append({"k": "floor", "poly": rect(120, y0, 980, y1)})
# towers
features += [
    {"k": "floor", "poly": rect(175, 40, 290, 160)}, {"k": "roof", "poly": [[165, 42], [232, -8], [300, 42]]},
    {"k": "floor", "poly": rect(760, 20, 840, 160)}, {"k": "roof", "poly": [[750, 22], [800, -30], [850, 22]]},
    {"k": "floor", "poly": rect(470, 90, 540, 160)}, {"k": "roof", "poly": [[462, 92], [505, 50], [548, 92]]},
    # the moving staircases
    {"k": "stair", "line": [[455, 620], [495, 550], [455, 480], [495, 410], [455, 330], [495, 250], [455, 160]]},
    # the trapdoor and the way down
    {"k": "shaft", "line": [[640, 400], [640, 600], [640, 720], [600, 740]]},
    {"k": "passage", "line": [[600, 752], [870, 752], [870, 805], [760, 805]]},
]
for x, y in [(600, 752), (690, 752), (780, 752), (870, 752), (870, 805), (760, 805)]:
    features.append({"k": "chamber", "poly": rect(x - 32, y - 18, x + 32, y + 18)})
labels = [{"text": name, "at": [12, (y0 + y1) / 2], "kind": "floor"} for name, y0, y1 in bands]
labels.append({"text": "moving staircases", "at": [475, 640], "kind": "minor"})
write('harry-potter-1', 'castle', {"bg": "sky", "features": features, "labels": labels})

# ---------------- Harry Potter: the Leaky Cauldron & Diagon Alley (1000 x 520) ----------------
alley = [[300, 230], [520, 222], [700, 214], [860, 218], [860, 302], [700, 306], [520, 298], [300, 290]]
features = [
    {"k": "road", "poly": rect(0, 0, 80, 520)},
    {"k": "building", "poly": rect(80, 200, 200, 320)},
    {"k": "yard", "poly": rect(200, 225, 262, 295)},
    {"k": "wall", "line": [[262, 225], [262, 295]], "w": 6},
    {"k": "cobbles", "poly": alley},
]
for x0 in (320, 440, 560, 680):
    features.append({"k": "shop", "poly": [[x0, 130], [x0 + 105, 125], [x0 + 105, 214], [x0, 222]]})
    features.append({"k": "shop", "poly": [[x0, 298], [x0 + 105, 304], [x0 + 105, 395], [x0, 390]]})
features += [
    {"k": "marble", "poly": [[860, 150], [990, 150], [990, 340], [860, 340]]},
    {"k": "marble", "poly": [[870, 216], [860, 216], [860, 284], [870, 284]]},
]
write('harry-potter-1', 'diagon-alley', {"bg": "brick", "features": features, "labels": [
    {"text": "Charing Cross Road", "at": [40, 420], "kind": "street", "rot": -90},
    {"text": "the brick archway", "at": [262, 320], "kind": "minor"},
    {"text": "shops", "at": [600, 110], "kind": "minor"},
]})

# ---------------- The Pearl: the town & the beach (1000 x 700) ----------------
features = [
    {"k": "sand", "poly": [[0, 500], [1000, 480], [1000, 700], [0, 700]]},
    {"k": "water", "poly": [[0, 575], [180, 565], [420, 580], [640, 570], [760, 560], [830, 520], [900, 470], [1000, 450], [1000, 700], [0, 700]], "curve": True},
    {"k": "mangrove", "poly": [[770, 420], [880, 390], [1000, 380], [1000, 450], [900, 470], [830, 520], [770, 540], [740, 480]], "curve": True},
    *[{"k": "tree", "at": [x, y], "r": 8} for x, y in [(790, 450), (820, 430), (850, 415), (880, 440), (910, 410), (940, 425), (970, 400), (800, 495), (840, 470), (960, 440)]],
    # the stone-and-plaster town on the slope
    {"k": "town", "poly": [[120, 60], [880, 60], [900, 380], [120, 390]], "curve": False},
    {"k": "road", "line": [[520, 0], [520, 400]], "w": 14},
    {"k": "road", "line": [[150, 300], [880, 300]], "w": 10},
    {"k": "road", "line": [[200, 140], [860, 150]], "w": 8},
    {"k": "plaza", "poly": rect(460, 140, 580, 205)},
    {"k": "church", "poly": rect(495, 150, 545, 192)},
    {"k": "wall", "poly": rect(640, 215, 750, 285), "w": 3},
    {"k": "building", "poly": rect(665, 228, 730, 272)},
    {"k": "path", "line": [[520, 395], [480, 430], [400, 470], [320, 520], [300, 545]], "curve": True},
]
rnd = random.Random(7)
for x in range(110, 720, 46):
    y = 440 + rnd.randint(-14, 30)
    features.append({"k": "hut", "poly": rect(x, y, x + 26, y + 20)})
for x, y in [(180, 100), (300, 110), (640, 100), (760, 110), (200, 220), (320, 230), (700, 180), (800, 220), (220, 340), (650, 340), (780, 340), (340, 350)]:
    features.append({"k": "building", "poly": rect(x, y, x + 60, y + 34)})
write('the-pearl', 'town', {"bg": "dry", "features": features, "labels": [
    {"text": "the brush houses", "at": [260, 420], "kind": "area"},
    {"text": "the stone town", "at": [300, 75], "kind": "area"},
    {"text": "road north", "at": [560, 25], "kind": "minor"},
]})

# ---------------- Monte Cristo: the island (1000 x 700) ----------------
island = [[170, 520], [200, 400], [280, 300], [380, 220], [480, 150], [580, 160], [680, 210], [780, 280], [870, 360], [880, 450], [800, 530], [680, 590], [540, 620], [400, 610], [290, 580]]
features = [
    {"k": "rock", "poly": island, "curve": True},
    {"k": "scrub", "poly": blob(520, 300, 200, 110, seed=9), "curve": True},
    {"k": "peak", "poly": blob(520, 250, 70, 45, seed=2), "curve": True},
    {"k": "water", "poly": [[205, 505], [262, 505], [300, 545], [262, 590], [210, 585]], "curve": True},
    {"k": "path", "line": [[255, 535], [320, 480], [400, 450], [480, 420], [560, 395], [600, 380]], "curve": True},
    {"k": "boulder", "at": [600, 378], "r": 16},
    *[{"k": "boulder", "at": [x, y], "r": r} for x, y, r in [(330, 420, 7), (710, 330, 9), (760, 470, 8), (450, 560, 6), (640, 520, 7)]],
]
write('monte-cristo', 'monte-cristo', {"bg": "sea", "features": features, "labels": [
    {"text": "Tyrrhenian Sea", "at": [820, 640], "kind": "sea"},
]})
