// Base compartilhada: constantes do diorama, utilitários de geometria, texturas e materiais (paleta HMH, PBR).
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// geometria do diorama (unidades de cena; a profundidade real é mostrada no medidor)
export const SEABED=-200,GBOT=-390,GH=SEABED-GBOT,FRONT=20,BACK=-120,HALFW=200,SLOT=5;
export const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v)),lerp=(a,b,t)=>a+(b-a)*t,smooth=t=>{t=clamp(t);return t*t*(3-2*t)};
export const UP=new THREE.Vector3(0,1,0),ONE=new THREE.Vector3(1,1,1),V=(x,y,z)=>new THREE.Vector3(x,y,z);
let seed=7;export const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
export const ZR=[0,0,Math.PI/2];
// mesma fórmula usada no shader do oceano (app.js)
export const wave=(x,z,t)=>.5*Math.sin(x*.045+t*.8)+.35*Math.sin(z*.06+t*1.05+1.3)+.18*Math.sin((x+z)*.11+t*1.6);

/* ---------- texturas procedurais ---------- */
export const TEXS=[];
export function ctex(w,h,draw,{repeat=[1,1],color=true,wrap=true}={}){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);if(color)t.colorSpace=THREE.SRGBColorSpace;if(wrap)t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(...repeat);TEXS.push(t);return t}
export const grime=ctex(256,256,(g,w,h)=>{g.fillStyle='#cfcfcf';g.fillRect(0,0,w,h);for(let i=0;i<5000;i++){const v=150+rnd()*105|0;g.fillStyle=`rgba(${v},${v},${v},.35)`;g.fillRect(rnd()*w,rnd()*h,1+rnd()*4,1+rnd()*4)}},{color:false,repeat:[2,2]});
export const heliTex=ctex(512,512,(g)=>{g.fillStyle='#3e5048';g.fillRect(0,0,512,512);g.strokeStyle='#f2c230';g.lineWidth=18;g.beginPath();g.arc(256,256,160,0,7);g.stroke();g.strokeStyle='#fff';g.lineWidth=10;g.beginPath();g.arc(256,256,238,0,7);g.stroke();g.fillStyle='#fff';g.font='bold 210px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText('H',256,268)},{wrap:false});
export const pipeTex=ctex(64,64,(g)=>{g.fillStyle='#c4cbd0';g.fillRect(0,0,64,64);g.fillStyle='#6f7980';g.fillRect(0,0,12,64)},{repeat:[3,30]});
export const dotTex=ctex(64,64,g=>{const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.35,'rgba(255,255,255,.5)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,64,64)},{wrap:false});
export const rayTex=ctex(64,256,(g,w,h)=>{const r=g.createLinearGradient(0,0,0,h);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,w,h);const s=g.createLinearGradient(0,0,w,0);s.addColorStop(0,'rgba(0,0,0,1)');s.addColorStop(.5,'rgba(0,0,0,0)');s.addColorStop(1,'rgba(0,0,0,1)');g.globalCompositeOperation='destination-out';g.fillStyle=s;g.fillRect(0,0,w,h)},{wrap:false});
export const shadowTex=ctex(256,256,g=>{const r=g.createRadialGradient(128,128,0,128,128,128);r.addColorStop(0,'rgba(0,0,0,.55)');r.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=r;g.fillRect(0,0,256,256)},{wrap:false});
// espuma em volta do casco (ruído com transparência)
export const foamTex=ctex(512,512,(g,w,h)=>{g.clearRect(0,0,w,h);for(let i=0;i<2600;i++){const x=rnd()*w,y=rnd()*h,r=1+rnd()*7;const a=rnd()*.5;const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,`rgba(255,255,255,${a})`);gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(x-r,y-r,r*2,r*2)}},{repeat:[8,2]});

/* ---------- materiais (paleta HMH) ---------- */
export const pbr=(color,metal,rough,o={})=>new THREE.MeshPhysicalMaterial({color,metalness:metal,roughness:rough,roughnessMap:grime,...o});
const TL=new THREE.TextureLoader();
export const signTex=TL.load('assets/img/hmh-logo-placa.png');signTex.colorSpace=THREE.SRGBColorSpace;
export const M={
 red:pbr(0xb51f2a,.2,.55,{clearcoat:.35,clearcoatRoughness:.35}),yellow:pbr(0xe7aa12,.2,.55,{clearcoat:.3,clearcoatRoughness:.4}),blue:pbr(0x1d4f8c,.25,.55,{clearcoat:.3,clearcoatRoughness:.35}),
 white:pbr(0xe9ecee,.1,.6,{clearcoat:.2}),grey:pbr(0x9aa2a8,.55,.55),lattice:pbr(0xc9cdd0,.55,.55),steel:pbr(0xc9cfd4,.78,.34),
 chrome:new THREE.MeshPhysicalMaterial({color:0xf2f5f7,metalness:1,roughness:.07}),dark:pbr(0x353b41,.6,.6),black:pbr(0x15171a,.2,.75),rubber:pbr(0x2a2c2f,0,.9),hoseGrey:pbr(0x9aa0a5,0,.8),
 glass:new THREE.MeshPhysicalMaterial({color:0x1a2a38,metalness:.4,roughness:.06,clearcoat:1,emissive:0xffcf8a,emissiveIntensity:0}),orange:pbr(0xff6a13,.1,.55,{clearcoat:.4}),
 deck:new THREE.MeshStandardMaterial({color:0x6b706d,roughness:.9,metalness:.3,roughnessMap:grime}),
 wall:new THREE.MeshStandardMaterial({color:0xe8ebec,roughness:.7,metalness:.3}),
 hull:new THREE.MeshPhysicalMaterial({vertexColors:true,metalness:.25,roughness:.55,roughnessMap:grime,clearcoat:.35,clearcoatRoughness:.3}),
 heli:new THREE.MeshStandardMaterial({map:heliTex,roughness:.85}),sign:new THREE.MeshStandardMaterial({map:signTex,roughness:.5}),
 lampW:new THREE.MeshBasicMaterial({color:0xffffff,fog:false}),lampC:new THREE.MeshBasicMaterial({color:0xaef4ff,fog:false}),lampN:new THREE.MeshBasicMaterial({color:0x8a8f94,fog:false}),
 ledR:new THREE.MeshBasicMaterial({color:0xff3030,fog:false}),ledG:new THREE.MeshBasicMaterial({color:0x40ff70,fog:false}),
 pipe:new THREE.MeshStandardMaterial({map:pipeTex,metalness:.9,roughness:.3}),
 cement:new THREE.MeshStandardMaterial({color:0xcfc2a6,roughness:.95}),rock:new THREE.MeshStandardMaterial({color:0x5a5047,roughness:1}),seabed:new THREE.MeshStandardMaterial({color:0xb7a789,roughness:1})};
// gavetas do BOP principal com material próprio, para o destaque no "Como funciona"
M.ramBody=M.yellow.clone();M.ramBon=M.red.clone();
export const PAINTED=[M.red,M.yellow,M.blue,M.white,M.grey,M.lattice,M.hull,M.dark,M.ramBody,M.ramBon];

/* ---------- utilitários de geometria ---------- */
export const G={box:(w,h,d)=>new THREE.BoxGeometry(w,h,d),rbox:(w,h,d,r=.15)=>new RoundedBoxGeometry(w,h,d,3,Math.min(r,Math.min(w,h,d)/2-.01)),cyl:(a,b,h,s=32)=>new THREE.CylinderGeometry(a,b,h,s),tor:(R,r,s=48)=>new THREE.TorusGeometry(R,r,12,s),sph:(r,s=32)=>new THREE.SphereGeometry(r,s,Math.max(12,s/2))};
export function add(p,geo,mat,pos=[0,0,0],rot=[0,0,0],scl){const m=new THREE.Mesh(geo,mat);m.position.set(...pos);m.rotation.set(...rot);if(scl)m.scale.set(...scl);p.add(m);return m}
export function beamG(a,b,r,s=8){const v=new THREE.Vector3().subVectors(b,a);const L=v.length();const g=new THREE.CylinderGeometry(r,r,L,s,1);g.applyMatrix4(new THREE.Matrix4().compose(a.clone().lerp(b,.5),new THREE.Quaternion().setFromUnitVectors(UP,v.normalize()),ONE));return g}
export function tubeG(pts,r,rs=12){const c=new THREE.CatmullRomCurve3(pts.map(p=>V(...p)),false,'centripetal');return new THREE.TubeGeometry(c,Math.max(24,pts.length*16),r,rs,false)}
export function clean(g){g=g.index?g.toNonIndexed():g;for(const k of Object.keys(g.attributes))if(!['position','normal','uv'].includes(k))g.deleteAttribute(k);if(!g.attributes.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));return g}
export function mergeMesh(geos,mat){return new THREE.Mesh(mergeGeometries(geos.map(clean)),mat)}
export function bolts(p,R,n,c,mat=M.steel,axis='y',r=.12,h=.4){const g=G.cyl(r,r,h,8);if(axis==='x')g.rotateZ(Math.PI/2);const im=new THREE.InstancedMesh(g,mat,n);const d=new THREE.Object3D();
 for(let i=0;i<n;i++){const a=i/n*Math.PI*2;if(axis==='y')d.position.set(c[0]+Math.cos(a)*R,c[1],c[2]+Math.sin(a)*R);else d.position.set(c[0],c[1]+Math.cos(a)*R,c[2]+Math.sin(a)*R);d.updateMatrix();im.setMatrixAt(i,d.matrix)}p.add(im);return im}

// Junta todas as peças fixas de um conjunto em uma malha por material (de centenas para dezenas de chamadas de desenho).
// Grupos, âncoras e partes animadas (skip) continuam intactos.
export function bake(root,skip=[]){root.updateMatrixWorld(true);const inv=new THREE.Matrix4().copy(root.matrixWorld).invert(),by=new Map(),dead=[],m4=new THREE.Matrix4();
 root.traverse(o=>{if(!o.isMesh||Array.isArray(o.material))return;const mt=o.material;if(mt.transparent||mt.isShaderMaterial||mt.vertexColors||mt.clippingPlanes)return;
  for(let p=o;p&&p!==root;p=p.parent)if(skip.includes(p))return;
  const rel=new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld),list=by.get(mt)||by.set(mt,[]).get(mt);
  if(o.isInstancedMesh){for(let i=0;i<o.count;i++){o.getMatrixAt(i,m4);list.push(clean(o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(rel,m4))))}}else list.push(clean(o.geometry.clone().applyMatrix4(rel)));dead.push(o)});
 dead.forEach(o=>o.parent.remove(o));
 for(const[mat,geos]of by){const m=new THREE.Mesh(mergeGeometries(geos),mat);m.castShadow=m.receiveShadow=true;m.userData.baked=1;root.add(m)}
 return by.size}
// instancia um conjunto inteiro N vezes (usado nas juntas do riser)
export function instancify(group,count,parent){group.updateMatrixWorld(true);const by=new Map(),m4=new THREE.Matrix4();
 group.traverse(o=>{if(!o.isMesh)return;const list=by.get(o.material)||by.set(o.material,[]).get(o.material);
  if(o.isInstancedMesh){for(let i=0;i<o.count;i++){o.getMatrixAt(i,m4);list.push(clean(o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(o.matrixWorld,m4))))}}else list.push(clean(o.geometry.clone().applyMatrix4(o.matrixWorld)))});
 const ims=[];for(const[mat,geos]of by){const im=new THREE.InstancedMesh(mergeGeometries(geos),mat,count);im.frustumCulled=false;im.castShadow=im.receiveShadow=true;parent.add(im);ims.push(im)}
 return{set:(i,m)=>ims.forEach(im=>im.setMatrixAt(i,m)),done:()=>ims.forEach(im=>im.instanceMatrix.needsUpdate=true)}}
