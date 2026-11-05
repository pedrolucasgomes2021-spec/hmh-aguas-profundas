"""Camada de detalhe dos equipamentos: texturas PBR reais da ambientCG (CC0, https://ambientcg.com).

Cada conjunto vira UMA imagem WebP de 1024 px com 3 canais (o shader do site lê as três projeções em 3D):
  R, G = relevo da superfície (NormalGL, componentes x e y; o z é reconstruído)
  B    = máscara de desgaste (0 = intacto, 1 = metal à mostra)

  paint  PaintedMetal004  máscara = Metalness (onde a tinta saiu, o metal aparece)
  steel  Metal062C        máscara = contraste da rugosidade (manchas de uso e oxidação leve)

  python tools/baixar_detalhes_ambientcg.py [--forcar]
Para trocar de conjunto, mude SETS e rode de novo.
"""
import io, pathlib, sys, urllib.request, zipfile
import numpy as np
from PIL import Image

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SAIDA = RAIZ / 'assets' / 'texturas'
UA = {'User-Agent': 'HMH-aguas-profundas-site/1.0 (CC0 texture fetch from ambientCG)'}
SETS = {'paint': ('PaintedMetal004', 'metalness'), 'steel': ('Metal062C', 'rough')}
FORCAR = '--forcar' in sys.argv


def zip_do_conjunto(nome):
    url = f'https://ambientcg.com/get?file={nome}_1K-JPG.zip'
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r:
        return zipfile.ZipFile(io.BytesIO(r.read()))


def mapa(z, nome, sufixo, modo='L'):
    alvo = [n for n in z.namelist() if n.endswith(f'_{sufixo}.jpg')]
    if not alvo:
        return None
    return Image.open(io.BytesIO(z.read(alvo[0]))).convert(modo)


for chave, (nome, fonte_mascara) in SETS.items():
    destino = SAIDA / f'det_{chave}.webp'
    if destino.exists() and not FORCAR:
        print(f'{chave}: já existe ({destino.stat().st_size // 1024} KB)')
        continue
    z = zip_do_conjunto(nome)
    nor = mapa(z, nome, 'NormalGL', 'RGB')
    if nor is None:
        sys.exit(f'{nome}: sem NormalGL; arquivos: {z.namelist()[:12]}')
    if fonte_mascara == 'metalness':
        m = mapa(z, nome, 'Metalness')
        masc = np.asarray(m, np.float32) / 255.0 if m is not None else np.zeros(nor.size[::-1], np.float32)
    else:
        r = np.asarray(mapa(z, nome, 'Roughness'), np.float32) / 255.0
        masc = np.clip((r - r.mean()) / (3.0 * r.std() + 1e-6) + 0.35, 0, 1)
    a = np.asarray(nor, np.uint8).copy()
    a[..., 2] = np.clip(masc * 255.0, 0, 255).astype(np.uint8)
    im = Image.fromarray(a, 'RGB')
    if max(im.size) > 1024:
        im = im.resize((1024, 1024), Image.LANCZOS)
    im.save(destino, 'WEBP', quality=90, method=6)
    print(f'{chave}: {nome} -> {destino.name} {destino.stat().st_size // 1024} KB | máscara média {masc.mean():.2f}')
