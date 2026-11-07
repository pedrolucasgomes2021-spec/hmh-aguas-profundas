"""Baixa as texturas da versão Mineração (Poly Haven, licença CC0) e converte para WebP em assets/texturas/mina/.

  python tools/baixar_texturas_mina.py

Seguro rodar de novo: pula o que já existe. Terreno: difusa em 1k (base) e 2k (pacote HD, carregado só no Alta/Ultra).
Equipamentos: difusa + normal (e rugosidade quando existe) em 1k.
"""
import io, json, pathlib, sys, urllib.request

RAIZ = pathlib.Path(__file__).resolve().parent.parent
DEST = RAIZ / 'assets' / 'texturas' / 'mina'
DEST.mkdir(parents=True, exist_ok=True)
UA = {'User-Agent': 'hmh-aguas-profundas-site'}

# id Poly Haven -> (mapas, resoluções)
TERRENO = {'red_dirt_mud_01': 'soil', 'cliff_side': 'rock', 'aerial_grass_rock': 'ground', 'gravel_floor_02': 'gravel'}
EQUIP = {'rusty_metal_03': ['Diffuse', 'nor_gl'], 'metal_plate_02': ['Diffuse', 'nor_gl', 'Rough'], 'rubberized_track': ['Diffuse', 'nor_gl'],
         'corrugated_iron_02': ['Diffuse', 'nor_gl'], 'concrete_floor_02': ['Diffuse', 'nor_gl', 'Rough']}
NOME = {'Diffuse': 'diff', 'nor_gl': 'nor', 'Rough': 'rough'}

try:
    from PIL import Image
except ImportError:
    Image = None
    print('Pillow não instalado: salvando .jpg sem converter (pip install pillow para gerar WebP)')

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()

def baixar(aid, mapa, res, saida, tam):
    ext = 'webp' if Image else 'jpg'
    alvo = DEST / f'{saida}.{ext}'
    if alvo.exists():
        return
    arqs = json.loads(get(f'https://api.polyhaven.com/files/{aid}'))
    try:
        info = arqs[mapa][res]
    except KeyError:
        print('  sem', aid, mapa, res); return
    fmt = 'jpg' if 'jpg' in info else 'png'
    dados = get(info[fmt]['url'])
    if Image:
        im = Image.open(io.BytesIO(dados)).convert('RGB')
        if im.width > tam:
            im = im.resize((tam, tam), Image.LANCZOS)
        im.save(alvo, 'WEBP', quality=84, method=6)
    else:
        alvo.write_bytes(dados)
    print('  ok', alvo.name, round(alvo.stat().st_size / 1024), 'KB')

for aid, nome in TERRENO.items():
    print(aid)
    baixar(aid, 'Diffuse', '1k', f'{nome}_diff', 1024)
    baixar(aid, 'Diffuse', '2k', f'{nome}_diff_2k', 2048)
for aid, mapas in EQUIP.items():
    print(aid)
    for m in mapas:
        baixar(aid, m, '1k', f'{aid}_{NOME[m]}', 1024)
print('pronto')
