"""Baixa e otimiza todos os assets usados pelo site (rode de novo para atualizar).

    python tools/baixar_assets.py

- three.js 0.170.0 e os addons usados (com dependências relativas)
- texturas CC0 do Poly Haven, convertidas para WebP em 512/1024 px
- HDRI CC0 do Poly Haven (iluminação e reflexos)
- fotos oficiais dos produtos e logo da HMH (hmhw.com)
"""
import io, json, os, re, sys, urllib.request
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
A = os.path.join(ROOT, 'assets')
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36'}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read()


def save(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(data)


# ---------- three.js ----------
CDN = 'https://cdn.jsdelivr.net/npm/three@0.170.0/'
ADDONS = ['geometries/RoundedBoxGeometry.js', 'environments/RoomEnvironment.js', 'utils/BufferGeometryUtils.js',
          'postprocessing/EffectComposer.js', 'postprocessing/RenderPass.js', 'postprocessing/UnrealBloomPass.js',
          'postprocessing/OutputPass.js', 'loaders/GLTFLoader.js', 'loaders/RGBELoader.js']


def three():
    save(os.path.join(A, 'vendor/three/build/three.module.js'), get(CDN + 'build/three.module.js'))
    todo, done = list(ADDONS), set()
    while todo:
        rel = os.path.normpath(todo.pop()).replace('\\', '/')
        if rel in done:
            continue
        done.add(rel)
        src = get(CDN + 'examples/jsm/' + rel).decode('utf-8')
        save(os.path.join(A, 'vendor/three/examples/jsm', rel), src.encode('utf-8'))
        for imp in re.findall(r"from\s+'(\.{1,2}/[^']+)'", src):
            todo.append(os.path.normpath(os.path.join(os.path.dirname(rel), imp)).replace('\\', '/'))
    print('three.js + addons:', len(done) + 1, 'arquivos')


# ---------- texturas ----------
PH = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/{0}/{0}_{1}_1k.jpg'
TEX = {  # id: [(mapa, tamanho)]
    'blue_metal_plate': [('nor_gl', 1024), ('rough', 512)],
    'metal_plate': [('diff', 512), ('nor_gl', 512), ('rough', 512)],
    'corrugated_iron': [('diff', 512), ('nor_gl', 512)],
    'damp_beach_sand': [('diff', 512), ('nor_gl', 512)],
    'granular_concrete': [('diff', 512)],
    'damp_sand': [('diff', 512)], 'excavated_soil_wall': [('diff', 512)], 'old_sandstone_02': [('diff', 512)],
    'dark_rock_02': [('diff', 512)], 'marble_cliff_03': [('diff', 512)], 'dark_rock': [('diff', 512)],
    'rock_06': [('diff', 512)], 'rock_face': [('diff', 512)],
}


def webp(data, path, size=None, q=82, alpha=False):
    im = Image.open(io.BytesIO(data))
    im = im.convert('RGBA' if alpha else 'RGB')
    if size and max(im.size) > size:
        im.thumbnail((size, size), Image.LANCZOS)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, 'WEBP', quality=q, method=6)


def textures():
    for tid, maps in TEX.items():
        for m, s in maps:
            webp(get(PH.format(tid, m)), os.path.join(A, 'texturas', f'{tid}_{m}.webp'), s, 90 if m == 'nor_gl' else 82)
    webp(get('https://threejs.org/examples/textures/waternormals.jpg'), os.path.join(A, 'texturas', 'waternormals.webp'), 1024, 90)
    # HDRI de céu aberto para iluminação e reflexos
    save(os.path.join(A, 'hdri', 'ceu.hdr'), get('https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kloofendal_48d_partly_cloudy_puresky_1k.hdr'))
    print('texturas e HDRI ok')


# ---------- HMH: logo e fotos ----------
LOGO = 'https://hmhw.com/wp-content/uploads/2022/08/Color-logo-white-background.jpg'
LOGO_BOX = (372, 314, 372 + 544, 314 + 172)
PHB = 'https://hmhw.com/wp-content/themes/yootheme/cache/'


def hmh():
    im = Image.open(io.BytesIO(get(LOGO))).convert('RGB').crop(LOGO_BOX)
    os.makedirs(os.path.join(A, 'img'), exist_ok=True)
    im.save(os.path.join(A, 'img', 'hmh-logo-placa.png'))  # com fundo branco (placa do derrick)
    # fundo branco vira transparente; pixels da arte ficam idênticos
    clear = im.convert('RGBA')
    px = clear.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            a = min(1.0, (255 - min(r, g, b)) / 150)
            if a >= 1:
                continue
            if a <= .03:
                px[x, y] = (0, 0, 0, 0)
                continue
            un = lambda c: max(0, min(255, round((c - (1 - a) * 255) / a)))
            px[x, y] = (un(r), un(g), un(b), round(a * 255))
    clear.save(os.path.join(A, 'img', 'hmh-logo.png'))
    # favicon: logo inteira, só com margem quadrada
    for s in (32, 180, 512):
        sq = Image.new('RGBA', (s, s), (255, 255, 255, 255))
        lg = clear.copy()
        lg.thumbnail((int(s * .9), int(s * .9)), Image.LANCZOS)
        sq.alpha_composite(lg, ((s - lg.width) // 2, (s - lg.height) // 2))
        sq.save(os.path.join(A, 'img', f'favicon-{s}.png'))
    cat = json.load(open(os.path.join(ROOT, 'content', 'conteudo.json'), encoding='utf-8'))
    names = sorted({n for it in cat['produtos'] + cat['esg'] for n in it.get('fotos', [])})
    for n in names:
        data = get(PHB + n)
        base = os.path.splitext(n)[0]
        webp(data, os.path.join(A, 'fotos', base + '.webp'), 1400, 84, alpha=n.endswith('.png'))
    print('logo, favicon e', len(names), 'fotos ok')


if __name__ == '__main__':
    steps = sys.argv[1:] or ['three', 'textures', 'hmh']
    for s in steps:
        globals()[s]()
