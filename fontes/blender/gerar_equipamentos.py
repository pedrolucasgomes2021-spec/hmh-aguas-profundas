"""Equipamentos miúdos do convés do navio-sonda (o que deixa o convés com cara de "trabalho"):
contêineres de 20 pés corrugados, cestas de carga, racks de cilindros de gás, tambores em pallets,
linhas de tubulação e bandejas de cabos ao longo da borda, escadas até a plataforma de perfuração,
respiros tipo pescoço de ganso, carretel de mangueira e canhões de incêndio.

Uso (na raiz do repositório):
  python fontes/blender/gerar_texturas.py pintura
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup --python fontes/blender/gerar_equipamentos.py
Saída: assets/modelos/equipamentos.glb (comprimir depois com tools/comprimir_modelos.mjs).

Mesmo sistema de coordenadas do site (metros, Y para cima, proa +X, boreste +Z, convés em y=8).
As posições evitam o que makeShip() já monta (torre, guindastes, racks, módulo de lama, acomodações,
botes, contêineres existentes) — ver a lista OCUPADO e o README.
Todas as peças pintadas compartilham UMA textura neutra (pintura_*.jpg); a cor vem do fator do material.
"""
import math
import os
import sys
import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gerar_casco as GC  # noqa: E402  (reaproveita Malha, torno, hb, conversão de eixos)
from gerar_casco import Malha, V, hb, YC  # noqa: E402

RAIZ = GC.RAIZ
TEX = GC.TEX
GLB = os.path.join(RAIZ, 'assets', 'modelos', 'equipamentos.glb')
BLEND = os.path.join(RAIZ, 'fontes', 'blender', 'equipamentos.blend')

# índices de material
AMAR, BRAN, CINZ, VERM, AZUL, LARA, VERD, ACO, BORR, MADE = range(10)


def srgb(c):
    c = c / 255
    return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4


def materiais():
    def img(n, cor):
        im = bpy.data.images.load(os.path.join(TEX, n), check_existing=True)
        im.colorspace_settings.name = 'sRGB' if cor else 'Non-Color'
        return im

    def pint(nome, rgb, metal_tex=True, metal=0., rug=None):
        m = bpy.data.materials.new(nome); m.use_nodes = True
        nt = m.node_tree; b = nt.nodes['Principled BSDF']
        tc = nt.nodes.new('ShaderNodeTexImage'); tc.image = img('pintura_cor.jpg', True)
        tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = img('pintura_normal.jpg', False)
        to = nt.nodes.new('ShaderNodeTexImage'); to.image = img('pintura_orm.jpg', False)
        mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = 1.
        mix.inputs[7].default_value = (*[srgb(c) for c in rgb], 1)
        nt.links.new(tc.outputs['Color'], mix.inputs[6])
        nt.links.new(mix.outputs[2], b.inputs['Base Color'])
        nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(tn.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
        sep = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(to.outputs['Color'], sep.inputs['Color'])
        nt.links.new(sep.outputs['Green'], b.inputs['Roughness'])
        if metal_tex: nt.links.new(sep.outputs['Blue'], b.inputs['Metallic'])
        else: b.inputs['Metallic'].default_value = metal
        m.diffuse_color = (*[srgb(c) for c in rgb], 1)
        return m

    def liso(nome, rgb, rug, metal=0.):
        m = bpy.data.materials.new(nome); m.use_nodes = True
        b = m.node_tree.nodes['Principled BSDF']
        b.inputs['Base Color'].default_value = (*[srgb(c) for c in rgb], 1)
        b.inputs['Roughness'].default_value = rug; b.inputs['Metallic'].default_value = metal
        return m

    return [pint('Pintura_amarela', (222, 160, 24)), pint('Pintura_branca', (226, 228, 226)),
            pint('Pintura_cinza', (112, 118, 120)), pint('Pintura_vermelha', (160, 34, 30)),
            pint('Pintura_azul', (40, 78, 128)), pint('Pintura_laranja', (226, 96, 22)),
            pint('Pintura_verde', (52, 96, 62)), pint('Aco_galvanizado', (176, 180, 178), False, .85),
            liso('Borracha', (22, 22, 22), .85), pint('Madeira', (130, 96, 62))]


# ---------------------------------------------------------------- primitivas (coordenadas do site)
def rotY(p, a):
    c, s = math.cos(a), math.sin(a)
    return V(p.x * c + p.z * s, p.y, -p.x * s + p.z * c)


class Peca:
    """Posição + giro em Y para montar peças em coordenadas locais."""
    def __init__(self, M, o, ry=0.):
        self.M, self.o, self.ry = M, o, ry

    def T(self, p): return self.o + rotY(p, self.ry)
    def N(self, n): return rotY(n, self.ry)

    def caixa(self, c, s, mat):
        x0, x1 = c.x - s[0] / 2, c.x + s[0] / 2
        y0, y1 = c.y, c.y + s[1]
        z0, z1 = c.z - s[2] / 2, c.z + s[2] / 2
        F = [([(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)], (0, 1, 0)),
             ([(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)], (0, -1, 0)),
             ([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], (0, 0, 1)),
             ([(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)], (0, 0, -1)),
             ([(x1, y0, z0), (x1, y0, z1), (x1, y1, z1), (x1, y1, z0)], (1, 0, 0)),
             ([(x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0)], (-1, 0, 0))]
        for q, n in F:
            self.M.face([self.T(V(*p)) for p in q], [(0, 0)] * 4, self.N(V(*n)), mat)

    def viga(self, a, b, w, h, mat, up=V(0, 1, 0)):
        """Barra de seção retangular de a até b (cantoneiras, longarinas, corrimãos)."""
        a, b = self.T(a), self.T(b)
        ax = (b - a).normalized()
        u = up if abs(ax.dot(up)) < .95 else V(1, 0, 0)
        sd = ax.cross(u).normalized(); u = sd.cross(ax).normalized()
        cs = [(sd * (w / 2) * i + u * (h / 2) * j) for i, j in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        for k in range(4):
            c0, c1 = cs[k], cs[(k + 1) % 4]
            n = (c0 + c1)
            self.M.face([a + c0, a + c1, b + c1, b + c0], [(0, 0)] * 4, n, mat)
        self.M.face([a + c for c in cs], [(0, 0)] * 4, -ax, mat)
        self.M.face([b + c for c in cs], [(0, 0)] * 4, ax, mat)

    def tubo(self, a, b, r, mat, seg=10, tampa=True, suave=True):
        a, b = self.T(a), self.T(b)
        L = (b - a).length
        pf = [(0, 0), (0, r), (L, r), (L, 0)] if tampa else [(0, r), (L, r)]
        GC.torno(self.M, a, b - a, pf, seg, mat, uvf=lambda p: (0, 0), suave=suave)

    def revol(self, base, eixo, perfil, mat, seg=16):
        GC.torno(self.M, self.T(base), self.N(eixo), perfil, seg, mat, uvf=lambda p: (0, 0))


# ---------------------------------------------------------------- equipamentos
def conteiner(M, o, ry, mat):
    """Contêiner ISO de 20 pés (6,06 x 2,59 x 2,44 m) com paredes corrugadas, portas e travas."""
    P = Peca(M, o, ry)
    L, H, W = 6.06, 2.59, 2.44
    # estrutura: colunas de canto, travessas e longarinas
    for sx in (-1, 1):
        for sz in (-1, 1):
            P.caixa(V(sx * (L / 2 - .08), 0, sz * (W / 2 - .08)), (.16, H, .16), mat)
            P.caixa(V(sx * (L / 2 - .08), H - .02, sz * (W / 2 - .08)), (.18, .04, .18), CINZ)  # cantoneira (corner casting)
        for y in (0, H - .16):
            P.caixa(V(sx * (L / 2 - .08), y, 0), (.16, .16, W - .3), mat)
    for sz in (-1, 1):
        for y in (0, H - .16):
            P.caixa(V(0, y, sz * (W / 2 - .08)), (L - .3, .16, .16), mat)
    # laterais corrugadas (trapézios)
    n = 28
    x0, x1 = -L / 2 + .16, L / 2 - .16
    for sz in (-1, 1):
        pts = []
        for i in range(n + 1):
            for k, f in enumerate((0, .25, .5, .75)):
                if i == n and k: break
                x = x0 + (x1 - x0) * (i + f) / n
                prof = .0 if k in (0, 3) else .05
                pts.append((x, W / 2 - .03 - prof))
        for i in range(len(pts) - 1):
            (xa, za), (xb, zb) = pts[i], pts[i + 1]
            q = [V(xa, .16, sz * za), V(xb, .16, sz * zb), V(xb, H - .16, sz * zb), V(xa, H - .16, sz * za)]
            M.face([P.T(p) for p in q], [(0, 0)] * 4, P.N(V(-(zb - za), 0, xb - xa) * sz), mat)
    # teto (levemente rebaixado) e fundo
    P.caixa(V(0, H - .2, 0), (L - .3, .14, W - .3), mat)
    P.caixa(V(0, 0, 0), (L - .3, .14, W - .3), mat)
    # parede do fundo (corrugada na vertical, simplificada) e portas
    for i in range(8):
        z = -W / 2 + .2 + i * (W - .4) / 7
        P.caixa(V(-L / 2 + .06, .16, z), (.06, H - .32, .12), mat)
    P.caixa(V(-L / 2 + .1, .16, 0), (.04, H - .32, W - .3), mat)
    P.caixa(V(L / 2 - .1, .16, 0), (.04, H - .32, W - .3), mat)
    for z in (-.82, -.4, .4, .82):  # barras de trava das portas
        P.tubo(V(L / 2 - .04, .25, z), V(L / 2 - .04, H - .25, z), .028, ACO, 6)
        for y in (.3, H - .3):
            P.caixa(V(L / 2 - .05, y, z), (.06, .08, .12), ACO)
        P.caixa(V(L / 2 - .02, 1.1, z + .1), (.04, .05, .25), ACO)  # alavanca
    P.caixa(V(L / 2 - .03, .16, 0), (.03, H - .32, .03), CINZ)  # junta das portas


def cesta(M, o, ry, mat, L=6., W=2.4, H=1.2):
    """Cesta de carga (cargo basket) aberta: fundo, colunas, grade lateral e lingada de cabos."""
    P = Peca(M, o, ry)
    P.caixa(V(0, 0, 0), (L, .12, W), mat)
    P.caixa(V(0, .12, 0), (L - .1, .02, W - .1), CINZ)
    for sx in (-1, 0, 1):
        for sz in (-1, 1):
            P.viga(V(sx * (L / 2 - .05), .1, sz * (W / 2 - .05)), V(sx * (L / 2 - .05), H, sz * (W / 2 - .05)), .1, .1, mat)
    for sz in (-1, 1):
        for y in (H, H * .5):
            P.viga(V(-L / 2 + .05, y, sz * (W / 2 - .05)), V(L / 2 - .05, y, sz * (W / 2 - .05)), .08, .08, mat)
        for i in range(1, 12):
            x = -L / 2 + i * L / 12
            P.viga(V(x, .12, sz * (W / 2 - .05)), V(x, H, sz * (W / 2 - .05)), .03, .03, mat)
    for sx in (-1, 1):
        for y in (H, H * .5):
            P.viga(V(sx * (L / 2 - .05), y, -W / 2 + .05), V(sx * (L / 2 - .05), y, W / 2 - .05), .08, .08, mat)
        for i in range(1, 5):
            z = -W / 2 + i * W / 5
            P.viga(V(sx * (L / 2 - .05), .12, z), V(sx * (L / 2 - .05), H, z), .03, .03, mat)
    # lingada: 4 pernas de cabo até o anel de içamento (frouxa, deitada sobre a carga)
    topo = V(.4, H + .25, .1)
    for sx in (-1, 1):
        for sz in (-1, 1):
            P.tubo(V(sx * (L / 2 - .05), H, sz * (W / 2 - .05)), topo, .02, BORR, 5, False)
    P.revol(topo, V(0, 1, 0), [(-.04, 0), (-.04, .15), (.04, .15), (.04, 0)], ACO, 12)
    # carga: alguns sacos e caixas dentro
    P.caixa(V(-1.6, .14, -.4), (1.2, .6, 1.0), MADE)
    P.caixa(V(-.2, .14, .5), (1.0, .45, .8), BRAN)
    P.caixa(V(1.5, .14, -.3), (1.4, .8, 1.1), MADE)


def rack_gas(M, o, ry):
    """Rack de cilindros de gás (oxigênio/acetileno/nitrogênio) com estrutura e correntes."""
    P = Peca(M, o, ry)
    L, W, H = 2.1, .8, 1.9
    P.caixa(V(0, 0, 0), (L, .1, W), AMAR)
    for sx in (-1, 1):
        for sz in (-1, 1):
            P.viga(V(sx * L / 2, .1, sz * W / 2), V(sx * L / 2, H, sz * W / 2), .07, .07, AMAR)
    for y in (.9, 1.5, H):
        for sz in (-1, 1):
            P.viga(V(-L / 2, y, sz * W / 2), V(L / 2, y, sz * W / 2), .05, .05, AMAR)
        for sx in (-1, 1):
            P.viga(V(sx * L / 2, y, -W / 2), V(sx * L / 2, y, W / 2), .05, .05, AMAR)
    P.caixa(V(0, H, 0), (L + .1, .04, W + .1), AMAR)  # teto
    cores = [VERD, VERD, CINZ, VERM, VERM, CINZ, AZUL, VERD]
    for i in range(8):
        x = -L / 2 + .22 + (i % 4) * (L - .44) / 3
        z = -.18 if i < 4 else .18
        r, h = .115, 1.45
        P.revol(V(x, .1, z), V(0, 1, 0), [(0, 0), (0, r), (h - .12, r), (h - .04, r * .6), (h, .03), (h + .05, .03), (h + .05, 0)], cores[i], 14)
        P.revol(V(x, .1 + h + .02, z), V(0, 1, 0), [(0, .07), (.12, .07), (.12, 0)], ACO, 8)  # capacete da válvula


def tambores(M, o, ry, cores):
    """Pallet de madeira com 4 tambores de 200 L."""
    P = Peca(M, o, ry)
    for z in (-.5, 0, .5):
        P.caixa(V(0, 0, z), (1.2, .1, .1), MADE)
    for x in (-.55, -.18, .18, .55):
        P.caixa(V(x, .1, 0), (.1, .03, 1.2), MADE)
    for i, (x, z) in enumerate([(-.3, -.3), (.3, -.3), (-.3, .3), (.3, .3)]):
        r, h = .29, .88
        P.revol(V(x, .13, z), V(0, 1, 0), [(0, 0), (0, r - .01), (.02, r), (.29, r), (.3, r + .012), (.31, r), (.58, r), (.59, r + .012), (.6, r),
                                         (h - .02, r), (h, r - .01), (h, 0)], cores[i % len(cores)], 18)
        P.revol(V(x + .12, .13 + h, z), V(0, 1, 0), [(0, .035), (.025, .035), (.025, 0)], CINZ, 8)  # bujão


def linha_tubos(M, lado, trechos):
    """Tubulação e bandeja de cabos correndo junto à borda, com suportes a cada 3 m."""
    zc = lambda x: lado * (hb(x, YC) - 1.05)
    P = Peca(M, V(0, 0, 0))
    for (xa, xb) in trechos:
        n = max(1, int((xb - xa) / 1.5))
        xs = [xa + (xb - xa) * i / n for i in range(n + 1)]
        for i in range(n):
            x0, x1 = xs[i], xs[i + 1]
            z0, z1 = zc(x0), zc(x1)
            for (dz, dy, r, mat) in [(-.28, .55, .13, VERM), (0, .55, .09, CINZ), (.22, .55, .075, AZUL)]:
                P.tubo(V(x0, YC + dy, z0 + lado * dz), V(x1, YC + dy, z1 + lado * dz), r, mat, 10, False)
            # bandeja de cabos (fundo + abas) e feixe de cabos dentro
            for (dz, dy, w, h) in [(0, 1.02, .6, .02), (-.3, 1.02, .02, .1), (.3, 1.02, .02, .1)]:
                P.viga(V(x0, YC + dy + h / 2, z0 + lado * dz), V(x1, YC + dy + h / 2, z1 + lado * dz), w if w > .1 else .02, h, ACO)
            P.tubo(V(x0, YC + 1.08, z0 - lado * .1), V(x1, YC + 1.08, z1 - lado * .1), .045, BORR, 6, False)
            P.tubo(V(x0, YC + 1.08, z0 + lado * .08), V(x1, YC + 1.08, z1 + lado * .08), .04, BORR, 6, False)
        for x in xs[::2]:  # suportes em "U" invertido
            z = zc(x)
            for dz in (-.45, .42):
                P.viga(V(x, YC, z + lado * dz), V(x, YC + 1.12, z + lado * dz), .08, .08, AMAR)
            P.viga(V(x, YC + .4, z - lado * .45), V(x, YC + .4, z + lado * .42), .06, .08, AMAR)
            P.viga(V(x, YC + 1.0, z - lado * .45), V(x, YC + 1.0, z + lado * .42), .06, .06, AMAR)
            for dz in (-.28, 0, .22):  # abraçadeiras
                P.caixa(V(x, YC + .4, z + lado * dz), (.05, .08, .3), ACO)


def escada(M, p0, p1, z, lado):
    """Escada inclinada do convés até a plataforma de perfuração, com patamar e corrimãos."""
    P = Peca(M, V(0, 0, 0))
    larg = .9
    a, b = V(p0[0], p0[1], z), V(p1[0], p1[1], z)
    d = (b - a)
    run = math.hypot(d.x, d.z)
    for s in (-1, 1):
        off = V(0, 0, s * larg / 2)
        P.viga(a + off, b + off, .06, .25, AMAR)
    n = int(abs(d.y) / .22)
    for i in range(1, n):
        p = a + d * (i / n)
        P.caixa(V(p.x, p.y - .03, p.z), (.24, .04, larg - .08), ACO)
    # corrimãos e montantes
    for s in (-1, 1):
        off = V(0, 0, s * (larg / 2 + .02))
        for h in (.5, 1.0):
            P.tubo(a + off + V(0, h, 0), b + off + V(0, h, 0), .025, AMAR, 6, False)
        for i in range(0, 7):
            p = a + d * (i / 6) + off
            P.tubo(p, p + V(0, 1.0, 0), .025, AMAR, 6, False)
    # patamar no topo e coluna de apoio
    sx = 1 if d.x < 0 else -1
    top = b + V(-sx * .0, 0, 0)
    P.caixa(V(b.x - sx * .6, b.y - .08, z), (1.3, .08, larg + .2), ACO)
    P.viga(V(b.x - sx * .6, YC, z), V(b.x - sx * .6, b.y - .08, z), .14, .14, AMAR)
    P.viga(V((a.x + b.x) / 2, YC, z), V((a.x + b.x) / 2, (a.y + b.y) / 2 - .1, z), .12, .12, AMAR)
    for h in (.5, 1.0):
        P.tubo(V(b.x - sx * 1.25, b.y + h, z + lado * (larg / 2 + .1)), V(b.x + sx * .05, b.y + h, z + lado * (larg / 2 + .1)), .025, AMAR, 6, False)


def respiro(M, o, ry):
    """Respiro em pescoço de ganso (air pipe) com base e tampa flutuante."""
    P = Peca(M, o, ry)
    P.revol(V(0, 0, 0), V(0, 1, 0), [(0, .25), (.06, .25), (.06, .12), (.95, .12)], BRAN, 12)
    pts = [V(0, .95, 0), V(0, 1.15, .08), V(0, 1.22, .25), V(0, 1.12, .42), V(0, .92, .46)]
    for i in range(len(pts) - 1):
        P.tubo(pts[i], pts[i + 1], .12, BRAN, 12, False)
    P.revol(V(0, .78, .46), V(0, 1, 0), [(0, 0), (0, .16), (.16, .16), (.16, 0)], BRAN, 12)


def carretel(M, o, ry):
    """Carretel de mangueira com moldura."""
    P = Peca(M, o, ry)
    for sx in (-1, 1):
        P.viga(V(sx * .5, 0, -.35), V(sx * .5, 1.1, 0), .06, .06, VERM)
        P.viga(V(sx * .5, 0, .35), V(sx * .5, 1.1, 0), .06, .06, VERM)
    P.caixa(V(0, 0, 0), (1.1, .06, .9), VERM)
    P.revol(V(-.45, 1.0, 0), V(1, 0, 0), [(0, 0), (0, .55), (.04, .55), (.04, .22), (.86, .22), (.86, .55), (.9, .55), (.9, 0)], VERM, 20)
    P.revol(V(-.4, 1.0, 0), V(1, 0, 0), [(0, .23), (0, .44), (.8, .44), (.8, .23)], BORR, 20)
    P.tubo(V(.0, .58, .3), V(.2, .05, .9), .035, BORR, 6, False)
    P.revol(V(.2, .05, .9), V(0, 0, 1), [(0, .05), (.25, .045), (.25, 0)], ACO, 8)  # esguicho


def canhao_incendio(M, o, ry):
    """Canhão monitor de incêndio sobre pedestal (vermelho)."""
    P = Peca(M, o, ry)
    P.revol(V(0, 0, 0), V(0, 1, 0), [(0, .4), (.08, .4), (.08, .16), (1.1, .16), (1.2, .22), (1.3, .22), (1.3, 0)], VERM, 16)
    P.tubo(V(0, 1.35, 0), V(0, 1.6, 0), .12, VERM, 12)
    P.tubo(V(0, 1.6, 0), V(.5, 1.85, 0), .1, VERM, 12)
    P.revol(V(.5, 1.85, 0), V(.894, .447, 0), [(0, .1), (.5, .06), (.5, 0)], ACO, 12)
    P.tubo(V(-.1, 1.5, -.1), V(-.45, 1.45, -.1), .025, ACO, 6)  # manopla


def principal():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = materiais()
    M = Malha('Equipamentos')

    # --- contêineres a ré (longos em z), dois empilhados de um lado
    conteiner(M, V(-79.2, YC, 6.9), math.pi / 2, AZUL)
    conteiner(M, V(-79.2, YC, -6.9), math.pi / 2, VERD)
    conteiner(M, V(-79.2, YC + 2.59, -6.9), math.pi / 2, LARA)
    conteiner(M, V(20.5, YC, 9.6), 0, BRAN)
    # --- cestas de carga entre a torre e as acomodações
    cesta(M, V(18.5, YC, -4.8), .02, LARA)
    cesta(M, V(-47.5, YC, 1.8), 1.57, AMAR, L=4.5)
    # --- racks de cilindros e tambores
    rack_gas(M, V(-79.6, YC, 0), math.pi / 2)
    tambores(M, V(-47.5, YC, -1.6), .1, [AZUL, AZUL, VERM, AZUL])
    tambores(M, V(23.5, YC, 3.6), .4, [VERD, VERD, CINZ, VERD])
    tambores(M, V(-12.2, YC, -3.2), -.2, [VERM, CINZ, VERM, VERM])
    tambores(M, V(-12.2, YC, -1.6), .15, [AZUL, CINZ, AZUL, AZUL])
    # --- tubulação junto à borda (trechos livres, ver OCUPADO no README)
    linha_tubos(M, 1, [(-70, -49), (-43, -30), (-18, -15), (-9, 8), (11, 26)])
    linha_tubos(M, -1, [(-70, -46), (-8.5, 9), (15, 21)])
    # --- escadas até a plataforma de perfuração (y=17), por fora das paredes de vento
    escada(M, (10.2, YC), (1.2, 17.0), 11.3, 1)
    escada(M, (-10.4, YC), (-1.4, 17.0), -11.3, -1)
    # --- respiros, carretel e canhões de incêndio
    for (x, k) in [(-60, 1), (-36, 1), (-6, 1), (14.5, 1), (-55, -1), (-48.5, -1), (6.5, -1), (19.5, -1)]:
        respiro(M, V(x, YC, k * (hb(x, YC) - 1.95)), 0 if k > 0 else math.pi)
    carretel(M, V(-35, YC, 10.2), 0)
    carretel(M, V(-51.5, YC, -10.6), math.pi)
    for k in (1, -1):
        canhao_incendio(M, V(60.2, YC, k * 6.2), -k * .6)

    ob = M.criar(mats)
    # UV por projeção em cubo (1 quadro da textura = 2 m)
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.cube_project(cube_size=2.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    dg = bpy.context.evaluated_depsgraph_get()
    me = ob.evaluated_get(dg).data; me.calc_loop_triangles()
    print('TOTAL', len(me.loop_triangles), 'triângulos')
    bpy.ops.wm.save_as_mainfile(filepath=BLEND, relative_remap=True, compress=True)
    bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', export_yup=True, export_apply=True,
                              export_texcoords=True, export_normals=True, export_tangents=False,
                              export_materials='EXPORT', export_image_format='AUTO',
                              export_cameras=False, export_lights=False, use_selection=False)
    print('GLB', os.path.getsize(GLB) // 1024, 'KB')


principal()
