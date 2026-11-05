"""Junta o catálogo completo (tools/dados_catalogo.py) ao content/conteudo.json e baixa as fotos.

  python tools/montar_catalogo.py            # mescla itens novos, baixa fotos, gera miniaturas
  python tools/montar_catalogo.py --so-miniaturas

Seguro para rodar de novo: itens que já existem não são duplicados e fotos já baixadas são puladas.
Fotos: cada uma vira assets/fotos/<nome>.webp (até 1000 px) e assets/fotos/t/<nome>.webp (360 px, para o catálogo).
"""
import json, pathlib, re, sys, urllib.request, io
from PIL import Image

RAIZ = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / 'tools'))
import dados_catalogo as D

BASE = 'https://hmhw.com/'
UA = {'User-Agent': 'HMH-aguas-profundas-site/1.0 (catalog images for the HMH demo site)'}
FOTOS = RAIZ / 'assets' / 'fotos'
THUMBS = FOTOS / 't'
THUMBS.mkdir(parents=True, exist_ok=True)


def base(nome):
    return re.sub(r'\.\w+$', '', nome)


def baixar(path):
    nome = path.rsplit('/', 1)[1]
    destino = FOTOS / (base(nome) + '.webp')
    if destino.exists():
        return nome, True
    try:
        with urllib.request.urlopen(urllib.request.Request(BASE + path, headers=UA), timeout=60) as r:
            dados = r.read()
        im = Image.open(io.BytesIO(dados))
        im.load()
        if im.mode not in ('RGB', 'RGBA'):
            im = im.convert('RGBA' if 'transparency' in im.info or im.mode == 'P' else 'RGB')
        im.thumbnail((1000, 1000), Image.LANCZOS)
        im.save(destino, 'WEBP', quality=82, method=6)
        return nome, True
    except Exception as e:
        print('  ! falhou', path, e)
        return nome, False


def miniatura(arquivo):
    t = THUMBS / arquivo.name
    if t.exists():
        return
    im = Image.open(arquivo)
    im.load()
    im.thumbnail((360, 360), Image.LANCZOS)
    im.save(t, 'WEBP', quality=76, method=6)


def main():
    caminho = RAIZ / 'content' / 'conteudo.json'
    c = json.loads(caminho.read_text(encoding='utf-8'))
    if '--so-miniaturas' not in sys.argv:
        tem = {p['id'] for p in c['produtos']}
        novos = 0
        for (id_, area, cat, nome, en, pt, imgs, yt) in D.ITENS:
            if id_ in tem:
                continue
            fotos = []
            for path in imgs:
                nome_arq, ok = baixar(path)
                if ok:
                    fotos.append(nome_arq)
            cpt, cen = D.CATEGORIAS[cat]
            item = {'id': id_, 's': -1, 'a': area, 'u': D.URL_ESPECIAL.get(id_, f'/service/{id_}/')}
            if fotos:
                item['fotos'] = fotos
            if yt:
                item['yt'] = yt
            item['pt'] = {'n': nome, 'c': cpt, 'd': pt}
            item['en'] = {'n': nome, 'c': cen, 'd': en}
            c['produtos'].append(item)
            novos += 1
        # itens que já existiam: área padrão (digitalização e serviços vivem em business_area/)
        for p in c['produtos']:
            if 'a' not in p:
                p['a'] = 'srv' if '/business_area/' in p.get('u', '') else 'off'
        ui = {'pt': {'area': 'Área', 'areaTodas': 'Todas', 'areaOff': 'Offshore', 'areaOn': 'Terra (onshore)', 'areaSrv': 'Serviços e digital',
                     'areaMc': 'Mineração e construção', 'linhaCompleta': 'Catálogo completo', 'resumo': 'Resumo', 'semFotoNota': 'Sem foto disponível no site da HMH.',
                     'catContagem': 'itens', 'catEstatico': 'Catálogo completo da HMH'},
              'en': {'area': 'Area', 'areaTodas': 'All', 'areaOff': 'Offshore', 'areaOn': 'Onshore', 'areaSrv': 'Services and digital',
                     'areaMc': 'Mining and construction', 'linhaCompleta': 'Full catalog', 'resumo': 'Summary', 'semFotoNota': 'No photo available on the HMH site.',
                     'catContagem': 'items', 'catEstatico': 'Complete HMH catalog'}}
        for lang in ('pt', 'en'):
            c['ui'][lang].update(ui[lang])
        caminho.write_text(json.dumps(c, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        print(f'{novos} itens novos; catálogo agora com {len(c["produtos"])} itens')
    n = 0
    for f in sorted(FOTOS.glob('*.webp')):
        miniatura(f)
        n += 1
    tot = sum(f.stat().st_size for f in FOTOS.glob('*.webp')) / 1024
    tt = sum(f.stat().st_size for f in THUMBS.glob('*.webp')) / 1024
    print(f'{n} fotos; completas {tot:.0f} KB, miniaturas {tt:.0f} KB')


main()
