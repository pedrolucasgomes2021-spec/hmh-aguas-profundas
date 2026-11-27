"""Gera as texturas PBR do casco e do convés (procedurais, tileáveis, 2048 px).

Uso:  python fontes/blender/gerar_texturas.py
Saída: fontes/blender/texturas/{casco,conves}_{cor,normal,orm}.jpg

Casco: um quadro de 16,6 m x 16,6 m. Na vertical (v) cobre do fundo da quilha (y=-7) ao topo da borda (y=9,6),
com as faixas de pintura nas alturas certas; na horizontal (u) repete a cada 16,6 m ao longo do costado.
Convés: quadro de 8 m x 8 m de aço com pintura antiderrapante, soldas das chapas, desgaste e manchas.
ORM segue o glTF: R = oclusão (1), G = rugosidade, B = metal.
Requer numpy e Pillow (python -m pip install numpy pillow).
"""
import os
import numpy as np
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, 'texturas')
N = 2048
rng = np.random.default_rng(20261126)


def ruido(escala_px, n=N, anis=(1.0, 1.0)):
    """Ruído gaussiano tileável (filtrado no domínio da frequência), média 0 e desvio 1.
    anis estica o grão: (sx, sy) > 1 alonga naquele eixo."""
    w = rng.standard_normal((n, n))
    fy = np.fft.fftfreq(n)[:, None] * escala_px * anis[1]
    fx = np.fft.fftfreq(n)[None, :] * escala_px * anis[0]
    f = np.exp(-2 * (np.pi ** 2) * (fx ** 2 + fy ** 2))
    r = np.real(np.fft.ifft2(np.fft.fft2(w) * f))
    return (r - r.mean()) / (r.std() + 1e-9)


def srgb_lin(c):
    c = np.asarray(c, dtype=np.float64) / 255
    return np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4)


def lin_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= .0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - .055)


def mistura(base, cor, a):
    """Mistura em espaço linear: base (N,N,3), cor (3,) ou (N,N,3), a (N,N)."""
    return base * (1 - a[..., None]) + np.asarray(cor) * a[..., None]


def suave(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def normal_de_altura(h, px):
    """Mapa normal (convenção OpenGL/glTF, +Y para cima na imagem) a partir da altura em metros.
    h[linha, coluna] com linha 0 = v=0 (base da imagem)."""
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) / (2 * px)
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) / (2 * px)
    n = np.dstack([-dx, -dy, np.ones_like(h)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return n * .5 + .5


def salvar(nome, arr, linear_para_srgb=False, q=90):
    a = lin_srgb(arr) if linear_para_srgb else np.clip(arr, 0, 1)
    img = Image.fromarray((np.flipud(a) * 255 + .5).astype(np.uint8))  # linha 0 do array = base da imagem
    os.makedirs(SAIDA, exist_ok=True)
    p = os.path.join(SAIDA, nome)
    img.save(p, quality=q, subsampling=0 if q >= 90 else 2, optimize=True)
    print(nome, os.path.getsize(p) // 1024, 'KB')


def casco():
    Y0, ALT = -7.0, 16.6
    px = ALT / N
    lin = (np.arange(N) + .5) * px
    y = (Y0 + lin)[:, None] * np.ones((1, N))
    x = lin[None, :] * np.ones((N, 1))

    # faixas de pintura (cores de referência de drillship)
    RED, BLK, NAV, WHT = map(srgb_lin, [(138, 32, 35), (22, 25, 28), (27, 46, 79), (231, 234, 236)])
    e = px * 1.2
    a_blk = suave(-.4 - e, -.4 + e, y)
    a_nav = suave(.6 - e, .6 + e, y)
    a_wht = suave(9 - e, 9 + e, y)
    cor = mistura(mistura(mistura(np.broadcast_to(RED, (N, N, 3)).copy(), BLK, a_blk), NAV, a_nav), WHT, a_wht)
    azul = a_nav * (1 - a_wht)
    verm = 1 - a_blk

    # variação de tom da pintura (retoques, desbotamento)
    mot = 1 + .05 * ruido(160) + .025 * ruido(24)
    mot += azul * (.07 * suave(5, 9, y))  # azul mais desbotado no alto, onde bate sol
    cor *= mot[..., None]

    # incrustação/limo logo abaixo da linha d'água e fundo mais escuro e fosco
    lim = verm * suave(-3.5, -.6, y) * np.clip(.55 + .45 * ruido(40, anis=(3, 1)), 0, 1)
    cor = mistura(cor, srgb_lin((70, 74, 48)), .45 * lim)
    cor *= (1 - .18 * verm * suave(-1, -6, y) * np.clip(.5 + .5 * ruido(90), 0, 1))[..., None]

    # resíduo de sal / espuma na faixa da linha d'água
    sal = suave(0, .12, y) * (1 - suave(.25, .6, y)) * np.clip(.5 + .6 * ruido(12, anis=(6, 1)), 0, 1)
    cor = mistura(cor, srgb_lin((120, 124, 116)), .12 * sal)

    # raspões de rebocador e defensas: manchas horizontais claras e com ferrugem no costado baixo
    rasp = np.zeros((N, N))
    for _ in range(12):
        cx, cy = rng.uniform(0, ALT), rng.uniform(-.3, 3.2)
        L, H = rng.uniform(.4, 2.6), rng.uniform(.03, .16)
        dxw = np.minimum(np.abs(x - cx), ALT - np.abs(x - cx))
        rasp = np.maximum(rasp, np.exp(-(dxw / L) ** 4 - ((y - cy) / H) ** 2) * rng.uniform(.4, 1))
    rasp *= np.clip(.6 + .6 * ruido(3, anis=(8, 1)), 0, 1)
    cor = mistura(cor, srgb_lin((92, 90, 86)), .2 * rasp)
    cor = mistura(cor, srgb_lin((112, 58, 30)), .25 * rasp * np.clip(ruido(6), 0, 1))

    # chapeamento: fiadas (soldas horizontais) a cada 2,4 m e topos (soldas verticais) defasados
    fiadas = np.array([-4.6, -2.2, .2, 2.6, 5.0, 7.4])
    h = np.zeros((N, N))
    sg = .009
    solda_mask = np.zeros((N, N))
    for k, ys in enumerate(fiadas):
        g = np.exp(-((y - ys) / sg) ** 2)
        h += .0018 * g
        solda_mask = np.maximum(solda_mask, np.exp(-((y - ys) / .03) ** 2))
    lim_f = np.concatenate([[Y0 - 10], fiadas, [20]])
    for k in range(len(lim_f) - 1):
        dentro = (y >= lim_f[k]) & (y < lim_f[k + 1])
        off = (k % 2) * ALT / 8
        for xs in np.arange(4) * ALT / 4 + off:
            dxw = np.minimum(np.abs(x - xs), ALT - np.abs(x - xs))
            g = np.exp(-(dxw / sg) ** 2) * dentro
            h += .0018 * g
            solda_mask = np.maximum(solda_mask, np.exp(-(dxw / .03) ** 2) * dentro)
    # "costelas" (hungry horse): leve afundamento da chapa entre cavernas a cada ~0,69 m
    esp = ALT / 24
    h -= .0045 * np.sin(np.pi * x / esp) ** 2 * suave(-6.5, -5, y)
    # casca de laranja da tinta e rugosidade do limo
    h += .00012 * ruido(1.5) + .0009 * lim * np.clip(ruido(2.5), 0, 3)
    # degrau sutil nas divisas de pintura
    h += .0003 * (a_blk + a_nav + a_wht)

    # soldas um pouco marcadas pela ferrugem no costado azul
    cor = mistura(cor, srgb_lin((96, 66, 48)), .12 * solda_mask * azul * np.clip(.4 + ruido(8), 0, 1))

    # escorridos de ferrugem descendo das soldas e de pontos aleatórios
    esc = np.zeros((N, N))
    col_n = ruido(2, anis=(1, 30))  # variação ao longo do comprimento do escorrido
    for _ in range(45):
        cx = rng.uniform(0, ALT)
        cy = rng.choice(list(fiadas[2:]) + [9.6, 9.0]) if rng.random() < .6 else rng.uniform(1.5, 9.5)
        L = rng.uniform(.4, 4.5)
        W = rng.uniform(.03, .12)
        dxw = np.minimum(np.abs(x - cx), ALT - np.abs(x - cx))
        t = (cy - y) / L
        perfil = np.where((t > 0) & (t < 1.5), np.exp(-2.2 * t) * (1 - suave(.9, 1.5, t)), 0)
        larg = W * (1 + .8 * np.clip(t, 0, 1.5))
        esc = np.maximum(esc, perfil * np.exp(-(dxw / larg) ** 2) * rng.uniform(.4, 1))
    esc *= np.clip(.75 + .35 * col_n, 0, 1.3)
    esc *= suave(.4, .9, y)  # só acima da linha d'água
    cor = mistura(cor, srgb_lin((128, 64, 28)), np.clip(.38 * esc, 0, .45))

    # lascas de tinta com ferrugem
    lasca = np.clip(ruido(1.2) - 2.9, 0, 1) * 2.5 * (azul + a_wht * .5)
    lasca = np.clip(lasca, 0, 1)
    cor = mistura(cor, srgb_lin((90, 48, 26)), lasca)
    h -= .0004 * lasca

    # sujeira na faixa branca do topo
    cor *= (1 - .12 * a_wht * np.clip(.5 + .5 * ruido(4, anis=(1, 10)), 0, 1.5))[..., None]

    rug = .78 * verm + .62 * a_blk * (1 - a_nav) + .44 * azul + .52 * a_wht
    rug += .04 * ruido(30) + .25 * lim + .3 * np.clip(esc * 1.5, 0, 1) + .3 * lasca + .15 * rasp
    metal = .03 + .25 * rasp * .3
    orm = np.dstack([np.ones((N, N)), np.clip(rug, .2, 1), np.clip(metal, 0, 1)])

    salvar('casco_cor.jpg', np.clip(cor, 0, 1), True, 88)
    salvar('casco_normal.jpg', normal_de_altura(h, px), False, 92)
    salvar('casco_orm.jpg', orm, False, 85)


def conves():
    LADO = 8.0
    px = LADO / N
    lin = (np.arange(N) + .5) * px
    z = lin[:, None] * np.ones((1, N))
    x = lin[None, :] * np.ones((N, 1))
    BASE = srgb_lin((104, 110, 104))
    cor = np.broadcast_to(BASE, (N, N, 3)).copy()
    cor *= (1 + .035 * ruido(200) + .025 * ruido(40))[..., None]

    # grão antiderrapante (areia na tinta)
    grao = ruido(.8)
    h = .00025 * grao + .00008 * ruido(.5)
    cor *= (1 + .05 * grao)[..., None]

    # soldas das chapas do convés: 4 m em x, 2 m em z
    sold = np.zeros((N, N))
    for xs in (0, 4):
        dxw = np.minimum(np.abs(x - xs), LADO - np.abs(x - xs))
        sold = np.maximum(sold, np.exp(-(dxw / .007) ** 2))
    for zs in (0, 2, 4, 6):
        dzw = np.minimum(np.abs(z - zs), LADO - np.abs(z - zs))
        sold = np.maximum(sold, np.exp(-(dzw / .007) ** 2))
    h += .0022 * sold

    # desgaste: tinta gasta mostrando aço e ferrugem nas áreas de passagem
    gasto = np.clip((ruido(90) * .6 + ruido(20) * .45 + ruido(4, anis=(4, 1)) * .3) - 1.25, 0, 1) * 2.2
    gasto = np.clip(gasto, 0, 1)
    aco = srgb_lin((74, 74, 72))
    cor = mistura(cor, aco, .8 * gasto)
    ferr = np.clip(gasto * (.6 + .6 * ruido(3)) - .35, 0, 1)
    cor = mistura(cor, srgb_lin((112, 62, 34)), .7 * ferr)
    h -= .0003 * gasto
    cor = mistura(cor, srgb_lin((96, 70, 52)), .25 * np.exp(-((sold - 1) ** 2) / .5) * sold * np.clip(ruido(10), 0, 1))

    # marcas de arraste de carga ao longo do navio
    arr = np.clip(ruido(2, anis=(60, 1)) - 1.2, 0, 1) * np.clip(ruido(80) + .3, 0, 1)
    cor = mistura(cor, srgb_lin((60, 62, 60)), .5 * np.clip(arr, 0, 1))

    # manchas de óleo (escuras e mais lisas)
    oleo = np.zeros((N, N))
    for _ in range(7):
        cx, cz, r = rng.uniform(0, LADO), rng.uniform(0, LADO), rng.uniform(.15, .7)
        dxw = np.minimum(np.abs(x - cx), LADO - np.abs(x - cx))
        dzw = np.minimum(np.abs(z - cz), LADO - np.abs(z - cz))
        d = np.sqrt(dxw ** 2 + dzw ** 2) / r
        oleo = np.maximum(oleo, np.clip(1.2 - d + .3 * ruido(8)[0:N, 0:N], 0, 1))
    cor = mistura(cor, srgb_lin((34, 32, 28)), .55 * oleo)

    rug = .88 - .25 * gasto + .1 * ferr - .45 * oleo + .03 * ruido(10)
    metal = .05 + .55 * gasto * (1 - ferr)
    orm = np.dstack([np.ones((N, N)), np.clip(rug, .25, 1), np.clip(metal, 0, 1)])
    salvar('conves_cor.jpg', np.clip(cor, 0, 1), True, 88)
    salvar('conves_normal.jpg', normal_de_altura(h, px), False, 84)
    salvar('conves_orm.jpg', orm, False, 85)


if __name__ == '__main__':
    casco()
    conves()
