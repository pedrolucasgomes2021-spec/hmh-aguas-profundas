/* Camada de detalhe dos equipamentos.
 *
 * Soma, sobre os materiais PBR existentes, desgaste e relevo reais (ambientCG, CC0) sem depender de UV:
 * as texturas são projetadas em 3D no espaço do objeto (triplanar), então valem para qualquer peça e a
 * padronagem é contínua entre peças mescladas e acompanha o objeto quando ele se move.
 *   - relevo fino (riscos, bolhas de tinta) ......... normais da textura
 *   - tinta lascada ................................. máscara da textura: metal à mostra, mais áspero e metálico
 *   - sujeira em grande escala e manchas verticais ... ruído procedural (sem textura)
 *   - incrustação marinha perto do fundo/linha d'água  ruído + altura no objeto
 * Todos os materiais compartilham o mesmo programa de shader (customProgramCacheKey), então a quantidade de
 * programas não cresce. As texturas começam planas e são trocadas depois, sem recompilar nada.
 */
import * as THREE from 'three';

const plano = () => { const t = new THREE.DataTexture(new Uint8Array([128, 128, 0, 255]), 1, 1); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; return t; };
const texPadrao = { paint: plano(), steel: plano() };
const usados = { paint: [], steel: [] };   // uniforms criados, para trocar a textura depois
export const detLevel = { value: 2 };       // 0 = só sujeira simples, 1 = + textura, 2 = + manchas verticais

export function setDetailTexture(kind, tex) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  texPadrao[kind] = tex;
  for (const u of usados[kind]) u.value = tex;
}

const VERT_DECL = 'varying vec3 vDetP;varying vec3 vDetN;varying vec3 vDetX;varying vec3 vDetY;varying vec3 vDetZ;';
const VERT_BODY = 'vDetP=transformed;vDetN=objectNormal;vDetX=normalMatrix*vec3(1.,0.,0.);vDetY=normalMatrix*vec3(0.,1.,0.);vDetZ=normalMatrix*vec3(0.,0.,1.);';

const FRAG_DECL = `
uniform sampler2D uDetT;uniform vec4 uDetA;uniform vec4 uDetB;uniform vec3 uDetC;uniform float uDetL;
varying vec3 vDetP;varying vec3 vDetN;varying vec3 vDetX;varying vec3 vDetY;varying vec3 vDetZ;
float dHash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float dNoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(dHash(i),dHash(i+vec3(1,0,0)),f.x),mix(dHash(i+vec3(0,1,0)),dHash(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(dHash(i+vec3(0,0,1)),dHash(i+vec3(1,0,1)),f.x),mix(dHash(i+vec3(0,1,1)),dHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float gChip,gGrime,gFoul;vec3 gDevV;
void detalhe(){
  gChip=0.;gDevV=vec3(0.);
  float g1=dNoise(vDetP*.07),g2=dNoise(vDetP*.32+7.);
  float streak=uDetL>1.5?dNoise(vDetP*vec3(.55,.05,.55)+3.):.5;
  gGrime=clamp(g1*.55+streak*.45,0.,1.);
  gFoul=(1.-smoothstep(-2.,uDetB.y,vDetP.y))*smoothstep(.3,.75,g1*.6+g2*.4)*uDetB.x;
  if(uDetL<.5)return;
  vec3 p=vDetP*uDetA.x;float nl=dot(vDetN,vDetN);vec3 nn=nl>1e-6?vDetN*inversesqrt(nl):vec3(0.,1.,0.);vec3 w=pow(abs(nn),vec3(6.));w/=max(w.x+w.y+w.z,1e-4);
  vec3 gx=dFdx(p),gy=dFdy(p);   // derivadas fora dos 'if', para o mipmap não quebrar nas emendas
  vec3 dev=vec3(0.);float m=0.;
  if(w.x>.04){vec3 t=textureGrad(uDetT,p.zy,gx.zy,gy.zy).rgb;dev+=w.x*vec3(0.,t.g*2.-1.,t.r*2.-1.);m+=w.x*t.b;}
  if(w.y>.04){vec3 t=textureGrad(uDetT,p.xz,gx.xz,gy.xz).rgb;dev+=w.y*vec3(t.r*2.-1.,0.,t.g*2.-1.);m+=w.y*t.b;}
  if(w.z>.04){vec3 t=textureGrad(uDetT,p.xy,gx.xy,gy.xy).rgb;dev+=w.z*vec3(t.r*2.-1.,t.g*2.-1.,0.);m+=w.z*t.b;}
  // o desgaste aparece onde a máscara é alta e mais onde a sujeira em grande escala também é (bordas e cantos gastam mais)
  gChip=smoothstep(.45,.75,m)*uDetA.z*(.55+gGrime*.9);
  gDevV=(vDetX*dev.x+vDetY*dev.y+vDetZ*dev.z)*uDetA.y;
}`;

function injetar(shader, mat, kind, par) {
  const u = { value: texPadrao[kind] };
  usados[kind].push(u);
  shader.uniforms.uDetT = u;
  shader.uniforms.uDetA = { value: new THREE.Vector4(par.escala, par.relevo, par.desgaste, par.sujeira) };
  shader.uniforms.uDetB = { value: new THREE.Vector4(par.incrustacao, par.altura, 0, 0) };
  shader.uniforms.uDetC = { value: new THREE.Color(par.metalAberto) };
  shader.uniforms.uDetL = detLevel;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\n' + VERT_DECL)
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_BODY);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\n' + FRAG_DECL)
    .replace('#include <color_fragment>', `#include <color_fragment>
      detalhe();
      diffuseColor.rgb*=1.-uDetA.w*(gGrime-.35);
      diffuseColor.rgb=mix(diffuseColor.rgb,mix(uDetC,vec3(.30,.14,.06),smoothstep(.4,.75,dNoise(vDetP*.16+11.))),gChip);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.13,.17,.07),gFoul*.65);`)
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor=clamp(roughnessFactor+(gGrime-.4)*.3+gChip*.25+gFoul*.4,.04,1.);`)
    .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
      metalnessFactor=mix(metalnessFactor,.85,gChip);`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      {vec3 nd=normal+gDevV;float l2=dot(nd,nd);if(l2>1e-6)normal=nd*inversesqrt(l2);}`);
  shader.fragmentShader = shader.fragmentShader.replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat*=1.-gChip;\n#endif');
}

const PARAMETROS = {
  paint: { escala: 1 / 15, relevo: 1.1, desgaste: .8, sujeira: .8, incrustacao: 1.1, altura: 16, metalAberto: 0x35383b },
  steel: { escala: 1 / 9, relevo: 1, desgaste: .8, sujeira: .85, incrustacao: .9, altura: 16, metalAberto: 0x2c2f32 }
};

export function applyDetail(mat, kind) {
  if (mat.userData.det) return;
  mat.userData.det = kind;
  const par = { ...PARAMETROS[kind], ...(mat.userData.detParam || {}) };   // ajustes por material (ex.: o casco)
  mat.onBeforeCompile = shader => injetar(shader, mat, kind, par);
  mat.customProgramCacheKey = () => 'detalhe-' + kind;
  mat.needsUpdate = true;
}

// aplica a todos os materiais PBR de equipamento (os criados por pbr(): têm o mapa de rugosidade "grime")
export function applyDetailToScene(root, grime) {
  const vistos = new Set();
  root.traverse(o => {
    if (!(o.isMesh || o.isInstancedMesh)) return;
    for (const m of [].concat(o.material)) {
      if (!m || vistos.has(m)) continue;
      vistos.add(m);
      if (!(m.isMeshStandardMaterial) || m.transparent || m.roughnessMap !== grime) continue;
      if (m.onBeforeCompile && m.onBeforeCompile.toString().length > 40) continue;
      applyDetail(m, (m.clearcoat > 0 || m.vertexColors) ? 'paint' : 'steel');
    }
  });
  return vistos.size;
}
