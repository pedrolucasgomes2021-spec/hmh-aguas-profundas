"""Preenche o index.html com o conteúdo estático (SEO e fallback sem WebGL).

Lê content/conteudo.json e escreve, entre <!--CONTEUDO--> e <!--/CONTEUDO-->,
as 6 seções .snap (s0..s5) com título, texto, equipamentos e pontos ESG em português.
Rode de novo sempre que editar o JSON:  python tools/gerar_html.py
"""
import html, json, pathlib, re

RAIZ = pathlib.Path(__file__).resolve().parent.parent
BASE = 'https://hmhw.com'
c = json.loads((RAIZ / 'content/conteudo.json').read_text(encoding='utf-8'))
e = html.escape


def foto(n):
    return 'assets/fotos/' + re.sub(r'\.\w+$', '', n) + '.webp'


partes = []
for i, s in enumerate(c['secoes']):
    t = s['pt']
    itens = []
    for p in c['produtos']:
        if p['s'] != i:
            continue
        pt = p['pt']
        img = f'<img loading="lazy" alt="{e(pt["n"])}" src="{foto(p["fotos"][0])}" width="160" height="120">' if p.get('fotos') else ''
        link = f' <a href="{BASE + p["u"]}" target="_blank" rel="noopener">hmhw.com ↗</a>' if p.get('u') and not p.get('ctx') else ''
        itens.append(f'<li>{img}<div><h3>{e(pt["n"])}</h3><small>{e(pt["c"])}</small><p>{e(pt["d"])}{link}</p></div></li>')
    esg = []
    for x in c['esg']:
        if x['s'] != i:
            continue
        xt = x['pt']
        esg.append(f'<li><h3>{e(xt["n"])} <b>{e(xt["st"])} {e(xt["sl"])}</b></h3><p>{e(xt["d"])} <a href="{BASE + x["u"]}" target="_blank" rel="noopener">Fonte ↗</a></p></li>')
    bloco = [f'<section class="snap" id="s{i}" aria-labelledby="h{i}"><div class="estatico">',
             f'<p class="eb">{i + 1:02d} · {e(t["eb"])} · {e(t["prof"])}</p>',
             f'<h2 id="h{i}">{e(t["t"])}</h2>', f'<p>{e(t["p"])}</p>']
    if itens:
        bloco.append('<ul class="prods">' + ''.join(itens) + '</ul>')
    if esg:
        bloco.append('<h3 class="esgT">ESG Point</h3><ul class="esgs">' + ''.join(esg) + '</ul>')
    bloco.append(f'<p><a href="{BASE + s["u"]}" target="_blank" rel="noopener">Saiba mais em hmhw.com ↗</a></p></div></section>')
    partes.append('\n'.join(bloco))

# pontos ESG sem seção (gerais) vão para a última seção
gerais = [x for x in c['esg'] if x['s'] < 0]
if gerais:
    li = ''.join(f'<li><h3>{e(x["pt"]["n"])} <b>{e(x["pt"]["st"])} {e(x["pt"]["sl"])}</b></h3><p>{e(x["pt"]["d"])} <a href="{BASE + x["u"]}" target="_blank" rel="noopener">Fonte ↗</a></p></li>' for x in gerais)
    partes[-1] = partes[-1].replace('</div></section>', f'<h3 class="esgT">ESG Point · HMH</h3><ul class="esgs">{li}</ul></div></section>')

arq = RAIZ / 'index.html'
src = arq.read_text(encoding='utf-8')
novo = re.sub(r'<!--CONTEUDO-->.*?<!--/CONTEUDO-->', lambda m: '<!--CONTEUDO-->\n' + '\n'.join(partes) + '\n<!--/CONTEUDO-->', src, flags=re.S)
arq.write_text(novo, encoding='utf-8')
print(f'{len(partes)} seções, {sum(1 for p in c["produtos"])} itens, {len(c["esg"])} pontos ESG')
