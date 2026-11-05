"""Carimba uma versão nos endereços dos arquivos do site (index.html).

Motivo: servidores simples deixam o navegador reaproveitar arquivos antigos. Depois de várias atualizações isso mistura
versões (ex.: um app.js novo com um kit.js velho) e a cena 3D não inicia. Com a versão no endereço, qualquer mudança
nos arquivos força o navegador a baixar de novo, em qualquer servidor (inclusive GitHub Pages).

  python tools/versionar.py        # rode sempre depois de editar JS, CSS ou content/conteudo.json
A versão é um resumo (hash) do conteúdo, então só muda quando algum arquivo muda.
"""
import hashlib, pathlib, re

RAIZ = pathlib.Path(__file__).resolve().parent.parent
MODULOS = ['kit', 'modelos', 'detalhe', 'detalhes3d', 'ssao']

h = hashlib.sha1()
for f in sorted((RAIZ / 'assets' / 'js').glob('*.js')) + [RAIZ / 'assets' / 'css' / 'site.css', RAIZ / 'content' / 'conteudo.json']:
    h.update(f.read_bytes())
v = h.hexdigest()[:8]

arq = RAIZ / 'index.html'
s = arq.read_text(encoding='utf-8')

# 1) importmap: three + cada módulo local com a versão (o mapa vale para qualquer import que resolva para aquele arquivo)
im = {'three': './assets/vendor/three/build/three.module.min.js', 'three/addons/': './assets/vendor/three/examples/jsm/'}
for m in MODULOS:
    im[f'./assets/js/{m}.js'] = f'./assets/js/{m}.js?v={v}'
import json
mapa = '{"imports":' + json.dumps(im, indent=0, separators=(',', ':')) + '}'
s = re.sub(r'(<script type="importmap">\s*).*?(\s*</script>)', lambda m: m.group(1) + mapa + m.group(2), s, count=1, flags=re.S)

# 2) entrada, preloads e CSS
s = re.sub(r'assets/js/app\.js(\?v=\w+)?"', f'assets/js/app.js?v={v}"', s)
s = re.sub(r'assets/css/site\.css(\?v=\w+)?"', f'assets/css/site.css?v={v}"', s)
s = re.sub(r'content/conteudo\.json(\?v=\w+)?" as="fetch"', f'content/conteudo.json?v={v}" as="fetch"', s)

# 3) versão disponível para o JavaScript (fetch do JSON)
if 'window.__v=' in s:
    s = re.sub(r"window\.__v='\w*'", f"window.__v='{v}'", s)
else:
    s = s.replace('<script>\n// se o módulo 3D', f"<script>\nwindow.__v='{v}';\n// se o módulo 3D", 1)

arq.write_text(s, encoding='utf-8')
print('versão', v)
