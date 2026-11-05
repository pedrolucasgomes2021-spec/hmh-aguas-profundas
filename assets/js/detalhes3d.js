/* Pacotes de detalhe 3D.
 *
 * Cada função devolve um Group próprio, que o app mescla (bake) à parte e liga ou desliga conforme a qualidade:
 * "A" aparece a partir do nível Alta (Full HD), "B" só no Ultra (4K). Assim as máquinas mais leves continuam
 * com o modelo base e o computador forte ganha centenas de peças extras sem custo de desenho (ficam mescladas por material).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { M, G, add, beamG, tubeG, mergeMesh, bolts, clean, V, lerp, rnd, clamp, pbr, SEABED, FRONT, BACK } from './kit.js';

const dobra = new THREE.MeshStandardMaterial({ color: 0x4a525a, metalness: .6, roughness: .5, side: THREE.DoubleSide });

// escada de marinheiro: dois montantes e degraus
function escada(parts, x, y0, y1, z, alongZ = false, w = 1.1) {
  const a = alongZ ? [x, z - w / 2] : [x - w / 2, z], b = alongZ ? [x, z + w / 2] : [x + w / 2, z];
  parts.push(beamG(V(a[0], y0, a[1]), V(a[0], y1, a[1]), .05, 5), beamG(V(b[0], y0, b[1]), V(b[0], y1, b[1]), .05, 5));
  for (let y = y0 + .45; y < y1; y += .45) parts.push(beamG(V(a[0], y, a[1]), V(b[0], y, b[1]), .035, 4));
}
// guarda-corpo ao longo de uma poligonal: duas réguas e montantes
function guardaCorpo(parts, P, y, alt = 1.1, passo = 2) {
  for (let i = 0; i < P.length - 1; i++) {
    for (const k of [.5, 1]) parts.push(beamG(P[i].clone().setY(y + alt * k), P[i + 1].clone().setY(y + alt * k), .04, 5));
    if (i % passo === 0) parts.push(beamG(P[i].clone().setY(y), P[i].clone().setY(y + alt), .045, 5));
  }
}

/* ======================= SONDA ======================= */
export function shipDetail(H) {
  const { hb, xr } = H;
  const A = new THREE.Group(), B = new THREE.Group();
  const aco = [], escuro = [];

  // propulsores azimutais sob o casco (posicionamento dinâmico): coluna, cápsula, bocal e hélice
  for (const [x, z, ang] of [[-66, 8, .3], [-66, -8, -.3], [-50, 9.5, 0], [-50, -9.5, 0], [30, 8.5, .2], [30, -8.5, -.2], [42, 5.5, 0], [42, -5.5, 0]]) {
    const t = new THREE.Group(); t.position.set(x, -7, z); t.rotation.y = ang; A.add(t);
    add(t, G.cyl(.9, 1.1, 1.5, 28), M.dark, [0, -.75, 0]);
    add(t, G.cyl(.95, .95, 3.1, 28), M.grey, [0, -2.1, 0], [0, 0, Math.PI / 2]);
    for (const s of [-1, 1]) add(t, G.sph(.95, 22), M.grey, [s * 1.55, -2.1, 0]);
    add(t, new THREE.CylinderGeometry(1.75, 1.75, 1.5, 44, 1, true), dobra, [2.2, -2.1, 0], [0, 0, Math.PI / 2]);
    for (let b = 0; b < 4; b++) add(t, G.box(.1, 1.55, .42), M.steel, [2.3, -2.1, 0], [b * Math.PI / 2 + .4, 0, 0]);
    add(t, G.cyl(.22, .22, .6, 12), M.dark, [2.45, -2.1, 0], [0, 0, Math.PI / 2]);
  }

  // defensas de borracha na lateral e cabeços no convés
  for (const k of [1, -1]) {
    for (let x = -70; x <= 52; x += 11.5) { const z = k * (hb(x, 3.4) + .38); add(A, G.cyl(.42, .42, 3.2, 14), M.rubber, [x, 3.4, z]); add(A, G.box(.14, 3.4, .5), M.dark, [x, 3.4, z - k * .32]); }
    for (let x = -70; x <= 50; x += 17) { const z = k * (hb(x, 9.6) - 1.0); add(A, G.cyl(.34, .46, .9, 12), M.dark, [x, 10.05, z]); add(A, G.sph(.5, 14), M.dark, [x, 10.65, z]); }
  }

  // âncoras no proa: escovém, haste, braços e patas
  for (const k of [1, -1]) {
    const x = 57, z = k * (hb(x, 6.2) + .55);
    add(A, G.cyl(.62, .62, 1.6, 16), M.dark, [x, 6.2, z], [Math.PI / 2, 0, 0]);
    const an = new THREE.Group(); an.position.set(x + .3, 5.2, z + k * .22); an.rotation.z = -.25; A.add(an);
    add(an, G.box(3.4, .3, .3), M.steel, [0, 0, 0]);
    add(an, G.box(.3, .3, 1.5), M.steel, [1.55, 0, 0]);
    for (const s of [-1, 1]) { add(an, G.box(1.5, .22, .42), M.steel, [1.75, -.3, s * .65], [0, 0, -.7]); add(an, G.box(.9, .14, .9), M.dark, [2.35, -.78, s * 1.05], [0, 0, -.7]); }
    add(an, G.cyl(.16, .16, 1.9, 10), M.steel, [-1.5, .3, 0], [Math.PI / 2, 0, 0]);
  }

  // guarda-corpo na plataforma de perfuração e plataforma de empilhamento no meio da torre
  { const P = [], s = 10.3;
    const c = [[-s, -s], [s, -s], [s, s], [-s, s], [-s, -s]];
    for (let e = 0; e < 4; e++) for (let i = 0; i < 7; i++) P.push(V(lerp(c[e][0], c[e + 1][0], i / 7), 17, lerp(c[e][1], c[e + 1][1], i / 7)));
    P.push(P[0].clone()); guardaCorpo(aco, P, 17.05, 1.15, 1); }
  { const y = 17 + 47 * .58, hw = lerp(7.4, 2.4, .58);
    add(A, G.box(hw * 2 + 1.2, .22, hw * 2 + 1.2), M.dark, [0, y, 0]);
    const P = []; const c = [[-hw - .6, -hw - .6], [hw + .6, -hw - .6], [hw + .6, hw + .6], [-hw - .6, hw + .6], [-hw - .6, -hw - .6]];
    for (let e = 0; e < 4; e++) for (let i = 0; i < 5; i++) P.push(V(lerp(c[e][0], c[e + 1][0], i / 5), y, lerp(c[e][1], c[e + 1][1], i / 5)));
    P.push(P[0].clone()); guardaCorpo(aco, P, y + .1, 1.05, 1);
    for (let i = -3; i <= 3; i++) escuro.push(beamG(V(i * .9, y + .3, -hw), V(i * .9, y + .3, hw * .3), .06, 4)); }
  escada(aco, 33.2, 8, 17.6, 6, true); escada(aco, 33.2, 8, 17.6, -6, true);

  // chaminés, luzes de navegação e faróis
  for (const z of [-6.2, 6.2]) { add(A, G.cyl(.95, 1.05, 4.6, 24), M.dark, [41, 22.5, z]); add(A, G.cyl(1.08, 1.08, .35, 24), M.black, [41, 24.95, z]); add(A, G.cyl(.7, .7, .2, 20), M.black, [41, 25.15, z]); }
  add(A, G.sph(.3, 12), M.ledR, [51.5, 21.9, -15.2]); add(A, G.sph(.3, 12), M.ledG, [51.5, 21.9, 15.2]);
  add(A, G.sph(.28, 12), M.lampW, [46, 31.1, 0]);
  for (const z of [-12, 12]) { add(A, G.cyl(.35, .35, .6, 14), M.dark, [52.8, 23.1, z]); add(A, G.cyl(.28, .28, .1, 14), M.lampW, [53.15, 23.1, z], [0, 0, Math.PI / 2]); }
  // luzes de borda da heliponto
  for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2 + Math.PI / 8; add(A, G.sph(.13, 8), i % 2 ? M.lampW : M.lampC, [68 + Math.cos(a) * 10.9, 23.65, Math.sin(a) * 10.9]); }
  // postes de iluminação do convés (acendem à noite com o material lampN)
  for (const k of [1, -1]) for (const x of [-72, -56, -40, -20, 14, 26]) { const z = k * (hb(x, 9.6) - 1.4); add(A, G.cyl(.07, .07, 3, 8), M.dark, [x, 11.2, z]); add(A, G.box(.6, .16, .34), M.lampN, [x, 12.8, z]); }
  A.add(mergeMesh(aco, M.white)); if (escuro.length) A.add(mergeMesh(escuro, M.dark));

  // Ultra: costuras do chapeamento (verticais e horizontais seguindo a curva do casco) e vigias
  const seams = [];
  for (const k of [1, -1]) {
    for (let x = -74; x <= 58; x += 8) { const pts = []; for (let y = -6; y <= 9.5; y += 2.6) pts.push([x, y, k * (hb(x, y) + .014)]); seams.push(tubeG(pts, .028, 4)); }
    for (const yy of [1.6, 4.4, 7.2]) { const [xs, xb] = xr(yy), pts = []; for (let x = xs + 2; x <= xb - 2; x += 6) pts.push([x, yy, k * (hb(x, yy) + .014)]); seams.push(tubeG(pts, .03, 4)); }
    for (let x = 16; x <= 64; x += 3.2) { const z = k * (hb(x, 6.3) + .035); add(B, G.cyl(.28, .28, .1, 16), M.glass, [x, 6.3, z], [Math.PI / 2, 0, 0]); add(B, G.tor(.32, .05, 18), M.steel, [x, 6.3, z]); }
  }
  B.add(mergeMesh(seams, M.dark));
  return { A, B };
}

/* ======================= BOP ======================= */
export function bopDetail({ ramYs, top, fy0, fy1 }) {
  const A = new THREE.Group(), B = new THREE.Group();
  const cores = [M.blue, M.yellow, M.orange, M.white];
  // parafusos nas flanges entre os conjuntos de gavetas
  ramYs.forEach(y => { bolts(A, 3.05, 24, [0, y + 2.84, 0], M.steel, 'y', .1, .26); bolts(A, 3.05, 24, [0, y + 2.06, 0], M.steel, 'y', .1, .26); });
  // painéis de "hot stab" no quadro, com receptáculos coloridos
  for (const [x, yy] of [[8.6, ramYs[0] + 1], [-8.6, ramYs[0] + 1], [8.6, ramYs[1] + 1], [-8.6, ramYs[1] + 1]]) {
    add(A, G.rbox(1.9, 1.3, .2, .05), M.dark, [x, yy, 6.18]);
    for (let i = 0; i < 6; i++) add(A, G.cyl(.13, .13, .22, 10), cores[i % 4], [x - .6 + (i % 3) * .6, yy + (i < 3 ? .3 : -.3), 6.34], [Math.PI / 2, 0, 0]);
  }
  // linhas hidráulicas coloridas dos pods até as gavetas
  for (const k of [-1, 1]) for (let r = 0; r < ramYs.length; r++) for (let c = 0; c < 4; c++) {
    const y0 = ramYs[Math.min(1, ramYs.length - 1)] + .6 + c * .32, y1 = ramYs[r] + .5 + c * .36;
    A.add(new THREE.Mesh(tubeG([[k * 10.4, y0, -5.9], [k * 9.1, y0 + .3, -3.4], [k * 7.5, y1 + .4, -1.9], [k * 6.6, y1, -1.2]], .085, 5), cores[c]));
  }
  // anodos de sacrifício e olhais de içamento
  for (const [x, z] of [[8.6, 5.6], [-8.6, 5.6], [8.6, -5.6], [-8.6, -5.6]]) for (const yy of [fy0 + 2.2, (fy0 + fy1) / 2, fy1 - 1.4]) add(A, G.rbox(.9, .5, .5, .06), M.steel, [x * 1.05, yy, z * 1.05]);
  for (const [x, z] of [[10.4, 7], [-10.4, 7], [10.4, -7], [-10.4, -7]]) add(A, G.tor(.42, .1, 14), M.steel, [x, 2.4, z], [Math.PI / 2, 0, 0]);
  // placa com o logotipo da HMH na frente do quadro
  add(A, G.box(3.4, 3.4 * 172 / 544, .12), M.sign, [0, fy0 + 2.9, 5.98]);
  // Ultra: caixas de junção, cabos e travas nas gavetas
  for (const k of [-1, 1]) { add(B, G.rbox(1.6, 1.2, 1, .1), M.dark, [k * 6.9, ramYs[0] - 1.1, -6.2]); B.add(new THREE.Mesh(tubeG([[k * 6.9, ramYs[0] - .5, -6.2], [k * 7.8, ramYs[0] + 1.5, -6.9], [k * 10.1, ramYs[1] - .6, -6.4]], .1, 5), M.rubber)); }
  ramYs.forEach(y => { for (const k of [-1, 1]) bolts(B, 1.5, 10, [k * 8.0, y, 0], M.steel, 'x', .09, .5); });
  return { A, B };
}

/* ======================= RISER ======================= */
export function riserDetail(L) {
  const g = new THREE.Group(), h = L * .62;
  add(g, G.cyl(2.95, 2.95, h, 56), M.orange, [0, 0, 0]);
  for (const k of [-1, 1]) add(g, G.cyl(3.08, 3.08, .35, 56), M.dark, [0, k * h / 2, 0]);
  for (const y of [-h * .33, 0, h * .33]) add(g, G.cyl(3.0, 3.0, .24, 56), M.black, [0, y, 0]);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; add(g, G.rbox(.4, .6, .4, .08), M.steel, [Math.cos(a) * 3.05, h / 2 - .5, Math.sin(a) * 3.05]); }
  return g;
}

/* ======================= FUNDO DO MAR ======================= */
export function seabedDetail() {
  const A = new THREE.Group(), B = new THREE.Group();
  const livre = (x, z) => !(Math.abs(x) < 30 && z > -34) && !(Math.hypot(x - 36, z + 34) < 16) && !(Math.hypot(x + 34, z + 60) < 16);
  // pedras pequenas variadas (cor por instância)
  const mkRocks = (n, sMin, sMax, grupo) => {
    const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), M.rock, n), d = new THREE.Object3D(), c = new THREE.Color();
    for (let i = 0; i < n; i++) { let x, z; do { x = (rnd() * 2 - 1) * 185; z = BACK + 4 + rnd() * (FRONT - BACK - 10); } while (!livre(x, z));
      const s = lerp(sMin, sMax, rnd() ** 2); d.position.set(x, SEABED + s * .18, z); d.scale.set(s * (1 + rnd() * .6), s * .5, s * (.8 + rnd() * .5)); d.rotation.set(rnd() * .5, rnd() * 6, rnd() * .5); d.updateMatrix(); im.setMatrixAt(i, d.matrix);
      im.setColorAt(i, c.setHSL(.07 + rnd() * .05, .12 + rnd() * .15, .22 + rnd() * .22)); }
    im.castShadow = im.receiveShadow = true; grupo.add(im);
  };
  mkRocks(140, .18, .8, A); mkRocks(260, .08, .35, B);
  // vermes tubulares e coral em tufos, concentrados perto das estruturas
  const tufos = (n, grupo) => {
    const tubos = [], rosa = [];
    for (let i = 0; i < n; i++) { const perto = rnd() < .55, cx = perto ? (rnd() < .5 ? 36 : -34) + (rnd() * 2 - 1) * 20 : (rnd() * 2 - 1) * 170, cz = perto ? (rnd() < .5 ? -34 : -60) + (rnd() * 2 - 1) * 14 : BACK + 8 + rnd() * 100;
      if (!livre(cx, cz)) continue;
      for (let k = 0; k < 12; k++) { const a = rnd() * 6.28, r = rnd() * .7, hgt = .45 + rnd() * 1.1, g = new THREE.CylinderGeometry(.03, .075, hgt, 5); g.translate(0, hgt / 2, 0);
        g.rotateZ((rnd() - .5) * .7); g.rotateX((rnd() - .5) * .7); g.translate(cx + Math.cos(a) * r, SEABED, cz + Math.sin(a) * r); (rnd() < .6 ? tubos : rosa).push(g); } }
    if (tubos.length) grupo.add(mergeMesh(tubos, M.white)); if (rosa.length) grupo.add(mergeMesh(rosa, pbr(0xe98a6c, .05, .6)));
  };
  tufos(26, A); tufos(40, B);
  // duto submarino com revestimento de concreto, juntas, anodos e a estrutura final (PLEM) + umbilical
  { const z = -95, y = SEABED + .95, x0 = -186, x1 = -68, tubo = [], concreto = [], aneis = [];
    tubo.push(new THREE.CylinderGeometry(.82, .82, x1 - x0, 24).rotateZ(Math.PI / 2).translate((x0 + x1) / 2, y, z));
    for (let x = x0 + 8; x < x1 - 8; x += 11.8) { concreto.push(new THREE.CylinderGeometry(1.0, 1.0, 6.2, 28).rotateZ(Math.PI / 2).translate(x, y, z)); aneis.push(new THREE.TorusGeometry(.92, .07, 8, 24).rotateY(Math.PI / 2).translate(x + 3.4, y, z)); }
    for (let x = x0 + 20; x < x1 - 20; x += 35) aneis.push(new THREE.TorusGeometry(1.08, .16, 8, 24).rotateY(Math.PI / 2).translate(x, y, z));
    A.add(mergeMesh(tubo, M.steel), mergeMesh(concreto, M.cement), mergeMesh(aneis, M.grey));
    const fr = []; const P = (a, b, c) => V(a, b, c);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) fr.push(beamG(P(x1 + 2 + sx * 3, SEABED, z + sz * 2.2), P(x1 + 2 + sx * 3, SEABED + 3, z + sz * 2.2), .16, 8));
    for (const yy of [SEABED + .4, SEABED + 3]) { fr.push(beamG(P(x1 - 1, yy, z - 2.2), P(x1 + 5, yy, z - 2.2), .14, 8), beamG(P(x1 - 1, yy, z + 2.2), P(x1 + 5, yy, z + 2.2), .14, 8), beamG(P(x1 - 1, yy, z - 2.2), P(x1 - 1, yy, z + 2.2), .14, 8), beamG(P(x1 + 5, yy, z - 2.2), P(x1 + 5, yy, z + 2.2), .14, 8)); }
    A.add(mergeMesh(fr, M.yellow));
    add(A, G.cyl(.7, .7, 3.2, 20), M.red, [x1 + 2, SEABED + 1.6, z]);
    const v = new THREE.Mesh(tubeG([[-34, SEABED + .4, -60], [-44, SEABED + .25, -70], [-56, SEABED + .3, -80], [x1 + 3, SEABED + .5, z + 1]], .2, 8), M.orange); A.add(v);
  }
  return { A, B };
}

/* ======================= ÁGUAS-VIVAS ======================= */
export function makeJellyfish(n = 9) {
  const group = new THREE.Group(), bellMat = new THREE.MeshStandardMaterial({ color: 0xbcd9ff, emissive: 0x4a78b8, emissiveIntensity: .45, roughness: .25, metalness: 0, transparent: true, opacity: .5, depthWrite: false, side: THREE.DoubleSide });
  const tentMat = new THREE.MeshStandardMaterial({ color: 0xd6e8ff, emissive: 0x4a78b8, emissiveIntensity: .35, roughness: .4, transparent: true, opacity: .55, depthWrite: false });
  const unit = [];
  for (let i = 0; i < n; i++) {
    const j = new THREE.Group(), s = .7 + rnd() * .9;
    const bell = new THREE.Mesh(new THREE.SphereGeometry(1.5, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), bellMat); bell.scale.set(1, .75, 1); j.add(bell);
    const tg = []; for (let k = 0; k < 14; k++) { const a = k / 14 * 6.28, r = .55 + rnd() * .7, len = 2.2 + rnd() * 2.6, g = new THREE.CylinderGeometry(.03, .015, len, 5); g.translate(0, -len / 2, 0); g.rotateZ((rnd() - .5) * .25); g.translate(Math.cos(a) * r, 0, Math.sin(a) * r); tg.push(g); }
    const ten = new THREE.Mesh(mergeGeometries(tg.map(clean)), tentMat); j.add(ten);
    j.scale.setScalar(s); group.add(j);
    unit.push({ j, bell, ten, x: (rnd() * 2 - 1) * 150, y: -40 - rnd() * 130, z: -70 + rnd() * 70, ph: rnd() * 6.28, sp: .6 + rnd() * .8, s });
  }
  const update = t => { for (const u of unit) { const p = Math.sin(t * u.sp * 1.6 + u.ph); u.bell.scale.set(1 + p * .1, .75 - p * .16, 1 + p * .1); u.ten.scale.y = 1 + p * .12;
    u.j.position.set(u.x + Math.sin(t * .06 * u.sp + u.ph) * 22, u.y + Math.sin(t * .2 + u.ph) * 5 + p * .6, u.z); u.j.rotation.z = Math.sin(t * .15 + u.ph) * .08; } };
  update(0);
  return { group, update };
}
