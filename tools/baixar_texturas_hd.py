"""Texturas PBR reais (Poly Haven, CC0) em duas camadas:

  base  assets/texturas/<id>_<mapa>.webp       1024 px — carregadas na abertura (leves)
  hd    assets/texturas/hd/<id>_<mapa>.webp    2048 px (rochas: 1536 + normais 1024) — carregadas em segundo plano
                                                depois que o visitante entra, só em GPU/rede capazes

  python tools/baixar_texturas_hd.py          # baixa o que falta
  python tools/baixar_texturas_hd.py --forcar # baixa tudo de novo
"""
import io, pathlib, sys, urllib.request
from PIL import Image

RAIZ = pathlib.Path(__file__).resolve().parent.parent
TEX = RAIZ / 'assets' / 'texturas'
HD = TEX / 'hd'
HD.mkdir(parents=True, exist_ok=True)
PH = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/{r}/{0}/{0}_{1}_{r}.jpg'
UA = {'User-Agent': 'HMH-aguas-profundas-site/1.0 (texture fetch from Poly Haven, CC0)'}
FORCAR = '--forcar' in sys.argv

# (id, mapa, tamanho base ou None, tamanho HD ou None)
LISTA = [
    ('damp_beach_sand', 'diff', 1024, 1536), ('damp_beach_sand', 'nor_gl', 1024, 1024), ('damp_beach_sand', 'rough', 1024, None),
    ('metal_plate', 'diff', 1024, 2048), ('metal_plate', 'nor_gl', 1024, 1024), ('metal_plate', 'rough', 1024, None),
    ('corrugated_iron', 'diff', 1024, 2048), ('corrugated_iron', 'nor_gl', 1024, None),
    ('blue_metal_plate', 'nor_gl', None, 2048), ('blue_metal_plate', 'rough', None, 2048),
] + [(r, 'diff', None, 1536) for r in ('damp_sand', 'excavated_soil_wall', 'old_sandstone_02', 'dark_rock_02', 'marble_cliff_03', 'dark_rock', 'rock_06', 'rock_face')]   + [(r, 'nor_gl', None, 768) for r in ('damp_sand', 'excavated_soil_wall', 'old_sandstone_02', 'dark_rock_02', 'marble_cliff_03', 'dark_rock', 'rock_06', 'rock_face')]


def baixar(tid, mapa, tam, destino):
    if destino.exists() and not FORCAR:
        return destino.stat().st_size
    res = '2k' if tam > 1024 or mapa == 'nor_gl' else '1k'
    url = PH.format(tid, mapa, r=res)
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
        im = Image.open(io.BytesIO(r.read()))
        im.load()
    im = im.convert('RGB')
    if max(im.size) > tam:
        im.thumbnail((tam, tam), Image.LANCZOS)
    im.save(destino, 'WEBP', quality=88 if mapa == 'nor_gl' else 80, method=6)
    return destino.stat().st_size


tot_b = tot_h = 0
for tid, mapa, tb, th in LISTA:
    for tam, pasta, nome in ((tb, TEX, 'base'), (th, HD, 'hd')):
        if not tam:
            continue
        try:
            n = baixar(tid, mapa, tam, pasta / f'{tid}_{mapa}.webp')
        except Exception as e:
            print(f'  ! {nome} {tid}_{mapa}: {e}')
            continue
        if nome == 'base':
            tot_b += n
        else:
            tot_h += n
        print(f'{nome:4} {tid}_{mapa:7} {tam:5}px {n // 1024:5} KB')
print(f'\nbase (novas, 1024 px): {tot_b // 1024} KB | pacote HD: {tot_h // 1024} KB')
