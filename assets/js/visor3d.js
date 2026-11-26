// Visor 3D leve para painéis: carrega um GLB, gira sozinho e responde ao arraste/roda. Renderiza só enquanto visível.
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';   // modelos comprimidos (EXT_meshopt_compression)

const cache = {};
const carrega = u => cache[u] || (cache[u] = new Promise((ok, err) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(u, g => ok(g.scene), undefined, err)));

export function mountVisor(box, url, {reduced = false, onReady, onError} = {}) {
  const cv = document.createElement('canvas'); cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab;touch-action:none';
  box.appendChild(cv);
  const r = new THREE.WebGLRenderer({canvas: cv, antialias: true, alpha: true});
  r.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75)); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  const sc = new THREE.Scene(), pm = new THREE.PMREMGenerator(r); sc.environment = pm.fromScene(new RoomEnvironment(), .04).texture; pm.dispose();
  sc.add(new THREE.HemisphereLight(0xffffff, 0x445566, .8)); const dl = new THREE.DirectionalLight(0xffffff, 2); dl.position.set(3, 5, 4); sc.add(dl);
  const cam = new THREE.PerspectiveCamera(32, 1, .01, 500);
  let obj = null, rad = 1, az = .6, el = .18, dist = 3, drag = null, alive = true, vis = true, raf = 0;
  const mo = new IntersectionObserver(e => { vis = e[0].isIntersecting; }); mo.observe(box);
  const size = () => { const w = box.clientWidth, h = box.clientHeight; if (w && h && (cv.width !== Math.round(w * r.getPixelRatio()))) { r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); } };
  carrega(url).then(src => {
    if (!alive) return; obj = src.clone(true);
    const bb = new THREE.Box3().setFromObject(obj), c = bb.getCenter(new THREE.Vector3()), s = bb.getSize(new THREE.Vector3());
    obj.position.sub(c); sc.add(obj); rad = Math.max(s.x, s.y, s.z) * .5; dist = rad / Math.tan(THREE.MathUtils.degToRad(16)) * 1.25;
    onReady && onReady();
  }).catch(e => { onError && onError(e); });
  cv.addEventListener('pointerdown', e => { drag = {x: e.clientX, y: e.clientY, id: e.pointerId}; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; });
  cv.addEventListener('pointermove', e => { if (!drag || e.pointerId !== drag.id) return; az -= (e.clientX - drag.x) * .008; el = Math.max(-.3, Math.min(1.2, el + (e.clientY - drag.y) * .005)); drag.x = e.clientX; drag.y = e.clientY; });
  const up = e => { if (drag && e.pointerId === drag.id) { drag = null; cv.style.cursor = 'grab'; } }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); dist = Math.max(rad * 1.2, Math.min(rad * 8, dist * Math.exp(e.deltaY * .001))); }, {passive: false});
  const loop = t => {
    if (!alive) return; raf = requestAnimationFrame(loop); if (!vis || !obj || document.hidden) return; size();
    const a = az + (drag || reduced ? 0 : t * .00022), cp = Math.cos(el);
    cam.position.set(Math.sin(a) * cp * dist, Math.sin(el) * dist, Math.cos(a) * cp * dist); cam.lookAt(0, 0, 0); r.render(sc, cam);
  };
  raf = requestAnimationFrame(loop);
  return {
    dispose() { alive = false; cancelAnimationFrame(raf); mo.disconnect(); r.dispose(); r.forceContextLoss(); cv.remove(); }
  };
}
