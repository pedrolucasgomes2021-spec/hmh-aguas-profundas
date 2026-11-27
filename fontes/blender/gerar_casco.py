"""Gera no Blender o casco + convés do navio-sonda e exporta assets/modelos/casco.glb.

Uso (na raiz do repositório, Blender 4.2+ / 5.x):
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup --python fontes/blender/gerar_casco.py
Antes, gere as texturas:  python fontes/blender/gerar_texturas.py
Depois, comprima:  ver tools/comprimir_modelos.mjs

Todo o modelo é descrito no sistema do site (metros, Y para cima, proa em +X, boreste em +Z) e convertido para o
Blender (Z para cima) na hora de criar a malha; o exportador glTF desfaz a conversão (Y-up).
A forma do costado é a MESMA de hullGeometry() em assets/js/modelos.js (funções xr e hb), para que torre,
guindastes, heliponto, guarda-corpo e shipDetail() continuem encaixados. Convés em y=8, borda até y=9,6.
"""
import math
import os
import bpy
import bmesh
from mathutils import Vector, Matrix

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
TEX = os.path.join(RAIZ, 'fontes', 'blender', 'texturas')
GLB = os.path.join(RAIZ, 'assets', 'modelos', 'casco.glb')
BLEND = os.path.join(RAIZ, 'fontes', 'blender', 'casco.blend')

YK, YD, YC = -7.0, 9.6, 8.0          # quilha, topo da borda, convés
TILE = 16.6                          # quadro da textura do casco (m)
MP = 6.0                             # meia-abertura do moonpool (12 x 12 m)
BORDA = .3                           # espessura aparente da borda (bulwark)


def lerp(a, b, t): return a + (b - a) * t
def clamp(v, a=0., b=1.): return max(a, min(b, v))


def xr(y):
    yn = (y - YK) / (YD - YK)
    return lerp(-77, -82, yn), lerp(54, 69, max(yn, 0) ** .75)


def hb(x, y):
    yn = (y - YK) / (YD - YK)
    xs, xb = xr(y)
    w = 13.
    if x > 26:
        t = clamp((x - 26) / (xb - 26))
        w *= max(0., 1 - t ** lerp(1.5, 2.8, yn)) ** .55
    if x < xs + 7:
        t = clamp((xs + 7 - x) / 7)
        w *= 1 - .1 * t
    w *= .8 + .2 * math.sqrt(clamp((y - YK) / 2.4))
    return w


def V(x, y, z): return Vector((x, y, z))


def normal_costado(x, y, lado):
    e = .05
    px = V(2 * e, 0, lado * (hb(x + e, y) - hb(x - e, y)))
    py = V(0, 2 * e, lado * (hb(x, y + e) - hb(x, y - e)))
    n = px.cross(py)
    if n.z * lado < 0: n = -n
    return n.normalized()


def uv_pint(p):
    """UV na textura do casco pela altura (faixas de pintura) e posição ao longo do navio."""
    return ((p.x + p.z * .3) / TILE, clamp((p.y - YK) / TILE, .004, .996))


class Malha:
    """Acumula triângulos/quads (coordenadas do site) com UV, material e suavização."""

    def __init__(self, nome):
        self.nome, self.v, self.f = nome, [], []

    def pt(self, p):
        self.v.append(Vector(p)); return len(self.v) - 1

    def face(self, pts, uvs, nrm, mat=0, suave=False):
        """pts: posições; nrm: normal desejada (a ordem é invertida se precisar)."""
        a, b, c = pts[0], pts[1], pts[2]
        n = (b - a).cross(c - a)
        if n.length < 1e-12 and len(pts) == 4: n = (c - a).cross(pts[3] - a)
        if n.dot(nrm) < 0: pts, uvs = pts[::-1], uvs[::-1]
        self.f.append(([self.pt(p) for p in pts], list(uvs), mat, suave))

    def criar(self, mats):
        me = bpy.data.meshes.new(self.nome)
        conv = [(p.x, -p.z, p.y) for p in self.v]  # site (Y-up) -> Blender (Z-up)
        me.from_pydata(conv, [], [f[0] for f in self.f])
        uvl = me.uv_layers.new(name='UVMap')
        li = 0
        for poly, (_, uvs, mat, suave) in zip(me.polygons, self.f):
            poly.material_index = mat
            poly.use_smooth = suave
            for k in range(poly.loop_total):
                uvl.data[poly.loop_start + k].uv = uvs[k]
        bm = bmesh.new(); bm.from_mesh(me)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=.0005)
        bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-5)
        bm.to_mesh(me); bm.free()
        me.validate()
        ob = bpy.data.objects.new(self.nome, me)
        for m in mats: me.materials.append(m)
        bpy.context.scene.collection.objects.link(ob)
        return ob


# ---------------------------------------------------------------- materiais
def img(nome, cor):
    im = bpy.data.images.load(os.path.join(TEX, nome), check_existing=True)
    im.colorspace_settings.name = 'sRGB' if cor else 'Non-Color'
    return im


def mat_tex(nome, pre):
    m = bpy.data.materials.new(nome); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    t_cor = nt.nodes.new('ShaderNodeTexImage'); t_cor.image = img(pre + '_cor.jpg', True)
    t_nor = nt.nodes.new('ShaderNodeTexImage'); t_nor.image = img(pre + '_normal.jpg', False)
    t_orm = nt.nodes.new('ShaderNodeTexImage'); t_orm.image = img(pre + '_orm.jpg', False)
    nm = nt.nodes.new('ShaderNodeNormalMap')
    sep = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(t_cor.outputs['Color'], b.inputs['Base Color'])
    nt.links.new(t_nor.outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], b.inputs['Normal'])
    nt.links.new(t_orm.outputs['Color'], sep.inputs['Color'])
    nt.links.new(sep.outputs['Green'], b.inputs['Roughness'])
    nt.links.new(sep.outputs['Blue'], b.inputs['Metallic'])
    return m


def mat_liso(nome, cor, rug, metal=0.):
    m = bpy.data.materials.new(nome); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*cor, 1)
    b.inputs['Roughness'].default_value = rug
    b.inputs['Metallic'].default_value = metal
    m.diffuse_color = (*cor, 1)
    return m


# ---------------------------------------------------------------- casco
def costado(M, NX=262, NY=32):
    for lado in (1, -1):
        g, uv = [], []
        for j in range(NY + 1):
            y = lerp(YK, YD, j / NY)
            xs, xb = xr(y)
            lin, uvl, s = [], [], 0.
            for i in range(NX + 1):
                x = lerp(xs, xb, i / NX)
                p = V(x, y, lado * hb(x, y))
                if lin: s += (p - lin[-1]).length
                lin.append(p); uvl.append((s / TILE, clamp((y - YK) / TILE, .004, .996)))
            g.append(lin); uv.append(uvl)
        for j in range(NY):
            for i in range(NX):
                q = [g[j][i], g[j][i + 1], g[j + 1][i + 1], g[j + 1][i]]
                u = [uv[j][i], uv[j][i + 1], uv[j + 1][i + 1], uv[j + 1][i]]
                M.face(q, u, V(0, 0, lado), 0, True)
    # espelho de popa (inclinado: -77 na quilha, -82 no topo)
    for j in range(NY):
        y0, y1 = lerp(YK, YD, j / NY), lerp(YK, YD, (j + 1) / NY)
        x0, x1 = xr(y0)[0], xr(y1)[0]
        w0, w1 = hb(x0, y0), hb(x1, y1)
        q = [V(x0, y0, -w0), V(x0, y0, w0), V(x1, y1, w1), V(x1, y1, -w1)]
        M.face(q, [uv_pint(V(0, p.y, p.z / .3)) for p in q], V(-1, 0, 0), 0)


def fundo(M, NX=262, NS=16):
    xs, xb = xr(YK)
    xsx = sorted(set([lerp(xs, xb, i / NX) for i in range(NX + 1)] + [-MP, MP]))
    w0 = hb(0, YK)
    ss = sorted(set([lerp(-1, 1, k / NS) for k in range(NS + 1)] + [-MP / w0, MP / w0]))
    for i in range(len(xsx) - 1):
        xa, xc = xsx[i], xsx[i + 1]
        wa, wc = hb(xa, YK), hb(xc, YK)
        for k in range(len(ss) - 1):
            sa, sc = ss[k], ss[k + 1]
            if abs((xa + xc) / 2) < MP and abs((sa + sc) / 2 * w0) < MP: continue  # moonpool vazado
            q = [V(xa, YK, sa * wa), V(xc, YK, sa * wc), V(xc, YK, sc * wc), V(xa, YK, sc * wa)]
            M.face(q, [(p.x / TILE, .02 + .25 * (s + 1) / 2) for p, s in zip(q, (sa, sa, sc, sc))], V(0, -1, 0), 0)


def borda(M, NX=262):
    """Face interna da borda (y 8 a 9,6), capa no topo e face interna do espelho."""
    vb = clamp((9.3 - YK) / TILE, 0, .996)
    xs8, xb8 = xr(YC)
    xs9, xb9 = xr(YD)
    for lado in (1, -1):
        for i in range(NX):
            xa, xc = lerp(xs9 + BORDA, xb9, i / NX), lerp(xs9 + BORDA, xb9, (i + 1) / NX)
            wi = lambda x, y: max(hb(x, y) - BORDA, 0.)
            # capa (topo da borda)
            o0, o1 = V(xa, YD, lado * hb(xa, YD)), V(xc, YD, lado * hb(xc, YD))
            n0, n1 = V(xa, YD, lado * wi(xa, YD)), V(xc, YD, lado * wi(xc, YD))
            M.face([o0, o1, n1, n0], [(xa / TILE, .998), (xc / TILE, .998), (xc / TILE, .99), (xa / TILE, .99)], V(0, 1, 0), 0)
            # face interna
            b0, b1 = V(xa, YC, lado * wi(xa, YC)), V(xc, YC, lado * wi(xc, YC))
            M.face([b0, b1, n1, n0], [(xa / TILE, vb - .05), (xc / TILE, vb - .05), (xc / TILE, vb), (xa / TILE, vb)], V(0, 0, -lado), 0)
    # popa: capa e face interna do espelho
    w9, w8 = hb(xs9 + BORDA, YD) - BORDA, hb(xs8 + BORDA, YC) - BORDA
    q = [V(xs9, YD, -w9), V(xs9, YD, w9), V(xs9 + BORDA, YD, w9), V(xs9 + BORDA, YD, -w9)]
    M.face(q, [(p.z / TILE, .998 if p.x < xs9 + .1 else .99) for p in q], V(0, 1, 0), 0)
    q = [V(xs8 + BORDA, YC, -w8), V(xs8 + BORDA, YC, w8), V(xs9 + BORDA, YD, w9), V(xs9 + BORDA, YD, -w9)]
    M.face(q, [(p.z / TILE, vb - .05 if p.y < 9 else vb) for p in q], V(1, 0, 0), 0)


def moonpool(M, mat):
    cantos = [(-MP, -MP), (MP, -MP), (MP, MP), (-MP, MP)]
    for k in range(4):
        (xa, za), (xc, zc) = cantos[k], cantos[(k + 1) % 4]
        q = [V(xa, YK, za), V(xc, YK, zc), V(xc, YC, zc), V(xa, YC, za)]
        mid = V((xa + xc) / 2, 0, (za + zc) / 2)
        L = (V(xc, 0, zc) - V(xa, 0, za)).length
        M.face(q, [(0, 0), (L / 8, 0), (L / 8, 15 / 8), (0, 15 / 8)], -mid, mat)
        # anel de reforço na boca inferior do moonpool
        q2 = [V(xa, YK - .01, za), V(xc, YK - .01, zc), V(xc * 1.08, YK - .01, zc * 1.08), V(xa * 1.08, YK - .01, za * 1.08)]
        M.face(q2, [(0, 0)] * 4, V(0, -1, 0), mat)


def elipsoide(M, c, r, mat, n_lon=32, n_lat=16, alonga=1.):
    """Bulbo de proa: elipsoide com a frente (+X) mais afilada."""
    def P(i, j):
        th = math.pi * j / n_lat; ph = 2 * math.pi * i / n_lon
        x = math.cos(th); y = math.sin(th) * math.cos(ph); z = math.sin(th) * math.sin(ph)
        rx = r[0] * (alonga if x > 0 else 1)
        return V(c.x + rx * x, c.y + r[1] * y, c.z + r[2] * z)
    for j in range(n_lat):
        for i in range(n_lon):
            q = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)]
            nrm = sum(((p - c) for p in q), V(0, 0, 0))
            if j == 0: q = [q[0], q[2], q[3]]
            elif j == n_lat - 1: q = [q[0], q[1], q[2]]
            M.face(q, [uv_pint(p) for p in q], nrm, mat, True)


def torno(M, eixo_o, eixo_d, perfil, seg, mat, sinal=1, uvf=uv_pint, suave=True):
    """Superfície de revolução. perfil: [(posição no eixo, raio)]. sinal=-1 vira as normais para dentro."""
    d = eixo_d.normalized()
    a = d.cross(V(0, 1, 0)) if abs(d.y) < .9 else d.cross(V(1, 0, 0))
    a.normalize(); b = d.cross(a)
    def P(t, r, k):
        ang = 2 * math.pi * k / seg
        return eixo_o + d * t + (a * math.cos(ang) + b * math.sin(ang)) * r
    for j in range(len(perfil) - 1):
        (t0, r0), (t1, r1) = perfil[j], perfil[j + 1]
        for k in range(seg):
            q = [P(t0, r0, k), P(t0, r0, k + 1), P(t1, r1, k + 1), P(t1, r1, k)]
            ang = 2 * math.pi * (k + .5) / seg
            rad = (a * math.cos(ang) + b * math.sin(ang))
            if r0 < 1e-4: q = [q[0], q[2], q[3]]
            elif r1 < 1e-4: q = [q[0], q[1], q[2]]
            nrm = rad * sinal
            if abs(r1 - r0) > abs(t1 - t0) * 3:  # trecho quase plano (tampa): normal ao longo do eixo
                nrm = d * (1 if r1 < r0 else -1) * sinal
            M.face(q, [uvf(p) for p in q], nrm, mat, suave)


def thruster(M, x, z, az, mat_casco, mat_bronze):
    """Propulsor azimutal retrátil: coluna, pod, tubeira (Kort) e hélice de 4 pás."""
    R = Matrix.Rotation(az, 3, 'Y')  # rotação no Y do site
    o = V(x, YK, z)
    T = lambda p: o + R @ p
    yc = -3.1  # eixo do pod abaixo da quilha
    sub = Malha('tmp')
    torno(sub, V(0, .35, 0), V(0, -1, 0), [(0, 1.5), (.25, 1.1), (.6, .78), (2.6, .7), (2.95, .74)], 18, 0)
    torno(sub, V(-2.2, yc, 0), V(1, 0, 0), [(0, 0), (.35, .55), (.9, .82), (3.2, .85), (3.9, .55), (4.2, .25), (4.3, 0)], 18, 0)
    # tubeira: casca externa, interna e bordas
    t0, t1 = .9, 3.4
    torno(sub, V(0, yc, 0), V(1, 0, 0), [(t0, 2.0), (t0 + .5, 2.22), (t1, 2.0)], 28, 0, 1)
    torno(sub, V(0, yc, 0), V(1, 0, 0), [(t0, 2.0), (t0 + .4, 1.88), (t1, 1.9)], 28, 0, -1)
    # suportes da tubeira
    for ang in (0, math.pi / 2, math.pi, 3 * math.pi / 2):
        c, s = math.cos(ang), math.sin(ang)
        for k in (-1, 1):
            pa = V(t0 + 1.2 + k * .5, yc + .9 * c, .9 * s); pb = V(t0 + 1.2 + k * .5, yc + 1.9 * c, 1.9 * s)
            off = V(0, -s, c) * .06
            sub.face([pa - off, pb - off, pb + off, pa + off], [uv_pint(V(0, -8, 0))] * 4, V(1, 0, 0) * k, 0)
    for f in sub.f:
        pts = [T(sub.v[i]) for i in f[0]]
        n = (pts[1] - pts[0]).cross(pts[2] - pts[0])
        M.face(pts, [uv_pint(p) for p in pts], n, mat_casco, f[3])
    # hélice (bronze): cubo + 4 pás finas torcidas, duas faces cada
    hub = Malha('tmp2')
    torno(hub, V(t0 + 1.0, yc, 0), V(1, 0, 0), [(0, 0), (.1, .45), (.8, .48), (1.2, 0)], 16, 0, uvf=lambda p: (0, 0))
    for f in hub.f:
        pts = [T(hub.v[i]) for i in f[0]]
        M.face(pts, [(0, 0)] * len(pts), (pts[1] - pts[0]).cross(pts[2] - pts[0]), mat_bronze, True)
    xp = t0 + 1.4
    for kb in range(4):
        base = kb * math.pi / 2 + az * .7
        cad = []
        for r in (.45, .9, 1.4, 1.82):
            ang = base; tw = .9 - .35 * r  # torção da pá
            cord = lerp(.55, .75, r / 1.8) * (1 - .35 * (r > 1.7))
            c, s = math.cos(ang), math.sin(ang)
            rad = V(0, c, s); tan = V(0, -s, c)
            ctr = V(xp, yc, 0) + rad * r
            ax = V(1, 0, 0) * math.cos(tw) + tan * math.sin(tw)
            cad.append((ctr - ax * cord / 2, ctr + ax * cord / 2))
        for k in range(len(cad) - 1):
            q = [cad[k][0], cad[k][1], cad[k + 1][1], cad[k + 1][0]]
            q = [T(p) for p in q]
            n = (q[1] - q[0]).cross(q[3] - q[0])
            M.face(q, [(0, 0)] * 4, n, mat_bronze, True)
            M.face(q, [(0, 0)] * 4, -n, mat_bronze, True)


def bolina(M, lado, mat):
    """Bolina (quilha de balanço) ao longo do bojo."""
    y = -6.35
    xs = [lerp(-42, 30, i / 36) for i in range(37)]
    for i in range(len(xs) - 1):
        pts = []
        for x in (xs[i], xs[i + 1]):
            fade = min(1., (x + 42) / 6, (30 - x) / 6)
            p = V(x, y, lado * hb(x, y) - lado * .05)
            d = V(0, -.55, lado * .84).normalized() * (.75 * fade)
            pts.append((p, p + d))
        q = [pts[0][0], pts[1][0], pts[1][1], pts[0][1]]
        n = (q[1] - q[0]).cross(q[3] - q[0])
        M.face(q, [uv_pint(p) for p in q], n, mat)
        M.face(q, [uv_pint(p) for p in q], -n, mat)


def disco_no_costado(M, x, y, lado, rx, ry, mats, aro=.1, fundo_off=.015, aro_off=.06, seg=18):
    """Peça redonda/oval no costado: aro saliente (mats[0]) e miolo escuro (mats[1])."""
    n = normal_costado(x, y, lado)
    p0 = V(x, y, lado * hb(x, y))
    t = V(1, 0, 0) - n * n.x; t.normalize()
    u = n.cross(t) if lado > 0 else t.cross(n)
    if u.y < 0: u = -u
    E = lambda a, k, off: p0 + n * off + t * math.cos(a) * (rx + k) + u * math.sin(a) * (ry + k)
    for i in range(seg):
        a0, a1 = 2 * math.pi * i / seg, 2 * math.pi * (i + 1) / seg
        # miolo
        M.face([p0 + n * fundo_off, E(a0, 0, fundo_off), E(a1, 0, fundo_off)], [(0, 0)] * 3, n, mats[1])
        # frente do aro
        q = [E(a0, 0, aro_off), E(a1, 0, aro_off), E(a1, aro, aro_off), E(a0, aro, aro_off)]
        M.face(q, [uv_pint(p) for p in q], n, mats[0], False)
        # lado externo do aro (até encostar no costado)
        q = [E(a0, aro, aro_off), E(a1, aro, aro_off), E(a1, aro, -.05), E(a0, aro, -.05)]
        rad = (E(a0, aro, 0) + E(a1, aro, 0)) / 2 - p0
        M.face(q, [uv_pint(p) for p in q], rad, mats[0], True)
        # lado interno do aro (até o miolo)
        q = [E(a0, 0, aro_off), E(a1, 0, aro_off), E(a1, 0, fundo_off), E(a0, 0, fundo_off)]
        M.face(q, [uv_pint(p) for p in q], -rad, mats[0], True)


def conves(D, NX=240, NS=24):
    xs, xb = xr(YC)
    x0 = xs + BORDA
    xx = sorted(set([lerp(x0, xb, i / NX) for i in range(NX + 1)] + [-MP, MP]))
    wd = lambda x: max(hb(x, YC) - BORDA, 0.)
    w0 = wd(0)
    ss = sorted(set([lerp(-1, 1, k / NS) for k in range(NS + 1)] + [-MP / w0, MP / w0]))
    for i in range(len(xx) - 1):
        xa, xc = xx[i], xx[i + 1]
        wa, wc = wd(xa), wd(xc)
        for k in range(len(ss) - 1):
            sa, sc = ss[k], ss[k + 1]
            if abs((xa + xc) / 2) < MP and abs((sa + sc) / 2 * w0) < MP: continue
            q = [V(xa, YC, sa * wa), V(xc, YC, sa * wc), V(xc, YC, sc * wc), V(xa, YC, sc * wa)]
            D.face(q, [(p.x / 8, p.z / 8) for p in q], V(0, 1, 0), 0)


def caixa(M, c, s, mat, uvf):
    x0, y0, z0 = c.x - s[0] / 2, c.y, c.z - s[2] / 2
    x1, y1, z1 = c.x + s[0] / 2, c.y + s[1], c.z + s[2] / 2
    F = [([(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)], V(0, 1, 0)),
         ([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], V(0, 0, 1)),
         ([(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)], V(0, 0, -1)),
         ([(x1, y0, z0), (x1, y0, z1), (x1, y1, z1), (x1, y1, z0)], V(1, 0, 0)),
         ([(x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0)], V(-1, 0, 0))]
    for q, n in F:
        q = [V(*p) for p in q]
        M.face(q, [uvf(p) for p in q], n, mat)


def cilindro(M, base, r, h, mat, seg=14):
    torno(M, base, V(0, 1, 0), [(0, r), (h, r), (h, 0)], seg, mat, uvf=lambda p: (p.x / 8, p.z / 8), suave=False)


def marcas_calado(M, mat):
    """Marcas de calado (metros a partir da quilha) na proa, meio-navio e popa, dos dois bordos."""
    fonte = bpy.data.curves.new('tmp_txt', 'FONT')
    fonte.size = .42; fonte.resolution_u = 2; fonte.fill_mode = 'BOTH'; fonte.align_y = 'BOTTOM'
    ob = bpy.data.objects.new('tmp_txt', fonte); bpy.context.scene.collection.objects.link(ob)
    glifos = {}
    for n in range(5, 15):
        fonte.size = .42 if n % 2 == 0 else .3
        fonte.body = '%dM' % n if n % 2 == 0 else str(n)
        dg = bpy.context.evaluated_depsgraph_get()
        me = ob.evaluated_get(dg).to_mesh()
        glifos[n] = ([v.co.copy() for v in me.vertices], [list(p.vertices) for p in me.polygons])
        ob.to_mesh_clear()
    bpy.data.objects.remove(ob); bpy.data.curves.remove(fonte)
    for x in (-74.5, -2, 47):
        for lado in (1, -1):
            for n, (vs, fs) in glifos.items():
                y = YK + n
                nrm = normal_costado(x, y, lado)
                t = V(lado, 0, 0) - nrm * (nrm.x * lado); t.normalize()
                up = V(0, 1, 0) - nrm * nrm.y; up.normalize()
                p0 = V(x, y, lado * hb(x, y)) + nrm * .02 - t * .2
                for f in fs:
                    pts = [p0 + t * vs[i].x + up * vs[i].y for i in f]
                    M.face(pts, [(0, 0)] * len(pts), nrm, mat)


def principal():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = 'METRIC'; sc.unit_settings.scale_length = 1

    m_casco = mat_tex('Casco', 'casco')
    m_conv = mat_tex('Conves', 'conves')
    m_bronze = mat_liso('Bronze', (.62, .42, .2), .32, 1.)
    m_marca = mat_liso('Marcas', (.86, .87, .86), .55)
    m_escuro = mat_liso('Escuro', (.012, .013, .015), .35)
    m_mp = mat_liso('Moonpool', (.16, .17, .17), .75, .2)

    C = Malha('Casco')
    costado(C); fundo(C); borda(C)
    moonpool(C, 3)
    elipsoide(C, V(55.8, -3.9, 0), (6.2, 2.9, 2.5), 0, n_lon=40, n_lat=20, alonga=1.25)
    for lado in (1, -1): bolina(C, lado, 0)
    # Propulsores, vigias, escovém/âncoras e defensas já vêm de shipDetail() (assets/js/detalhes3d.js):
    # não repetir aqui. thruster() fica disponível caso um dia eles saiam de lá.
    for lado in (1, -1):
        # olhais/fendas de amarração na borda
        for x in (63, 0, -40, -78):
            disco_no_costado(C, x, 8.85, lado, .55, .3, (0, 2), aro=.14, aro_off=.08)
    marcas_calado(C, 4)
    oc = C.criar([m_casco, m_bronze, m_escuro, m_mp, m_marca])

    D = Malha('Conves')
    conves(D)
    uvd = lambda p: (p.x / 8 + p.y / 8, p.z / 8)
    for (x, z) in [(18, 4), (-50, -6)]:  # tampas de escotilha no convés
        caixa(D, V(x, YC, z), (4, .55, 3), 0, uvd)
        caixa(D, V(x, YC + .55, z), (3.6, .08, 2.6), 0, uvd)
    for x in (63, 0, -40, -76):  # cabeços de amarração junto às fendas
        for lado in (1, -1):
            zb = lado * (hb(x, YC) - 2.2)
            caixa(D, V(x, YC, zb), (2.6, .25, 1.0), 0, uvd)
            for k in (-1, 1):
                cilindro(D, V(x + k * .7, YC + .25, zb), .28, .7, 0)
    od = D.criar([m_conv])

    # estatística
    dg = bpy.context.evaluated_depsgraph_get()
    tri = 0
    for o in (oc, od):
        me = o.evaluated_get(dg).data; me.calc_loop_triangles(); tri += len(me.loop_triangles)
        print('OBJ', o.name, len(me.loop_triangles), 'triângulos')
    print('TOTAL', tri)

    bpy.ops.wm.save_as_mainfile(filepath=BLEND, relative_remap=True, compress=True)
    bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', export_yup=True, export_apply=True,
                              export_texcoords=True, export_normals=True, export_tangents=False,
                              export_materials='EXPORT', export_image_format='AUTO',
                              export_cameras=False, export_lights=False, use_selection=False)
    print('GLB', os.path.getsize(GLB) // 1024, 'KB')


if __name__ == '__main__' and not os.environ.get('CASCO_SO_FUNCOES'):
    principal()
