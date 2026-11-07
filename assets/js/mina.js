// HMH — Versão Mineração: mina a céu aberto em 3D com os equipamentos HMH em operação.
// Desempenho: geometria estática mesclada por material (poucas chamadas de desenho), instâncias para árvores, pedras e minério,
// sem pós-processamento (sem buffers de ponto flutuante), sombras que seguem a vista e qualidade automática pelo FPS.
import * as THREE from 'three';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';
import {SSAOPass} from './ssao.js';
import {mountVisor} from './visor3d.js';

const $=s=>document.querySelector(s);
const store={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}}};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t,smooth=t=>t*t*(3-2*t),pad=n=>String(n).padStart(2,'0');
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
let L=store.get('hmh-lang')==='en'?'en':'pt';

// ---------------------------------------------------------------- textos
const TX={
 pt:{deep:'Águas profundas',introSub:'Mina a céu aberto · equipamentos HMH em operação · em 3D',prep:'Preparando a cena…',go:'Iniciar',toDeep:'Ver versão Águas Profundas',
  auto:'Automática',q:['Baixa','Média','Alta (Full HD)','Ultra (4K)'],res:'Resolução interna',fps:'qps',site:'Ver em hmhw.com ↗',video:'Vídeo ▶',fechar:'Fechar',
  ant:'Seção anterior',prox:'Próxima seção',lang:'EN',langNome:'English',ilustr:'Contexto da operação (ilustrativo)',qual:'Qualidade',qf:['FXAA · sombras 1024','SMAA · sombras 2048','+ AO · detalhes A · HD','+ 4K · detalhes B'],fotos:'Fotos',modelo3d:'Modelo 3D',mdInterp:'Modelo 3D interpretado a partir das fotos HMH, não é CAD oficial. Arraste para girar.',fluxo:'Fluxo do processo',zoomOut:'Visão geral',mapa:'Mapa da operação',dica:'Arraste para girar · role para aproximar · clique numa operação',eq:'Equipamentos',eqT:'Equipamentos HMH na mineração',eqS:'A linha HMH usada em operações de mineração em terra. Clique para ver o equipamento trabalhando na cena, com fotos e vídeo.'},
 en:{deep:'Deep water',introSub:'Open-pit mine · HMH equipment in operation · in 3D',prep:'Preparing the scene…',go:'Start',toDeep:'See the Deep Water version',
  auto:'Automatic',q:['Low','Medium','High (Full HD)','Ultra (4K)'],res:'Internal resolution',fps:'fps',site:'Open on hmhw.com ↗',video:'Video ▶',fechar:'Close',
  ant:'Previous section',prox:'Next section',lang:'PT',langNome:'Português',ilustr:'Operation context (illustrative)',qual:'Quality',qf:['MSAA · shadows 1024','SMAA · shadows 2048','+ AO · details A · HD','+ 4K · details B'],fotos:'Photos',modelo3d:'3D model',mdInterp:'3D model interpreted from HMH photos, not official CAD. Drag to rotate.',fluxo:'Process flow',zoomOut:'Overview',mapa:'Operation map',dica:'Drag to orbit · scroll to zoom · click an operation',eq:'Equipment',eqT:'HMH equipment for mining',eqS:'The HMH line used in onshore mining operations. Click to see the equipment working in the scene, with photos and video.'}};
const U=k=>TX[L][k];

const SECS=[
 {pt:{tab:'Visão geral',eb:'01 · Visão geral · Cava a céu aberto',t:'Mineração em terra',p:'Uma mina a céu aberto em bancadas, com a linha HMH em operação: perfuração de poço vertical, desaguamento, alimentação de autoclave, bombeamento de slurry e fundações. Clique numa operação no mapa ou na cena para aproximar, ligue o fluxo do processo ou abra “Equipamentos”.'},
  en:{tab:'Overview',eb:'01 · Overview · Open pit',t:'Onshore mining',p:'A benched open-pit mine with the HMH line at work: shaft boring, mine dewatering, autoclave feed, slurry pumping and foundations. Click an operation on the map or in the scene to zoom in, turn on the process flow, or open “Equipment”.'},prods:['mining']},
 {pt:{tab:'Poço vertical',eb:'02 · Perfuração · Poço vertical',t:'Perfuração de poço (blind shaft boring)',p:'A sonda da linha L abre, a partir da superfície, um poço vertical de grande diâmetro com até 1.000 m de profundidade, para acesso, ventilação ou içamento. A unidade hidráulica (HPU) fornece a potência.'},
  en:{tab:'Shaft',eb:'02 · Drilling · Vertical shaft',t:'Blind shaft boring',p:'From the surface, the L-range rig bores a large-diameter vertical shaft up to 1,000 m deep, for access, ventilation or hoisting. The hydraulic power unit (HPU) supplies the power.'},prods:['blind','hpu']},
 {pt:{tab:'Cava',eb:'03 · Cava · Praça e bancadas',t:'Escavação e desaguamento',p:'Na praça da cava, a escavadeira carrega os caminhões que sobem pelas bancadas. Uma bomba Wirth TPM tira a água abrasiva do fundo da cava e a leva até a superfície.'},
  en:{tab:'Pit',eb:'03 · Pit · Floor and benches',t:'Digging and dewatering',p:'On the pit floor the shovel loads trucks that climb the benches. A Wirth TPM pump lifts abrasive water from the bottom of the pit to the surface.'},prods:['dewater','ctxHaul']},
 {pt:{tab:'Planta',eb:'04 · Planta · Britagem, correia e autoclave',t:'Beneficiamento e autoclave',p:'O minério britado segue pela correia até a planta e vira slurry. Na lixiviação ácida sob pressão (HPAL), as bombas Wirth de alimentação de autoclave injetam o slurry quente, a até 240 °C.'},
  en:{tab:'Plant',eb:'04 · Plant · Crushing, conveyor and autoclave',t:'Processing and autoclave',p:'Crushed ore rides the conveyor to the plant and becomes slurry. In high-pressure acid leaching (HPAL), Wirth autoclave feed pumps inject the hot slurry at up to 240 °C.'},prods:['autoclave','ctxPlant']},
 {pt:{tab:'Slurry',eb:'05 · Bombeamento · Mineroduto',t:'Bombeamento de slurry',p:'Na estação, uma bomba triplex Wirth TPM e uma duplex Wirth DPM movem o slurry abrasivo em alta pressão pela tubulação até a barragem de rejeitos. Potências de até 3.000 kW.'},
  en:{tab:'Slurry',eb:'05 · Pumping · Pipeline',t:'Slurry pumping',p:'At the station a Wirth TPM triplex and a Wirth DPM duplex pump move abrasive slurry at high pressure down the pipeline to the tailings pond. Power ratings up to 3,000 kW.'},prods:['tpm','dpm']},
 {pt:{tab:'Fundações',eb:'06 · Construção · Fundações',t:'Fundações da planta',p:'A perfuratriz de topo de estaca (PBA), montada sobre o revestimento, perfura pelo método de circulação reversa (RCD) as estacas de 0,6 a 8,5 m que sustentam as estruturas pesadas da mina.'},
  en:{tab:'Foundations',eb:'06 · Construction · Foundations',t:'Plant foundations',p:'Mounted on the casing, the pile top drill rig (PBA) uses reverse circulation drilling (RCD) to drill the 0.6 to 8.5 m piles that carry the mine’s heavy structures.'},prods:['pba','tools','hpu5']}];

const BASE='https://hmhw.com',CONSTR='/archives/business_area/hmh-construction-equipment-portfolio/',SLURRY='/service/slurry-pumps/',RCDU='/service/rcd-rigs-pile-top-drill-rigs/';
const HPU={u:CONSTR,f:['HPU-copy-02c329ec.webp'],pt:{n:'Hydraulic Power Unit (HPU)',c:'Unidades hidráulicas',d:'Unidades de potência hidráulica para sondas e equipamentos auxiliares: de unidades compactas para um só equipamento a unidades em anel para várias operações simultâneas, com operação precisa.'},en:{n:'Hydraulic Power Unit (HPU)',c:'Hydraulic power',d:'Hydraulic power units for rigs and auxiliary equipment: from compact single-equipment units to ring-line units serving several simultaneous operations, with precise control.'}};
const PR={
 mining:{u:'/archives/business_area/mining-equipment/',f:['16381_banner-f015ad8f.webp'],pt:{n:'Mining Equipment',c:'Mineração',d:'Para o setor de minerais, a HMH desenvolve e entrega soluções para a mineração offshore e em terra. Em terra, as bombas de slurry Wirth são tecnologia consagrada no transporte e no processamento de minerais.'},en:{n:'Mining Equipment',c:'Mining',d:'For the minerals business, HMH develops and delivers solutions for offshore and onshore mining. Onshore, Wirth slurry pumps are an established technology for transporting and processing minerals.'}},
 blind:{u:CONSTR,f:['blind-shaft-517x-bc7c8175.webp'],pt:{n:'Blind Shaft Boring (linha L)',c:'Perfuração de poço vertical',d:'Máquinas para escavar poços verticais. As sondas da linha L são uma solução econômica para perfurar poços de grande diâmetro com até 1.000 m de profundidade, com suporte hidráulico para a montagem.'},en:{n:'Blind Shaft Boring (L-range)',c:'Vertical shaft drilling',d:'Machines for excavating vertical shafts. L-range rigs are an economical way to drill large-diameter shafts up to 1,000 m deep, with hydraulic support for rigging up.'}},
 hpu:HPU,
 dewater:{u:SLURRY,f:['10880-Slurrypump--a2b6b4fd.webp'],yt:'0yuISsAMbaM',pt:{n:'Wirth TPM · Desaguamento',c:'Bombas de slurry',d:'A bomba triplex de pistão com diafragma Wirth TPM também é aplicada no desaguamento de minas: retira do fundo da cava a água carregada de sólidos abrasivos e a bombeia até a superfície.'},en:{n:'Wirth TPM · Mine dewatering',c:'Slurry pumps',d:'The Wirth TPM triplex piston diaphragm pump is also used for mine dewatering: it removes water laden with abrasive solids from the pit bottom and pumps it to the surface.'}},
 autoclave:{u:SLURRY,f:['16381_banner-f015ad8f.webp'],yt:'w7jL4pmRf6Q',pt:{n:'Wirth Autoclave Feed Pumps',c:'Bombas de slurry',d:'Solução para aplicações HPAL, em que o slurry precisa ser transportado quente, a até 240 °C. Juntas de expansão telescópicas absorvem a dilatação térmica e a pulsação do curso nas pernas de resfriamento.'},en:{n:'Wirth Autoclave Feed Pumps',c:'Slurry pumps',d:'For HPAL applications, where slurry must be transported hot, up to 240 °C. Telescopic expansion joints absorb thermal expansion and stroke-induced pulsation in the cooling legs.'}},
 tpm:{u:SLURRY,f:['10880-Slurrypump--a2b6b4fd.webp','16381_banner-f015ad8f.webp'],yt:'0yuISsAMbaM',pt:{n:'Wirth TPM · Triplex',c:'Bombas de slurry',d:'Bomba triplex de pistão com diafragma de simples efeito, a solução mais usada para toda a faixa de pressões e vazões. A HMH criou a primeira em 1968. Aplicações: rejeitos, mineroduto, alimentação de digestores e autoclaves, desaguamento e cinzas.'},en:{n:'Wirth TPM · Triplex',c:'Slurry pumps',d:'Triplex single-acting piston diaphragm pump, the most widely used solution across the whole range of pressures and flows. HMH built the first one in 1968. Uses: tailings, pipeline transfer, digester and autoclave feed, dewatering and fly ash.'}},
 dpm:{u:SLURRY,f:['16381_banner-f015ad8f.webp'],yt:'Qb86V5rwMRc',pt:{n:'Wirth DPM · Duplex',c:'Bombas de slurry',d:'Bomba duplex de pistão com diafragma de duplo efeito, consagrada em campo e indicada para transportar grandes volumes: rejeitos, mineroduto e alimentação de digestores e autoclaves.'},en:{n:'Wirth DPM · Duplex',c:'Slurry pumps',d:'Field-proven duplex double-acting piston diaphragm pump, suited to high volumes: tailings, pipeline transfer and digester and autoclave feed.'}},
 pba:{u:RCDU,f:['HMH-PBA-615-5447ab7b.webp','16842-02_PBAs_MTHL-8ac05a70.webp'],yt:'XFjEc6wpj7k',pt:{n:'Pile Top Drill Rigs (PBA)',c:'RCD · Fundações',d:'Perfuram fundações em solo misto, matacões e rocha dura pelo método de circulação reversa (RCD), do qual a HMH é líder mundial. Seis modelos cobrem de 0,6 a 8,5 m de diâmetro, inclusive estacas inclinadas.'},en:{n:'Pile Top Drill Rigs (PBA)',c:'RCD · Foundations',d:'They drill foundations in mixed ground, boulders and hard rock using reverse circulation drilling (RCD), where HMH is the world market leader. Six models cover 0.6 to 8.5 m diameters, including inclined piles.'}},
 tools:{u:RCDU,f:['Special-Tool-8eaa2e1b.webp','Special-Tool-51985ba6.webp'],pt:{n:'Ferramentas especiais',c:'RCD · Ferramentas',d:'Brocas de grande diâmetro até 8,5 m, brocas para rocha com stinger, alargadores pneumáticos e hidráulicos, fresas para revestimentos e cortadores para geologias de até 350 MPa.'},en:{n:'Special tools',c:'RCD · Tools',d:'Large-diameter bits up to 8.5 m, rock bits with stinger, pneumatic and hydraulic underreamers, casing milling tools and cutters for ground up to 350 MPa.'}},
 hpu5:HPU,
 ctxHaul:{ctx:1,pt:{n:'Escavadeira e caminhões',c:'Contexto da operação (ilustrativo)',d:'Escavadeira e caminhões fora de estrada mostram o ciclo de carga e transporte da cava. São ilustrativos e não fazem parte da linha HMH.'},en:{n:'Shovel and haul trucks',c:'Operation context (illustrative)',d:'The shovel and haul trucks show the pit’s load-and-haul cycle. They are illustrative and not part of the HMH line.'}},
 ctxPlant:{ctx:1,pt:{n:'Britador, correia e planta',c:'Contexto da operação (ilustrativo)',d:'Britador, correia e planta de beneficiamento completam o fluxo do minério. São ilustrativos; a HMH entra com as bombas que movem o slurry.'},en:{n:'Crusher, conveyor and plant',c:'Operation context (illustrative)',d:'The crusher, conveyor and processing plant complete the ore flow. They are illustrative; HMH supplies the pumps that move the slurry.'}}};
const MD={hpu:'assets/modelos/mina_hpu.glb',pba:'assets/modelos/mina_pba.glb',tpm:'assets/modelos/mina_tpk.glb',dewater:'assets/modelos/mina_tpk.glb',autoclave:'assets/modelos/mina_tpk.glb'};
for(const k in MD)PR[k].m=MD[k];   // HPU é um objeto compartilhado (hpu e hpu5): mesmo modelo
const EQ=['blind','hpu','dewater','autoclave','tpm','dpm','pba','tools'];
const TP=o=>o[L];

// ---------------------------------------------------------------- terreno
const PIT_R=150,BW=14,BH=11,KMAX=7,EX=1.25,ROUT=PIT_R+24;
const POND={x:445,z:215,r:72};
const PADS={plant:{x:330,z:-62,r:70},pumps:{x:300,z:72,r:40},found:{x:-285,z:120,r:55},shaft:{x:-20,z:-228,r:32}};
function base(x,z){return 7*Math.sin(x*.011+1)*Math.cos(z*.009)+3.5*Math.sin(x*.027+z*.021)+1.6*Math.sin(x*.063-z*.047)+.5*Math.sin(x*.21+z*.17)}
function pitDepth(r){const s=(PIT_R-r)/BW;if(s<=0)return 0;const k=Math.floor(s);if(k>=KMAX)return KMAX*BH;return BH*(k+smooth(clamp((s-k-.62)/.38,0,1)))}
function rawH(x,z){const r=Math.hypot(x/EX,z);let h=base(x,z)*(.12+.88*clamp((r-PIT_R)/70,0,1));if(r<PIT_R)h-=pitDepth(r);
 const dp=Math.hypot(x-POND.x,z-POND.z);if(dp<POND.r+40)h-=9*(1-smooth(clamp((dp-POND.r*.55)/(POND.r*.45+40),0,1)));return h}
for(const p of Object.values(PADS))p.h=rawH(p.x,p.z);
function height(x,z){let h=rawH(x,z);for(const p of Object.values(PADS)){const d=Math.hypot(x-p.x,z-p.z);if(d<p.r+30)h=lerp(p.h,h,smooth(clamp((d-p.r)/30,0,1)))}return h}
const rEl=(x,z)=>Math.hypot(x/EX,z);

// ---------------------------------------------------------------- renderizador
const canvas=$('#gl');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',stencil:false});
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();store.set('hmh-mina-qcap',String(Math.max(0,q-1)));const d=document.createElement('div');d.textContent='A placa de vídeo reiniciou a cena. Recarregando…';d.style.cssText='position:fixed;inset:0;z-index:999;display:grid;place-content:center;background:#0b1724;color:#fff;font:600 16px system-ui';document.body.appendChild(d);setTimeout(()=>location.reload(),1500)},false);
const scene=new THREE.Scene();
scene.fog=new THREE.Fog(0xcbdbe5,700,2300);
const camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,1,3200);
const ANISO=Math.min(8,renderer.capabilities.getMaxAnisotropy());
// pós-processamento como no Deep Water: AO em meia resolução + SMAA depois do tonemapping (sem MSAA em buffer de ponto flutuante)
const composer=new EffectComposer(renderer);for(const rt of[composer.renderTarget1,composer.renderTarget2]){rt.depthTexture=new THREE.DepthTexture(rt.width,rt.height);rt.samples=0}
composer.addPass(new RenderPass(scene,camera));const ssao=new SSAOPass(camera,innerWidth,innerHeight);ssao.radius=2.6;ssao.strength=.85;ssao.band.set(0,650);composer.addPass(ssao);
composer.addPass(new OutputPass());const smaa=new SMAAPass(innerWidth,innerHeight);composer.addPass(smaa);

// carregamento com progresso
let toLoad=0,loaded=0;const progBar=$('#progBar');
const tick=()=>{loaded++;progBar.style.width=Math.round(loaded/toLoad*90)+'%'};
const TL=new THREE.TextureLoader();
function tex(name,rep,srgb=true){toLoad++;return new Promise(res=>TL.load('assets/texturas/'+name,t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;if(rep)t.repeat.set(rep,rep);t.anisotropy=ANISO;if(srgb)t.colorSpace=THREE.SRGBColorSpace;tick();res(t)},undefined,()=>{tick();res(null)}))}
function hdr(){toLoad++;return new Promise(res=>new RGBELoader().load('assets/hdri/ceu.hdr',t=>{tick();res(t)},undefined,()=>{tick();res(null)}))}

// ---------------------------------------------------------------- materiais
const std=(c,r=.6,m=0,extra={})=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:r,metalness:m},extra));
const M={yellow:std(0xf0b020,.5,.25),dark:std(0x2a2b2d,.75,.3),rubber:std(0x161616,.92),steel:std(0xc3c9cf,.38,.75),steelD:std(0x5d666e,.5,.6),
 navy:std(0x0e2a4a,.42,.45),red:std(0xd9303c,.4,.25),white:std(0xeef2f5,.5,.1),glass:std(0x203a4f,.08,.7),pipe:std(0x24262a,.55,.15),
 ore:std(0x6b5440,.95),conc:std(0xbfbcb4,.85),water:std(0x6e8680,.07,.15,{envMapIntensity:1.2}),corr:std(0xdde3e8,.5,.55),black:std(0x050505,1),
 orange:std(0xff8a1c,.5,.1),blue:std(0x1e7ac4,.36,.3)};

// lote estático: tudo que não se mexe é mesclado em uma malha por material
const UB=new THREE.BoxGeometry(1,1,1),UC=new THREE.CylinderGeometry(1,1,1,18),UC8=new THREE.CylinderGeometry(1,1,1,8),US=new THREE.SphereGeometry(1,16,12);
// mapeamento por caixa em coordenadas do mundo: a textura tem o mesmo tamanho em qualquer peça (1 repetição a cada ~2,9 m)
function boxUV(g){const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;if(!uv||!n)return g;
 for(let i=0;i<p.count;i++){const ax=Math.abs(n.getX(i)),ay=Math.abs(n.getY(i)),az=Math.abs(n.getZ(i));let u,v;if(ay>=ax&&ay>=az){u=p.getX(i);v=p.getZ(i)}else if(ax>=az){u=p.getZ(i);v=p.getY(i)}else{u=p.getX(i);v=p.getY(i)}uv.setXY(i,u*.35,v*.35)}uv.needsUpdate=true;return g}
class Batch{
 constructor(){this.m=new Map();this.base=new THREE.Matrix4()}
 at(x,y,z,ry=0){this.base.compose(V(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,ry,0)),V(1,1,1));return this}
 put(geo,mat,local){const g=boxUV(geo.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(this.base,local)));if(!this.m.has(mat))this.m.set(mat,[]);this.m.get(mat).push(g)}
 world(geo,mat,mtx){const g=geo.clone();if(mtx)g.applyMatrix4(mtx);boxUV(g);if(!this.m.has(mat))this.m.set(mat,[]);this.m.get(mat).push(g)}
 box(w,h,d,mat,x,y,z,rx=0,ry=0,rz=0){this.put(UB,mat,new THREE.Matrix4().compose(V(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)),V(w,h,d)))}
 cyl(r,h,mat,x,y,z,rx=0,ry=0,rz=0,lo){this.put(lo?UC8:UC,mat,new THREE.Matrix4().compose(V(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)),V(r,h,r)))}
 sph(r,mat,x,y,z){this.put(US,mat,new THREE.Matrix4().compose(V(x,y,z),new THREE.Quaternion(),V(r,r,r)))}
 beam(a,b,t,mat,t2=t,lo=true){this.put(UB,mat,orient(a,b,t,t2))}
 build(parent,cast=true){for(const[mat,list]of this.m){for(const q of list)if(!q.index){const n=q.attributes.position.count;q.setIndex(Array.from({length:n},(_,i)=>i))}const g=mergeGeometries(list,false);const me=new THREE.Mesh(g,mat);me.castShadow=cast;me.receiveShadow=true;me.matrixAutoUpdate=false;parent.add(me)}this.m.clear()}
}
// caixa orientada de a até b (comprimento no eixo x), mantendo o "para cima" do mundo
function orient(a,b,w,h){const X=b.clone().sub(a),len=X.length();X.normalize();let up=Math.abs(X.y)>.98?V(1,0,0):V(0,1,0);const Z=V(0,0,0).crossVectors(X,up).normalize(),Y=V(0,0,0).crossVectors(Z,X);
 const m=new THREE.Matrix4().makeBasis(X,Y,Z);m.scale(V(len,h,w));m.setPosition(a.clone().add(b).multiplyScalar(.5));return m}
const mesh=(geo,mat,parent,x=0,y=0,z=0,sx=1,sy=1,sz=1)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m};

// ---------------------------------------------------------------- cena
const world=new THREE.Group();scene.add(world);
const sun=new THREE.DirectionalLight(0xfff0dc,2.7);sun.castShadow=true;sun.shadow.bias=-.0004;sun.shadow.normalBias=.6;
const SUN_DIR=V(-.45,.78,.42).normalize();scene.add(sun,sun.target);
scene.add(new THREE.HemisphereLight(0xcfe3f2,0x6b5a40,.55));
const ANCH={},DYN=[];let trees,trunks,rocks,ores,dust;

let TERR=null;const HDT={};// uniformes do terreno e texturas HD (trocadas depois da entrada, no Alta e no Ultra)
function buildTerrain(T){
 const soilMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,metalness:0});
 // 4 camadas misturadas por vértice: terra das bancadas, rocha (triplanar, nas paredes), solo externo e cascalho das praças
 soilMat.onBeforeCompile=sh=>{
  sh.uniforms.tS0={value:HDT.tS0||T.soil};sh.uniforms.tS1={value:HDT.tS1||T.rock};sh.uniforms.tS2={value:HDT.tS2||T.ground};sh.uniforms.tS3={value:HDT.tS3||T.gravel};sh.uniforms.uSc={value:new THREE.Vector4(1/13,1/9,1/24,1/8)};TERR=sh.uniforms;
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec4 splat;varying vec4 vSplat;varying vec3 vWP;varying vec3 vWN;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvSplat=splat;vWP=(modelMatrix*vec4(position,1.0)).xyz;vWN=normalize(mat3(modelMatrix)*normal);');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
uniform sampler2D tS0,tS1,tS2,tS3;uniform vec4 uSc;varying vec4 vSplat;varying vec3 vWP;varying vec3 vWN;
vec3 triP(sampler2D t,vec3 p,vec3 n,float s){vec3 w=pow(abs(n),vec3(6.));w/=w.x+w.y+w.z+1e-4;return texture2D(t,p.zy*s).rgb*w.x+texture2D(t,p.xz*s).rgb*w.y+texture2D(t,p.xy*s).rgb*w.z;}`)
   .replace('#include <map_fragment>',`vec3 nn=normalize(vWN);
vec3 c0=texture2D(tS0,vWP.xz*uSc.x).rgb;c0*=.72+.56*texture2D(tS0,vWP.xz*uSc.x*.11).g;
vec3 c1=triP(tS1,vWP,nn,uSc.y);
vec3 c2=texture2D(tS2,vWP.xz*uSc.z).rgb;c2*=.7+.6*texture2D(tS2,vWP.xz*uSc.z*.09).g;
vec3 c3=texture2D(tS3,vWP.xz*uSc.w).rgb*.68;
diffuseColor.rgb*=(c0*vSplat.x+c1*vSplat.y+c2*vSplat.z+c3*vSplat.w)*1.3;`)};
 const tint=(x,z,ny)=>{const n=.5+.5*Math.sin(x*.13+z*.07)*Math.cos(z*.11-x*.05),v=.86+.14*n,ao=rEl(x,z)<PIT_R+4?lerp(.8,1,smooth(clamp((ny-.5)/.4,0,1))):1;return v*ao};
 const splat=(x,z,ny)=>{const r=rEl(x,z),steep=1-smooth(clamp((ny-.55)/.3,0,1));let pad=0;for(const p of Object.values(PADS))pad=Math.max(pad,1-smooth(clamp((Math.hypot(x-p.x,z-p.z)-p.r)/14,0,1)));
  pad=Math.max(pad,(1-smooth(clamp((Math.hypot(x-POND.x,z-POND.z)-POND.r*.9)/20,0,1)))*.6);
  const g=smooth(clamp((r-PIT_R-4)/30,0,1)),fl=1-steep;let w0=fl*(1-g)*(1-pad),w2=fl*g*(1-pad),w1=steep,w3=pad*fl;const s=w0+w1+w2+w3+1e-5;return[w0/s,w1/s,w2/s,w3/s]};
 // 1) cava em coordenadas polares (bancadas nítidas)
 const radii=[];for(let r=ROUT;r>PIT_R;r-=4)radii.push(r);
 for(let k=0;k<KMAX;k++){for(const f of[0,.2,.4,.58,.66,.74,.82,.9,.97])radii.push(PIT_R-BW*(k+f))}
 for(let r=PIT_R-BW*KMAX-1;r>.5;r-=6)radii.push(r);radii.push(.5);
 const SEGS=360,pos=[],idx=[];
 for(const r of radii)for(let i=0;i<=SEGS;i++){const a=i/SEGS*Math.PI*2,x=EX*r*Math.cos(a),z=r*Math.sin(a);pos.push(x,height(x,z),z)}
 for(let j=0;j<radii.length-1;j++)for(let i=0;i<SEGS;i++){const a=j*(SEGS+1)+i,b=a+SEGS+1;idx.push(a,b,a+1,b,b+1,a+1)}
 const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));pg.setIndex(idx);pg.computeVertexNormals();
 // 2) terreno externo; os vértices sob a cava descem e ficam escondidos
 const og=new THREE.PlaneGeometry(2600,2600,300,300);og.rotateX(-Math.PI/2);const op=og.attributes.position;
 for(let i=0;i<op.count;i++){const x=op.getX(i),z=op.getZ(i);const re=rEl(x,z);op.setY(i,re<PIT_R+12?-140:height(x,z)-(re<ROUT?.6:0))}og.computeVertexNormals();
 for(const g of[pg,og]){const p=g.attributes.position,n=g.attributes.normal,cols=new Float32Array(p.count*3),sp=new Float32Array(p.count*4);
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),ny=n.getY(i),v=tint(x,z,ny);cols.set([v,v*.98,v*.95],i*3);sp.set(splat(x,z,ny),i*4)}
  g.setAttribute('color',new THREE.BufferAttribute(cols,3));g.setAttribute('splat',new THREE.BufferAttribute(sp,4))}
 const pit=new THREE.Mesh(pg,soilMat);pit.receiveShadow=true;pit.castShadow=true;
 const out=new THREE.Mesh(og,soilMat);out.receiveShadow=true;
 for(const m of[pit,out]){m.matrixAutoUpdate=false;world.add(m)}
 // barragem de rejeitos
 const water=new THREE.Mesh(new THREE.CircleGeometry(POND.r*.86,64),M.water);water.rotation.x=-Math.PI/2;water.position.set(POND.x,height(POND.x,POND.z)+5.2,POND.z);water.receiveShadow=true;water.updateMatrix();water.matrixAutoUpdate=false;world.add(water);
 M.rock=std(0xb0a89e,.92,0,{map:T.rock});
}
let hdDone=false;
function loadHD(){if(hdDone)return;hdDone=true;for(const[k,u]of[['soil','tS0'],['rock','tS1'],['ground','tS2'],['gravel','tS3']])
 TL.load(`assets/texturas/mina/${k}_diff_2k.webp`,t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=ANISO;t.colorSpace=THREE.SRGBColorSpace;HDT[u]=t;if(TERR)TERR[u].value=t})}

function scatter(){
 // árvores (instâncias): copa + tronco
 const N=700,fol=new THREE.ConeGeometry(2.6,8,7),tr=new THREE.CylinderGeometry(.35,.45,2.4,6);fol.translate(0,6,0);tr.translate(0,1.2,0);
 trees=new THREE.InstancedMesh(fol,std(0x3f6a35,.9),N);trunks=new THREE.InstancedMesh(tr,std(0x5a4330,.9),N);
 const m=new THREE.Matrix4(),q=new THREE.Quaternion(),c=new THREE.Color();let n=0,guard=0;
 const clear=(x,z)=>{if(rEl(x,z)<PIT_R+40)return false;for(const p of Object.values(PADS))if(Math.hypot(x-p.x,z-p.z)<p.r+28)return false;if(Math.hypot(x-POND.x,z-POND.z)<POND.r+30)return false;
  if(x>150&&x<330&&z>-80&&z<-20)return false;if(x>300&&x<460&&z>60&&z<230&&Math.abs((z-72)-(x-310)*1.05)<30)return false;return true};
 while(n<N&&guard++<20000){const a=Math.random()*Math.PI*2,r=PIT_R+50+Math.pow(Math.random(),.7)*560,x=EX*r*Math.cos(a),z=r*Math.sin(a);if(!clear(x,z))continue;
  const s=.7+Math.random()*.8;q.setFromEuler(new THREE.Euler(0,Math.random()*6,0));m.compose(V(x,height(x,z)-.3,z),q,V(s,s*(.8+Math.random()*.5),s));trees.setMatrixAt(n,m);trunks.setMatrixAt(n,m);
  trees.setColorAt(n,c.setHSL(.27+Math.random()*.06,.35+Math.random()*.15,.22+Math.random()*.1));n++}
 trees.count=trunks.count=n;trees.userData.max=n;trees.castShadow=trunks.castShadow=true;trees.receiveShadow=true;world.add(trees,trunks);
 // pedras nas bancadas e blocos soltos
 const RN=700,rg=new THREE.IcosahedronGeometry(1,1);const pp=rg.attributes.position;for(let i=0;i<pp.count;i++){const s=.75+Math.random()*.4;pp.setXYZ(i,pp.getX(i)*s,pp.getY(i)*s*.7,pp.getZ(i)*s)}rg.computeVertexNormals();
 rocks=new THREE.InstancedMesh(rg,M.rock,RN);let k2=0;
 for(let i=0;i<RN;i++){const k=Math.floor(Math.random()*KMAX),a=Math.random()*Math.PI*2,r=i<RN*.85?PIT_R-BW*(k+.05+Math.random()*.5):PIT_R+30+Math.random()*300,x=EX*r*Math.cos(a),z=r*Math.sin(a);
  if(i>=RN*.85&&!clear(x,z))continue;const s=.4+Math.pow(Math.random(),3)*2.6;q.setFromEuler(new THREE.Euler(Math.random(),Math.random()*6,Math.random()));m.compose(V(x,height(x,z)+s*.2,z),q,V(s,s,s));rocks.setMatrixAt(k2++,m)}
 rocks.count=k2;rocks.userData.max=k2;rocks.castShadow=true;rocks.receiveShadow=true;world.add(rocks);
}

// --- caminhão fora de estrada (dinâmico)
const WG=(()=>{const w=new THREE.CylinderGeometry(1.55,1.55,1.15,24);w.rotateX(Math.PI/2);const parts=[w],lug=new THREE.BoxGeometry(.3,.5,1.0);
 for(let i=0;i<28;i++){const a=i/28*Math.PI*2,l=lug.clone();l.applyMatrix4(new THREE.Matrix4().compose(V(Math.cos(a)*1.62,Math.sin(a)*1.62,0),new THREE.Quaternion().setFromAxisAngle(V(0,0,1),a),V(1,1,1)));parts.push(l)}
 return mergeGeometries(parts,false)})();
function truck(){const g=new THREE.Group(),w=[];
 mesh(UB,M.dark,g,0,2.1,0,10.5,1.2,3.4);
 const bed=new THREE.Group();bed.position.set(-1,3.3,0);g.add(bed);
 mesh(UB,M.yellow,bed,0,0,0,8.2,.4,5.9);mesh(UB,M.yellow,bed,0,1.3,2.95,8.2,2.6,.3);mesh(UB,M.yellow,bed,0,1.3,-2.95,8.2,2.6,.3);mesh(UB,M.yellow,bed,-4,1.4,0,.35,2.8,5.9);mesh(UB,M.yellow,bed,5.1,3,0,2.6,.3,5.9);
 const load=mesh(new THREE.DodecahedronGeometry(1,0),M.ore,bed,-.2,1.4,0,3.8,1.1,2.7);
 mesh(UB,M.yellow,g,4.9,2.7,0,1.6,2.4,5.4);mesh(UB,M.yellow,g,4.5,4.6,-1.7,2.2,1.9,2);mesh(UB,M.glass,g,5.62,4.8,-1.7,.06,.9,1.7);mesh(UB,M.dark,g,5.75,2.6,0,.1,1.4,4);
 mesh(UB,M.dark,g,5.2,5.8,-1.7,.3,.5,.06);mesh(UB,M.dark,g,5.2,5.8,1.2,.3,.5,.06);mesh(UC,M.dark,g,3.4,6.2,1.6,.18,2.2,.18);for(const z of[-2,2])mesh(UB,M.white,g,5.74,3.1,z,.05,.35,.6);for(let i=0;i<5;i++)mesh(UB,M.dark,g,5.6,1.3+i*.45,2.4,.5,.06,.06);mesh(UB,M.dark,g,5.7,2.2,2.6,.06,2.2,.06);
for(const[x,z]of[[4,2.6],[4,-2.6],[-2.8,2.25],[-2.8,-2.25],[-2.8,3.45],[-2.8,-3.45]])w.push(mesh(WG,M.rubber,g,x,1.55,z));
 g.userData={w,load};return g}
// --- escavadeira (dinâmica)
function shovel(){const g=new THREE.Group();
 mesh(UB,M.dark,g,0,1,2.6,9,2,2.2);mesh(UB,M.dark,g,0,1,-2.6,9,2,2.2);mesh(UB,M.dark,g,0,2.4,0,5,1,5);
 const up=new THREE.Group();up.position.y=3;g.add(up);
 mesh(UB,M.yellow,up,-1,1.6,0,7.4,3.2,5.6);mesh(UB,M.dark,up,-4.8,1.6,0,1.6,2.8,5.6);for(const sg of[-1,1]){const lg=mesh(UC8,M.yellow,up,-.4,5.8,sg*2.2,.22,5.6,.22);lg.rotation.z=-.5}mesh(UB,M.dark,up,1.6,8.5,0,.9,.6,4.6);mesh(UC8,M.steelD,up,-3.4,3.8,-2.2,.3,2.2,.3);mesh(UB,M.yellow,up,1.6,4,-1.8,2.2,2,2);mesh(UB,M.glass,up,2.72,4.2,-1.8,.06,1,1.6);
 const boom=new THREE.Group();boom.position.set(2.4,2.6,0);up.add(boom);mesh(UB,M.yellow,boom,4.6,0,0,9.2,1.3,1.5);
 const arm=new THREE.Group();arm.position.set(9.2,0,0);boom.add(arm);mesh(UB,M.yellow,arm,3,0,0,6,1.1,1.3);
 const bk=new THREE.Group();bk.position.set(6,0,0);arm.add(bk);mesh(UB,M.dark,bk,.6,-.6,0,2.6,2.2,3.8);{const th=new THREE.ConeGeometry(.2,.8,6);for(let i=0;i<5;i++){const tt=mesh(th,M.steel,bk,2.35,-1.6,-1.5+i*.75);tt.rotation.z=-Math.PI/2}}
 g.userData={up,boom,arm,bk};return g}

// ---------------------------------------------------------------- modelos HMH (estáticos, em lote; detalhes finos vão para BD, visível em Alta e Ultra)
const BD=new Batch();let DET=null,DETB=null;const PI2=Math.PI/2;
function skid(B,ox,oz,len=12){B.box(len,.35,.35,M.dark,ox,.25,oz-2.1);B.box(len,.35,.35,M.dark,ox,.25,oz+2.1);for(let x=-len/2+.5;x<=len/2-.5;x+=len/4.4)B.box(.35,.35,4.4,M.dark,ox+x,.25,oz)}
function driveB(B,ox,oz){// motor elétrico + redutor + proteção do acoplamento
 B.cyl(1.05,3.2,M.navy,ox-7,1.55,oz,0,0,PI2);B.box(1.6,2,2.3,M.navy,ox-4.9,1.4,oz);B.box(.8,1.2,1.2,M.yellow,ox-5.9,1.5,oz);B.box(2.4,.25,2.4,M.dark,ox-7,.5,oz);
 for(let i=0;i<9;i++)BD.cyl(1.13,.08,M.navy,ox-8.3+i*.32,1.55,oz,0,0,PI2,true);BD.box(.5,.5,.05,M.white,ox-7,1.55,oz+1.08)}
// ---- modelos feitos a partir das fotos oficiais da HMH (interpretação, até chegar o CAD)
const hull2=pts=>{const p=pts.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);const lo=[];for(const q of p){while(lo.length>1&&cr(lo[lo.length-2],lo[lo.length-1],q)<=0)lo.pop();lo.push(q)}
 const up=[];for(const q of p.slice().reverse()){while(up.length>1&&cr(up[up.length-2],up[up.length-1],q)<=0)up.pop();up.push(q)}up.pop();lo.pop();return lo.concat(up)};
// proteção da transmissão em forma de gota (como na foto da bomba Wirth TPK)
const guardGeo=(()=>{const P=[];for(let i=0;i<24;i++){const a=i/24*Math.PI*2;P.push([-1.6+Math.cos(a)*1.4,Math.sin(a)*1.4]);P.push([1.7+Math.cos(a)*.8,.35+Math.sin(a)*.8])}
 const h=hull2(P),s=new THREE.Shape();h.forEach((q,i)=>i?s.lineTo(q[0],q[1]):s.moveTo(q[0],q[1]));s.closePath();return new THREE.ExtrudeGeometry(s,{depth:.45,bevelEnabled:true,bevelSize:.05,bevelThickness:.05,bevelSegments:2})})();
const BTN=mergeGeometries([new THREE.CylinderGeometry(.24,.24,.3,10),new THREE.SphereGeometry(.24,10,6,0,Math.PI*2,0,Math.PI/2).translate(0,.15,0)],false);
Object.assign(M,{aqua:std(0x8fd6df,.36,.4),blue2:std(0x1b78d6,.34,.35),hred:std(0xcf2a1d,.42,.35),sblue:std(0x1f4fa6,.4,.45),carb:std(0x9aa1a8,.3,.85)});
function wirthPump(B,ox,oz,n){BD.base.copy(B.base);const A=M.aqua,zs=n===3?[-1.3,0,1.3]:[-1,1],ZL=n===3?4.6:3.6;
 // base (skid) com tubo de proteção na frente
 for(const s of[-1,1])B.box(13.6,.5,.55,A,ox-1.2,.3,oz+s*2.15);for(let i=0;i<7;i++)B.box(.55,.5,4.8,A,ox-6.7+i*2.05,.3,oz);B.cyl(.2,5.2,A,ox+4.5,.35,oz,PI2);
 // caixa de manivelas (power end), tampa e janelas de inspeção
 B.box(4.4,2.8,4.0,A,ox-2.4,1.95,oz);B.box(4.5,.28,4.1,A,ox-2.4,3.45,oz);for(const s of[-1,1])B.box(1.2,.9,.08,M.steel,ox-2.4,2.4,oz+s*2.03);
 // guias das cruzetas abertas (a haste aparece) e bloco da parte hidráulica (fluid end)
 for(const dz of zs){B.box(1.4,.12,1.0,M.steelD,ox+.35,2.85,oz+dz);B.box(1.4,.12,1.0,M.steelD,ox+.35,1.75,oz+dz)}
 B.box(1.9,2.4,ZL,A,ox+1.9,2.1,oz);
 for(const dz of zs){B.cyl(.62,1.6,A,ox+2.6,2.3,oz+dz,0,0,PI2);B.cyl(.66,.18,M.steel,ox+3.45,2.3,oz+dz,0,0,PI2);B.cyl(.42,.55,A,ox+2.2,3.55,oz+dz);B.cyl(.5,.2,M.steel,ox+2.2,3.92,oz+dz);
  for(let k=0;k<8;k++){const a=k/8*Math.PI*2;BD.cyl(.06,.32,M.steel,ox+3.5,2.3+Math.sin(a)*.55,oz+dz+Math.cos(a)*.55,0,0,PI2,true);BD.cyl(.05,.18,M.steel,ox+2.2+Math.cos(a)*.42,4.0,oz+dz+Math.sin(a)*.42,0,0,0,true)}}
 // coletores de sucção (baixo) e descarga (alto) com flanges
 B.cyl(.4,ZL+1.2,A,ox+3.0,.95,oz,PI2);B.cyl(.28,ZL+.6,A,ox+2.2,4.5,oz,PI2);for(const s of[-1,1]){BD.cyl(.6,.18,M.steel,ox+3.0,.95,oz+s*(ZL/2+.55),PI2);BD.cyl(.42,.14,M.steel,ox+2.2,4.5,oz+s*(ZL/2+.3),PI2)}
 // amortecedor de pulsação (bolha) na ponta da descarga
 {const zD=oz-(ZL/2+.2);B.cyl(.34,1.0,A,ox+2.2,5.0,zD);B.put(US,A,new THREE.Matrix4().compose(V(ox+2.2,6.05,zD),new THREE.Quaternion(),V(.85,1,.85)));B.cyl(.5,.22,M.steel,ox+2.2,7.0,zD);for(let k=0;k<8;k++){const a=k/8*Math.PI*2;BD.cyl(.05,.2,M.steel,ox+2.2+Math.cos(a)*.4,7.14,zD+Math.sin(a)*.4,0,0,0,true)}}
 // proteção da transmissão em gota, na lateral
 B.put(guardGeo,A,new THREE.Matrix4().makeTranslation(ox-2.2,2.05,oz+2.0));for(let i=0;i<12;i++){const a=i/12*Math.PI*2;BD.cyl(.05,.12,M.steel,ox-3.8+Math.cos(a)*1.2,2.05+Math.sin(a)*1.2,oz+2.5,PI2,0,0,true)}
 // trocadores de calor (placas pretas com aletas) e carcaças dos motores de ventilador
 for(const dx of[-3.7,-2.3]){B.box(.14,1.5,1.9,M.dark,ox+dx,4.55,oz-.3);for(let i=0;i<6;i++)BD.box(.18,1.4,.04,M.steelD,ox+dx,4.55,oz-1.15+i*.38)}
 for(const dz of[-1.2,.9]){B.box(1.3,1.0,1.2,A,ox-.9,4.65,oz+dz);B.box(.1,.9,1.0,M.steel,ox-1.58,4.65,oz+dz)}
 // reservatório de óleo, tubos de cobre e mangueiras
 B.box(1.2,.9,.8,M.steel,ox+.7,.95,oz+1.7);for(const dz of[-.25,.25])B.cyl(.1,.6,M.orange,ox+.3,1.3,oz+1.95+dz);
 for(const[a,b]of[[V(ox-3.7,4.3,oz-.3),V(ox-1.2,4.4,oz-1.2)],[V(ox-2.3,4.3,oz-.3),V(ox-.6,4.6,oz+.9)]]){const m=V((a.x+b.x)/2,Math.max(a.y,b.y)+.7,(a.z+b.z)/2);B.world(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a,m,b]),14,.06,6),M.rubber,B.base)}
 driveB(B,ox,oz)}
function tpmB(B,ox,oz){wirthPump(B,ox,oz,3)}
function dpmB(B,ox,oz){wirthPump(B,ox,oz,2)}
// unidade hidráulica: moldura vermelha, motores azuis verticais com aletas, caixa de comando cinza (foto HPU)
function hpuB(B,x,z){BD.base.copy(B.base);const R=M.hred;
 for(const s of[-1,1]){B.box(7.6,.3,.3,R,x,.25,z+s*1.35);B.box(7.6,.22,.22,R,x,1.95,z+s*1.35)}for(let i=0;i<6;i++)B.box(.3,.3,2.7,R,x-3.3+i*1.32,.25,z);
 for(const sx of[-1,1])for(const sz of[-1,1])B.box(.22,1.7,.22,R,x+sx*3.7,1.1,z+sz*1.35);B.box(7.6,.12,2.7,M.steelD,x,.45,z);
 for(let i=0;i<5;i++){const xi=x-2.6+i*1.3;B.box(.95,.7,.95,R,xi,.95,z);B.cyl(.32,.55,M.steel,xi,1.55,z);B.cyl(.5,1.35,M.blue,xi,2.5,z);B.cyl(.52,.2,M.dark,xi,3.25,z);B.box(.38,.3,.3,M.steelD,xi+.55,2.9,z);
  for(let k=0;k<7;k++)BD.cyl(.54,.05,M.blue,xi,1.95+k*.17,z,0,0,0,true);B.cyl(.12,.7,R,xi,.95,z+.8,PI2);
  B.world(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(xi+.4,1.2,z+.45),V(xi+.7,.6,z+1.0),V(xi+.4,1.35,z+1.1)]),12,.07,6),M.rubber,B.base)}
 B.cyl(.2,7.6,R,x,.95,z-1.1,0,0,PI2);B.cyl(.2,7.6,R,x,1.45,z+1.1,0,0,PI2);
 B.box(1.0,1.7,1.0,M.steel,x-4.35,.95,z);BD.box(.05,1.4,.7,M.dark,x-4.35,1.05,z+.51);B.box(.8,.7,1.0,M.steel,x+4.3,.7,z)}
// ferramenta especial: disco azul com botões de carboneto e placa quadriculada sobre haste com flange (foto Special Tool)
function bitB(B,x,z){BD.base.copy(B.base);const BL=M.blue2;B.box(7.6,.8,7.6,M.dark,x,.4,z);
 B.cyl(2.1,1.9,M.sblue,x,1.75,z);B.cyl(2.5,.4,M.sblue,x,1.05,z);for(let i=0;i<14;i++){const a=i/14*Math.PI*2;BD.cyl(.09,.2,M.steel,x+Math.cos(a)*2.3,1.27,z+Math.sin(a)*2.3,0,0,0,true)}
 B.cyl(3.4,1.4,BL,x,3.5,z);B.cyl(3.5,.2,M.sblue,x,2.9,z);
 for(const[r,n,t]of[[.9,6,0],[1.8,10,.15],[2.6,15,.4],[3.15,19,.65]])for(let i=0;i<n;i++){const a=i/n*Math.PI*2+r,q=new THREE.Quaternion().setFromAxisAngle(V(Math.sin(a),0,-Math.cos(a)),-t);B.put(BTN,M.carb,new THREE.Matrix4().compose(V(x+Math.cos(a)*r,4.05,z+Math.sin(a)*r),q,V(1,1,1)))}
 B.box(1.9,.2,1.3,BL,x+1.05,4.3,z-1.9);for(let i=0;i<3;i++)for(let j=0;j<2;j++)BD.box(.45,.1,.4,M.dark,x+.45+i*.6,4.43,z-2.2+j*.5)}
function ladderD(x,y0,y1,z,ry=0){const n=Math.floor((y1-y0)/.4),c=Math.cos(ry),s=Math.sin(ry);for(const o of[-.25,.25])BD.box(.06,y1-y0,.06,M.steel,x+o*c,(y0+y1)/2,z-o*s);for(let i=1;i<n;i++)BD.box(.5,.05,.05,M.steel,x,y0+i*.4,z,0,ry,0)}
function railD(x0,x1,y,z){BD.box(Math.abs(x1-x0),.07,.07,M.yellow,(x0+x1)/2,y+1.05,z);BD.box(Math.abs(x1-x0),.06,.06,M.yellow,(x0+x1)/2,y+.55,z);for(let x=Math.min(x0,x1);x<=Math.max(x0,x1);x+=2)BD.box(.07,1.05,.07,M.yellow,x,y+.52,z)}

function buildModels(){
 const B=new Batch();
 // ============ 1) sonda RCD sobre o poço vertical
 {const p=PADS.shaft,gy=p.h,top=34;B.at(p.x,gy,p.z,.35);BD.base.copy(B.base);const SB=M.sblue;
  // esteiras e plataforma azul (foto do blind shaft: dois mastros tubulares azuis)
  for(const s of[-1,1]){B.box(15,1.2,2.6,M.dark,0,.6,s*4.4);for(let i=0;i<14;i++)BD.box(.7,.12,2.7,M.steelD,-6.8+i*1.05,1.25,s*4.4)}
  B.box(14.4,.55,11,SB,0,1.5,0);B.cyl(3.1,.7,M.blue2,0,1.95,0);B.cyl(2.2,.06,M.black,0,2.31,0);
  railD(-7.2,7.2,1.8,5.5);railD(-7.2,7.2,1.8,-5.5);for(const sx of[-1,1]){for(let z=-5.5;z<=5.5;z+=2.2)BD.box(.07,1.05,.07,M.yellow,sx*7.2,2.32,z);BD.box(.07,.07,11,M.yellow,sx*7.2,2.85,0);BD.box(.06,.06,11,M.yellow,sx*7.2,2.35,0)}
  // escada azul com corrimão amarelo
  for(let i=0;i<11;i++){B.box(.9,.12,1.5,SB,-7.5-i*.6,1.7-i*.16,4.6)}B.beam(V(-7.2,1.7,5.4),V(-14,.05,5.4),.14,SB,.3);B.beam(V(-7.2,1.7,3.8),V(-14,.05,3.8),.14,SB,.3);B.beam(V(-7.2,2.8,5.4),V(-14,1.2,5.4),.07,M.yellow,.07);
  // mastros tubulares gêmeos, anéis de flange, travessas, coroa e roldanas
  for(const sx of[-1,1]){B.cyl(.8,top-2,SB,sx*3.8,(top+2)/2,0);B.cyl(1.3,1.0,SB,sx*3.8,2.5,0);for(let k=0;k<5;k++){B.cyl(.95,.3,SB,sx*3.8,2+6.4*(k+1),0);for(let i=0;i<12;i++){const a=i/12*Math.PI*2;BD.cyl(.07,.35,M.steel,sx*3.8+Math.cos(a)*.9,2+6.4*(k+1),Math.sin(a)*.9,0,0,0,true)}}ladderD(sx*3.8+sx*1.05,2,top-1,0,PI2)}
  for(const y of[11,21,30])B.cyl(.3,7.6,SB,0,y,0,0,0,PI2);B.beam(V(-3.8,11,0),V(3.8,21,0),.28,SB,.28);B.beam(V(3.8,11,0),V(-3.8,21,0),.28,SB,.28);B.beam(V(-3.8,21,0),V(3.8,30,0),.26,SB,.26);B.beam(V(3.8,21,0),V(-3.8,30,0),.26,SB,.26);
  B.box(9.8,1.5,1.8,SB,0,top+.9,0);for(const sx of[-1,1]){B.cyl(.7,.5,M.steel,sx*1.1,top+.2,0,PI2);B.box(.5,.5,.5,M.white,sx*4.2,top+2.0,.5)}B.cyl(.12,1.2,M.steel,0,top+2.1,0);
  // grupo gerador amarelo e chaminé
  B.box(3.2,2.2,2.2,M.yellow,-5.2,2.9,-3.6);B.cyl(.15,1.8,M.dark,-4.5,4.8,-4.2);for(let i=0;i<6;i++)BD.box(.04,1.7,.05,M.dark,-6.8,2.9,-4.2+i*.3);
  hpuB(B,14,-3.4);BD.base.copy(B.base);
  for(let i=0;i<7;i++)B.cyl(.34,12,M.steelD,-14,.5+(i%2)*.62,-3+i*.9,0,0,Math.PI/2,true);B.box(.5,.5,8,M.dark,-9,.25,0);B.box(.5,.5,8,M.dark,-19,.25,0);
  B.box(8,2.4,4.2,M.steelD,-3,1.2,14);B.box(8.1,.2,4.3,M.orange,-3,2.45,14);
  // mangueira de retorno (circulação reversa) até o tanque
  const hc=new THREE.CatmullRomCurve3([V(0,16,1.2),V(2.5,12,4),V(4,7,9),V(-1,4,13),V(-3,2.6,14)].map(v=>v.applyMatrix4(B.base)));B.world(new THREE.TubeGeometry(hc,60,.38,8),M.pipe);
  const g=new THREE.Group();g.position.set(p.x,gy,p.z);g.rotation.y=.35;world.add(g);
  // bloco móvel entre os mastros (com sapatas amarelas), cabos e coluna de perfuração girando
  const head=new THREE.Group();g.add(head);mesh(UB,M.steelD,head,0,0,0,5.2,1.6,1.8);mesh(UB,M.dark,head,0,.2,0,3,2.2,2);for(const sx of[-1,1])mesh(UB,M.yellow,head,sx*3.7,0,0,1.5,1.8,2.2);const fl=mesh(UB,M.steel,head,0,-1.5,0,2.2,.5,2.2);mesh(UC,M.steel,head,0,1.4,0,.5,1,.5);
  const cg=new THREE.CylinderGeometry(.08,.08,1,6),cab=[-.8,.8].map(x=>mesh(cg,M.black,g,x,0,0));
  const pg=new THREE.CylinderGeometry(.42,.42,1,12);pg.translate(0,-.5,0);const pipe=mesh(pg,M.steelD,g,0,0,0);
  DYN.push(t=>{const y=lerp(9,27,.5+.5*Math.sin(t*.12));head.position.y=y;pipe.position.y=y-1.6;pipe.scale.y=y-1.6+.2;fl.rotation.y=t*2.2;pipe.rotation.y=t*2.2;cab.forEach((c,i)=>{c.position.y=(top+.2+y+.8)/2;c.scale.y=top+.2-y-.8});dustAt(0,V(p.x+3*Math.random()-1.5,gy+2.4,p.z+3*Math.random()-1.5))});
ANCH.blind=V(p.x,gy+top+4,p.z);{const v=V(14,4.5,-3.4).applyAxisAngle(V(0,1,0),.35);ANCH.hpu=V(p.x+v.x,gy+v.y,p.z+v.z)}}

 // ============ 2) cava: escavadeira, caminhões
 {const sx=44,sz=14,sy=height(sx,sz);const sh=shovel();sh.position.set(sx,sy,sz);sh.rotation.y=Math.PI*.15;world.add(sh);
  const lt=truck();const lx=30,lz=-6;lt.position.set(lx,height(lx,lz),lz);lt.rotation.y=-.5;world.add(lt);
  const u=sh.userData;
  DYN.push(t=>{const c=(t*.16)%1;// ciclo: cava → gira → descarrega → volta
   const sw=c<.35?0:c<.5?smooth((c-.35)/.15):c<.75?1:1-smooth((c-.75)/.25);u.up.rotation.y=-sw*2.1;
   u.boom.rotation.z=c<.35?.35-.25*Math.sin(c/.35*Math.PI):.42;u.arm.rotation.z=c<.35?-1.1+.9*(c/.35):-.5;u.bk.rotation.z=c>.5&&c<.68?-1.2:-.2;
   lt.userData.load.visible=((t*.16)%3)>1;if(c<.35)dustAt(1,V(sx+14+Math.random()*3,sy+1,sz+Math.random()*4-2))});
  ANCH.ctxHaul=V(sx,sy+14,sz);
  for(let i=0;i<6;i++){const k=1+(i%5),r=PIT_R-BW*(k+.3),dir=i%2?1:-1,th0=i*1.7,tr=truck(),sp=7/(r*1.12);tr.userData.load.visible=dir>0;world.add(tr);
   DYN.push(t=>{const a=th0+dir*t*sp,x=EX*r*Math.cos(a),z=r*Math.sin(a);tr.position.set(x,height(x,z),z);
    const dx=-EX*r*Math.sin(a)*dir,dz=r*Math.cos(a)*dir;tr.rotation.y=-Math.atan2(dz,dx);for(const w of tr.userData.w)w.rotation.z=-t*4.5;
    if(Math.random()<.25)dustAt(2,V(x-dx/Math.hypot(dx,dz)*6,tr.position.y+.8,z-dz/Math.hypot(dx,dz)*6))})}}

 // ============ 3) britador, correia e planta
 const cx0=178,cz0=-36,cy0=height(cx0,cz0);
 {B.at(cx0,cy0,cz0);B.box(9,7,9,M.navy,0,3.5,0);B.cyl(4.5,.4,M.steelD,0,7.2,0);B.put(new THREE.CylinderGeometry(5,1.6,4.5,16),M.steel,new THREE.Matrix4().makeTranslation(0,9.6,0));B.box(10,.3,.3,M.orange,0,7.4,4.6)}
 const P=PADS.plant,py=P.h,a0=V(cx0+3,cy0+8.5,cz0-1),a1=V(P.x-16,py+30,P.z-12);
 {B.at(0,0,0);const len=a0.distanceTo(a1),dir=a1.clone().sub(a0).normalize(),side=V(0,0,0).crossVectors(dir,V(0,1,0)).normalize();
  B.world(UB,M.rubber,orient(a0,a1,2.2,.35));for(const s of[-1,1])B.world(UB,M.steel,orient(a0.clone().addScaledVector(side,s*1.35).add(V(0,.3,0)),a1.clone().addScaledVector(side,s*1.35).add(V(0,.3,0)),.25,.9));
  B.world(UB,M.white,orient(a0.clone().add(V(0,1.8,0)),a1.clone().add(V(0,1.8,0)),3.2,.15));
  {const qv=new THREE.Quaternion().setFromUnitVectors(V(0,1,0),side);for(let d=4;d<len-2;d+=3){const p=a0.clone().addScaledVector(dir,d).add(V(0,.1,0));BD.world(UC8,M.steelD,new THREE.Matrix4().compose(p,qv,V(.26,2.5,.26)))}}
  for(let d=10;d<len-4;d+=12){const p=a0.clone().addScaledVector(dir,d),gy=height(p.x,p.z);for(const s of[-1,1]){const q=p.clone().addScaledVector(side,s*1.2);B.world(UB,M.steelD,new THREE.Matrix4().compose(V(q.x,(gy+p.y)/2,q.z),new THREE.Quaternion(),V(.45,p.y-gy,.45)))}
   B.world(UB,M.steelD,orient(p.clone().addScaledVector(side,-1.3).add(V(0,-.6,0)),p.clone().addScaledVector(side,1.3).add(V(0,-.6,0)),.4,.4))}
  // minério andando na correia (instâncias)
  const ON=110;ores=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.55,0),M.ore,ON);ores.castShadow=true;world.add(ores);
  const om=new THREE.Matrix4(),oq=new THREE.Quaternion(),seeds=[...Array(ON)].map(()=>[Math.random(),Math.random()-.5,.6+Math.random()*.8]);
  DYN.push(t=>{for(let i=0;i<ON;i++){const s=seeds[i],u=(s[0]+t*.028)%1,p=a0.clone().lerp(a1,u).addScaledVector(side,s[1]*1.4);p.y+=.55;oq.setFromEuler(new THREE.Euler(s[1]*5,s[0]*9,0));om.compose(p,oq,V(s[2],s[2]*.8,s[2]));ores.setMatrixAt(i,om)}ores.instanceMatrix.needsUpdate=true})}
 {B.at(P.x,py,P.z);B.box(46,22,28,M.corr,10,11,-5);B.box(46.4,.6,28.4,M.navy,10,22.2,-5);B.box(46.2,1.2,28.2,M.navy,10,6,-5);
  B.box(9,36,9,M.corr,-16,18,-12);B.box(9.4,.6,9.4,M.navy,-16,36.2,-12);B.box(4,3,9.4,M.corr,-16,34,-12);
  for(const[x,z]of[[28,18],[38,18],[48,18]]){B.cyl(4.4,19,M.conc,x,9.5,z);B.put(new THREE.ConeGeometry(4.4,2.4,18),M.conc,new THREE.Matrix4().makeTranslation(x,20.2,z))}
  for(const[x,z,r]of[[-12,30,10],[14,34,8]]){B.cyl(r,4.2,M.conc,x,2.1,z);B.cyl(r-.6,.1,M.water,x,4.1,z);B.box(r*2,.4,.6,M.steelD,x,4.6,z)}
  B.put(new THREE.ConeGeometry(15,10,20),M.ore,new THREE.Matrix4().makeTranslation(-36,5,14));BD.base.copy(B.base);for(const x of[28,38,48])ladderD(x,0,19,22.5);ladderD(-11.4,0,36,-12,PI2);railD(-13,33,22.4,9.2);railD(-13,33,22.4,-19.2);
  for(let i=0;i<5;i++)B.box(1.6,6,.12,M.glass,-8+i*6,14,9.06);}
 ANCH.ctxPlant=V(P.x-16,py+40,P.z-12);

 // ============ 4) estação de bombas Wirth (TPM triplex + DPM duplex) + mineroduto
 const S=PADS.pumps,sy=S.h;
 {B.at(S.x,sy,S.z);BD.base.copy(B.base);for(const x of[-16,0,16])for(const z of[-9.5,9.5])B.box(.6,11,.6,M.steel,x,5.5,z);B.box(35,.4,20.5,M.corr,0,11.2,0);B.box(35,.9,.4,M.navy,0,10.6,10.3);B.box(34,.2,19,M.conc,0,.1,0);
  for(const z of[-9.5,9.5])for(let x=-15;x<=15;x+=3.75)BD.box(.12,.5,.12,M.steel,x,10.9,z);BD.box(34,.2,.2,M.steel,0,10.7,-9.5);BD.box(34,.2,.2,M.steel,0,10.7,9.5);
  B.cyl(8,6,M.conc,-28,3,0);B.cyl(7.5,.1,M.ore,-28,5.9,0);B.box(16,.5,.5,M.steelD,-28,6.4,0);B.box(1.4,1.6,1.4,M.navy,-28,7.4,0);ladderD(-28,0,6.2,8.1);
  tpmB(B,0,-4.8);dpmB(B,0,4.8);BD.base.copy(B.base);
  B.cyl(.55,12,M.pipe,9,4.5,0,PI2);for(const z of[-4.8,4.8])B.cyl(.28,6.8,M.pipe,5.6,4.5,z,0,0,PI2);B.cyl(.55,3.1,M.pipe,9,2.95,0);B.cyl(.6,1.4,M.pipe,9.7,1.4,0,0,0,PI2);
  B.cyl(.5,22,M.pipe,-16,.7,-4.8,0,0,PI2);B.cyl(.5,22,M.pipe,-16,.7,4.8,0,0,PI2);
  railD(-15,15,0,-9.1);railD(-15,15,0,9.1);B.box(4,1.6,1.2,M.white,13,.9,8.3);BD.box(.05,.9,.9,M.navy,13,1.1,7.68)}
 {const g=new THREE.Group();g.position.set(S.x,sy,S.z);world.add(g);
  const t3=[-1.3,0,1.3].map(dz=>mesh(UB,M.steel,g,.3,2.3,-4.8+dz,1.2,.32,.32)),d2=[-1.1,1.1].map(dz=>mesh(UB,M.steel,g,.3,2.3,4.8+dz,1.4,.42,.42));
  DYN.push(t=>{t3.forEach((r,i)=>r.position.x=.3+.3*Math.sin(t*3.4+i*2.094));d2.forEach((r,i)=>r.position.x=.3+.3*Math.sin(t*1.9+i*Math.PI/2))})}
 {const pts=[V(S.x+10,0,S.z),V(S.x+30,0,S.z+20),V(S.x+60,0,S.z+55),V(S.x+90,0,S.z+90),V(POND.x-48,0,POND.z-34)].map(v=>(v.y=height(v.x,v.z)+1.4,v));
  const crv=new THREE.CatmullRomCurve3(pts);const samples=crv.getSpacedPoints(80);samples.forEach(v=>v.y=Math.max(height(v.x,v.z)+1.3,v.y));const c2=new THREE.CatmullRomCurve3(samples);
  B.at(0,0,0);B.world(new THREE.TubeGeometry(c2,180,.75,12),M.pipe);
  for(let i=2;i<samples.length;i+=4){const s=samples[i],g=height(s.x,s.z);B.world(UB,M.conc,new THREE.Matrix4().compose(V(s.x,(g+s.y)/2-.3,s.z),new THREE.Quaternion(),V(1.6,s.y-g,1.6)))}
  const tg=new THREE.TorusGeometry(.86,.16,6,16);for(let u=.01;u<1;u+=.012){const p=c2.getPointAt(u),tn=c2.getTangentAt(u);BD.world(tg,M.steelD,new THREE.Matrix4().compose(p,new THREE.Quaternion().setFromUnitVectors(V(0,0,1),tn),V(1,1,1)))}
  const cv=document.createElement('canvas');cv.width=64;cv.height=8;const cx=cv.getContext('2d'),gr=cx.createLinearGradient(0,0,64,0);gr.addColorStop(0,'rgba(255,179,71,0)');gr.addColorStop(.7,'rgba(255,179,71,.95)');gr.addColorStop(1,'rgba(255,179,71,0)');cx.fillStyle=gr;cx.fillRect(0,0,64,8);
  const st=new THREE.CanvasTexture(cv);st.wrapS=THREE.RepeatWrapping;st.repeat.set(60,1);
  const flow=new THREE.Mesh(new THREE.TubeGeometry(c2,180,.8,10),new THREE.MeshBasicMaterial({map:st,transparent:true,depthWrite:false,opacity:.85}));world.add(flow);DYN.push(t=>{st.offset.x=-t*.9})}
 {const r=(v,a)=>v.applyAxisAngle(V(0,1,0),0);ANCH.tpm=V(S.x,sy+8,S.z-4.8);ANCH.dpm=V(S.x+3,sy+8.5,S.z+4.8)}

 // ============ 4b) autoclave (HPAL) com bomba Wirth de alimentação, ao lado da planta
 {const P2=PADS.plant;B.at(P2.x,P2.h,P2.z);BD.base.copy(B.base);
  B.cyl(3.4,26,M.steelD,24,5.6,-38,0,0,PI2);B.put(US,M.steelD,new THREE.Matrix4().compose(V(11,5.6,-38),new THREE.Quaternion(),V(1.6,3.4,3.4)));B.put(US,M.steelD,new THREE.Matrix4().compose(V(37,5.6,-38),new THREE.Quaternion(),V(1.6,3.4,3.4)));
  for(const x of[14,24,34])B.box(1.2,3.4,6,M.conc,x,1.7,-38);for(let i=0;i<5;i++){const x=15+i*4.5;B.cyl(.45,2.2,M.steel,x,9.8,-38);B.box(1.2,1.4,1.2,M.navy,x,11.5,-38);BD.cyl(.6,.1,M.steel,x,9.1,-38)}
  for(let x=13;x<=35;x+=4)BD.cyl(3.48,.15,M.steel,x,5.6,-38,0,0,PI2);railD(12,36,9,-35.6);railD(12,36,9,-40.4);BD.box(24,.1,5,M.steelD,24,9.05,-38);ladderD(38.5,0,9,-36);
  B.cyl(2.4,13,M.steel,46,6.5,-38);B.sph(2.4,M.steel,46,13,-38);B.cyl(.5,6,M.pipe,42,12,-38,0,0,PI2);
  tpmB(B,-8,-38);BD.base.copy(B.base);
  for(let i=0;i<4;i++){const x=1+i*1.6;B.cyl(.32,8,M.steel,x,4.8,-35.4);B.cyl(.32,1.6,M.steel,x+.8,8.8,-35.4,0,0,PI2);B.cyl(.45,.9,M.orange,x,6.6,-35.4)}
  B.cyl(.4,9,M.pipe,6,4.4,-38,0,0,PI2);B.cyl(.4,4,M.pipe,9.6,4.6,-36.5,PI2)}
 ANCH.autoclave=V(PADS.plant.x-8,PADS.plant.h+9,PADS.plant.z-38);

 // ============ 2b) desaguamento no fundo da cava (Wirth TPM)
 {const dx=-24,dz=-32,dy=height(dx,dz);B.at(dx,dy,dz,.6);tpmB(B,0,0);BD.base.copy(B.base);
  const sump=new THREE.Mesh(new THREE.CircleGeometry(7,40),M.water);sump.rotation.x=-Math.PI/2;sump.position.set(-40,height(-40,-18)+.35,-18);world.add(sump);
  const th=Math.atan2(dz,dx/EX),pts=[];pts.push(V(-40,height(-40,-18)+.6,-18),V(dx-4,dy+.8,dz));for(let r=Math.hypot(dx/EX,dz)+6;r<ROUT+30;r+=2.5){const x=EX*r*Math.cos(th),z=r*Math.sin(th);pts.push(V(x,height(x,z)+.9,z))}
  B.at(0,0,0);B.world(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts,false,'centripetal'),260,.45,8),M.pipe);
  const e=pts[pts.length-1];B.cyl(3,3.5,M.conc,e.x,e.y+1,e.z);ANCH.dewater=V(dx,dy+7,dz)}


 // ============ 5) fundações: PBA sobre o revestimento + guindaste
 const F=PADS.found,fy=F.h;
 {B.at(F.x,fy,F.z,-.4);BD.base.copy(B.base);const WH=M.white,BL=M.blue2;
  for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){if(!i&&!j)continue;B.cyl(1.7,.9,M.conc,i*10,.45,j*10);B.cyl(1.2,.06,M.steelD,i*10,.92,j*10)}
  // plataforma tipo balsa (foto da PBA 615 e 936e): dois flutuadores, convés cinza, guarda-corpo amarelo
  for(const s of[-1,1]){B.box(15.4,1.6,2.8,M.dark,0,.8,s*4.0);for(let i=0;i<14;i++)BD.box(.7,.12,2.9,M.steelD,-7.0+i*1.08,1.62,s*4.0)}
  B.box(16,.45,11,M.steelD,0,1.95,0);B.box(16.2,.2,.3,BL,0,1.7,5.55);B.box(16.2,.2,.3,BL,0,1.7,-5.55);
  railD(-8,8,2.2,5.6);railD(-8,8,2.2,-5.6);for(const sx of[-1,1]){for(let z=-5.6;z<=5.6;z+=2.24)BD.box(.07,1.05,.07,M.yellow,sx*8,2.72,z);BD.box(.07,.07,11.2,M.yellow,sx*8,3.25,0);BD.box(.06,.06,11.2,M.yellow,sx*8,2.75,0)}
  // colar giratório azul, anel vermelho e revestimento
  B.cyl(2.8,1.5,BL,0,3.0,0);B.cyl(3.0,.25,M.sblue,0,2.3,0);B.cyl(2.0,.5,M.red,0,3.9,0);B.cyl(1.05,6,M.steel,0,5.4,0);for(let i=0;i<16;i++){const a=i/16*Math.PI*2;BD.cyl(.1,.3,M.steel,Math.cos(a)*2.55,3.8,Math.sin(a)*2.55,0,0,0,true)}
  // pórtico branco: duas colunas com cremalheira, escadas e viga superior
  for(const sx of[-1,1]){B.box(1.1,15.5,1.4,WH,sx*3.9,10.2,0);B.box(.25,15,.4,M.dark,sx*3.9-sx*.65,10.2,0);for(let y=3;y<17;y+=.5)BD.box(.15,.14,.5,M.steelD,sx*3.9-sx*.62,y,0);ladderD(sx*4.6,2.3,17.6,.2,PI2)}
  B.box(9.6,1.3,1.8,WH,0,18.2,0);B.box(2.4,.9,1.4,WH,0,19.1,0);B.box(8,.3,1.2,M.steelD,0,10,0);
  B.beam(V(-3.9,3,.8),V(3.9,9.6,.8),.25,WH,.25);B.beam(V(3.9,3,.8),V(-3.9,9.6,.8),.25,WH,.25);
  // cabine azul na frente à esquerda, com vidros, porta e teto
  B.box(4.4,3.1,3.6,BL,-5.6,3.85,3.2);B.box(.06,1.3,2.0,M.glass,-3.37,4.5,3.2);B.box(2.4,1.2,.06,M.glass,-5.6,4.5,5.02);B.box(.06,2.0,.9,M.dark,-3.37,3.4,4.5);B.box(1.2,.3,1.2,WH,-5.6,5.55,3.2);B.box(4.6,.2,3.8,M.dark,-5.6,5.5,3.2);
  // tambor de guincho branco e rolo de mangueira
  B.cyl(.9,1.6,WH,5.8,3.1,3.8,PI2);B.cyl(1.0,.12,M.steel,5.8,3.1,4.6,PI2);B.cyl(1.0,.12,M.steel,5.8,3.1,3.0,PI2);B.put(new THREE.TorusGeometry(1.2,.22,8,24),M.rubber,new THREE.Matrix4().makeTranslation(-3,2.5,-3.5));
  hpuB(B,-12,14);bitB(B,-15,-12);BD.base.copy(B.base);B.box(7,2.4,4,M.steelD,11,1.2,-14);
  // guindaste de esteira com lança treliçada
  B.box(9,1.6,1.6,M.dark,18,.8,-9);B.box(9,1.6,1.6,M.dark,18,.8,-3);B.box(7,3,5,M.yellow,18,3.2,-6);B.box(2.6,2.4,2,M.yellow,20,5.6,-4);
  const b0=V(15,4.5,-6),b1=V(4,44,-1.5);const bd=b1.clone().sub(b0).normalize(),bs=V(0,0,0).crossVectors(bd,V(0,1,0)).normalize(),bu=V(0,0,0).crossVectors(bs,bd);
  for(const[a,b]of[[1,1],[1,-1],[-1,1],[-1,-1]])B.beam(b0.clone().addScaledVector(bs,a*.8).addScaledVector(bu,b*.8),b1.clone().addScaledVector(bs,a*.3).addScaledVector(bu,b*.3),.22,M.yellow);
  for(let d=3;d<40;d+=3.2){const p=b0.clone().lerp(b1,d/41),s=lerp(.8,.3,d/41);B.beam(p.clone().addScaledVector(bs,-s).addScaledVector(bu,s),p.clone().addScaledVector(bs,s).addScaledVector(bu,-s),.12,M.yellow);B.beam(p.clone().addScaledVector(bs,-s).addScaledVector(bu,-s),p.clone().addScaledVector(bs,s).addScaledVector(bu,s),.12,M.yellow)}
  B.beam(b1,V(1,24,-1),.1,M.dark);B.box(.8,1,.8,M.yellow,1,23.5,-1)}
 {const g=new THREE.Group();g.position.set(F.x,fy,F.z);g.rotation.y=-.4;world.add(g);const kg=new THREE.CylinderGeometry(.6,.6,1,12);kg.translate(0,-.5,0);
  const kelly=mesh(kg,M.steelD,g,0,14,0,1,8,1);const mark=mesh(UB,M.orange,g,.6,9,0,.18,1.2,.18);
  // cabeça rotativa azul com motores, pescoço de ganso comprido para a direita (foto) e mangueira
  const head=new THREE.Group();g.add(head);mesh(UB,M.blue2,head,0,0,0,2.8,2.6,2.4);for(const sx of[-1,1])mesh(UB,M.steelD,head,sx*2.1,0,0,1.6,1.8,1.3);
  for(const sx of[-1,1]){mesh(UC,M.blue2,head,sx*.8,1.9,0,.55,1.7,.55);mesh(UC,M.dark,head,sx*.8,2.85,0,.5,.2,.5)}mesh(UC,M.steel,head,0,-1.45,0,.8,.5,.8);
  const gn=new THREE.CatmullRomCurve3([V(0,1.2,0),V(0,3.2,0),V(.7,4.0,0),V(2.4,4.1,0),V(4.2,3.7,0),V(5.0,2.6,0),V(5.1,1.5,0)]);mesh(new THREE.TubeGeometry(gn,48,.45,12),M.blue2,head);mesh(UC,M.steel,head,5.1,1.2,0,.6,.35,.6);
  const hose=new THREE.CatmullRomCurve3([V(5.1,1.0,0),V(5.6,-1.5,.5),V(6.4,-4,1.6),V(6.8,-6,2.4)]);mesh(new THREE.TubeGeometry(hose,30,.28,8),M.rubber,head);
  DYN.push(t=>{const hy=lerp(11,16,.5+.5*Math.sin(t*.25));head.position.y=hy;kelly.position.y=hy-1.6;kelly.scale.y=hy-1.6-8.4;kelly.rotation.y=t*1.6;
   mark.position.set(Math.cos(t*1.6)*.6,lerp(9.2,hy-2,.5),-Math.sin(t*1.6)*.6);mark.rotation.y=t*1.6;if(Math.random()<.4)dustAt(3,V(F.x+Math.random()*3-1.5,fy+3.8,F.z+Math.random()*3-1.5))})}
 ANCH.pba=V(F.x,fy+20.5,F.z);{const R2=v=>{v.applyAxisAngle(V(0,1,0),-.4);return V(F.x+v.x,fy+v.y,F.z+v.z)};ANCH.tools=R2(V(-15,4,-12));ANCH.hpu5=R2(V(-12,4.5,14))}
 ANCH.mining=V(-30,-60,-10);
 B.build(world);DET=new THREE.Group();BD.build(DET,false);world.add(DET);
}

// ---------------------------------------------------------------- visão de inovação 1: fluxo do processo (minério → slurry → rejeitos → água de volta)
let FLOW=null;const flowTex=[];
function flowTube(pts,color,r=1.1,speed=1){const cv=document.createElement('canvas');cv.width=128;cv.height=8;const c=cv.getContext('2d'),g=c.createLinearGradient(0,0,128,0);
 g.addColorStop(0,color+'00');g.addColorStop(.55,color+'ff');g.addColorStop(.62,'#ffffffff');g.addColorStop(.7,color+'00');g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(0,0,128,8);
 const tx=new THREE.CanvasTexture(cv);tx.wrapS=THREE.RepeatWrapping;const crv=new THREE.CatmullRomCurve3(pts,false,'centripetal');tx.repeat.set(Math.max(2,crv.getLength()/28),1);flowTex.push([tx,speed]);
 const m=new THREE.Mesh(new THREE.TubeGeometry(crv,Math.max(24,pts.length*6),r,8),new THREE.MeshBasicMaterial({map:tx,transparent:true,depthWrite:false,opacity:.95,fog:false}));m.renderOrder=5;
 const halo=new THREE.Mesh(m.geometry,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.18,depthWrite:false,fog:false}));halo.scale.setScalar(1);m.add(halo);return m}
const lift=(x,z,h=7)=>V(x,height(x,z)+h,z);
const FLOWS=[// [pontos xz, cor, legenda pt, legenda en]
 {k:'ore',c:'#c98a4a',pt:'Minério',en:'Ore',p:()=>{const a=[];const th=Math.atan2(14,44/EX);for(let r=40;r<=ROUT;r+=6)a.push(lift(EX*r*Math.cos(th),r*Math.sin(th)));a.push(lift(178,-36,12));return a}},
 {k:'conv',c:'#c98a4a',pt:'Minério britado',en:'Crushed ore',p:()=>[lift(178,-36,14),lift(250,-56,30),lift(314,-74,36),lift(330,-62,30)]},
 {k:'slurry',c:'#ff9a2e',pt:'Slurry',en:'Slurry',p:()=>[lift(330,-62,28),lift(345,-10,18),lift(322,40,14),lift(300,72,12)]},
 {k:'auto',c:'#ff5a3c',pt:'Slurry quente (HPAL)',en:'Hot slurry (HPAL)',p:()=>[lift(322,-100,12),lift(340,-112,16),lift(355,-100,14)]},
 {k:'tail',c:'#ffd166',pt:'Rejeitos',en:'Tailings',p:()=>[lift(310,72,10),lift(340,92,8),lift(370,125,8),lift(400,160,8),lift(420,190,8)]},
 {k:'water',c:'#3fb6ff',pt:'Água recuperada',en:'Recovered water',p:()=>[lift(430,170,10),lift(440,80,40),lift(400,-20,50),lift(345,-45,26)]},
 {k:'dew',c:'#3fb6ff',pt:'Desaguamento',en:'Dewatering',p:()=>{const a=[lift(-24,-32,6)];const th=Math.atan2(-32,-24/EX);for(let r=48;r<=ROUT+30;r+=6)a.push(lift(EX*r*Math.cos(th),r*Math.sin(th),6));return a}}];
function buildFlow(){FLOW=new THREE.Group();FLOW.visible=false;for(const f of FLOWS){f.pts=f.p();FLOW.add(flowTube(f.pts,f.c,f.k==='water'?.9:1.15,f.k==='water'?.6:1))}world.add(FLOW);
 DYN.push(t=>{if(FLOW.visible)for(const[tx,s]of flowTex)tx.offset.x=-t*.35*s})}
function setFlow(v){if(!FLOW)return;FLOW.visible=v;$('#flowBtn').setAttribute('aria-pressed',v);$('#flowLeg').hidden=!v;renderFlowLeg();mmDirty=true}
function renderFlowLeg(){$('#flowLeg').innerHTML=FLOWS.filter((f,i,a)=>a.findIndex(x=>x.pt===f.pt)===i).map(f=>`<span><i style="background:${f.c}"></i>${f[L]}</span>`).join('')}

// ---------------------------------------------------------------- pacote de detalhes B (Ultra): torres de luz, tambores, cones, placas, caminhonetes, pilhas e bandejas de cabos
function buildPackB(){const B2=new Batch(),lamp=new THREE.MeshBasicMaterial({color:0xfff2c8}),gy=(x,z)=>height(x,z),rnd=(a,b)=>a+Math.random()*(b-a);
 for(const[x,z,ry]of[[-48,-205,.3],[270,100,1.2],[366,-30,2.1],[-250,150,.5],[132,-150,.9],[-118,-118,.1],[330,-118,.4]]){B2.at(x,gy(x,z),z,ry);
  B2.box(3.8,.5,2.6,M.yellow,0,.55,0);B2.cyl(.16,11,M.steel,0,6,0);B2.cyl(.3,.5,M.dark,0,.9,0);B2.box(.5,.5,.5,M.dark,0,11.4,0);B2.box(3.6,.7,.5,M.dark,0,12,0);
  for(let i=0;i<4;i++){B2.box(.62,.5,.14,lamp,-1.3+i*.86,12,.32)}for(const s of[-1,1])B2.beam(V(s*1.6,.9,0),V(0,5,0),.12,M.steelD,.12)}
 const S=PADS.pumps,P=PADS.plant,SH=PADS.shaft,F=PADS.found;
 const cols=[M.blue,M.red,M.orange,M.navy];let ci=0;
 for(const[bx,bz]of[[S.x-24,S.z+16],[SH.x+11,SH.z+20],[P.x+40,P.z+26],[F.x+22,F.z-20],[P.x-30,P.z+34]]){for(let i=0;i<5;i++){const x=bx+(i%3)*1.15+rnd(-.1,.1),z=bz+Math.floor(i/3)*1.2,y=gy(x,z),m=cols[ci++%4];
  B2.at(x,y,z,0);B2.cyl(.45,.95,m,0,.48,0);for(const h of[.12,.48,.84])B2.cyl(.47,.05,M.steelD,0,h,0);B2.cyl(.3,.04,M.steel,0,.97,0)}}
 const cone=new THREE.ConeGeometry(.26,.72,8);const cm=new THREE.Matrix4();
 for(let i=0;i<46;i++){const a=i/46*Math.PI*2,r=PIT_R+11,x=EX*r*Math.cos(a),z=r*Math.sin(a),y=gy(x,z);if(i%3===0)continue;B2.world(cone,M.orange,cm.makeTranslation(x,y+.36,z));B2.at(x,y,z,0);B2.cyl(.2,.1,M.white,0,.4,0)}
 for(const[x,z,ry,w]of[[S.x+26,S.z-18,.2,3],[P.x-20,P.z+44,-.4,3],[F.x-26,F.z+8,1.4,2.4],[SH.x-22,SH.z+14,.8,2.6],[PADS.pumps.x-46,PADS.pumps.z+8,.1,2.4]]){const y=gy(x,z);B2.at(x,y,z,ry);B2.cyl(.07,3.2,M.steel,-w/3,1.6,0);B2.cyl(.07,3.2,M.steel,w/3,1.6,0);B2.box(w,1.5,.08,M.yellow,0,3,0);B2.box(w-.3,.15,.1,M.dark,0,3.5,0);B2.box(w-.3,.15,.1,M.dark,0,2.55,0)}
 const wh=new THREE.CylinderGeometry(.46,.46,.34,12);wh.rotateX(Math.PI/2);
 for(const[x,z,ry]of[[S.x-36,S.z-26,.4],[P.x+20,P.z+50,-.2],[F.x+8,F.z+30,1.1],[SH.x+26,SH.z-6,2.6],[S.x+10,S.z+34,.7]]){const y=gy(x,z);B2.at(x,y,z,ry);
  B2.box(2.4,.9,2.0,M.white,1.25,1.2,0);B2.box(2.6,.5,2.05,M.white,-1.4,.85,0);B2.box(1.9,.7,1.9,M.white,.2,1.95,0);B2.box(.04,.5,1.6,M.glass,1.16,1.95,0);B2.box(.02,.4,.9,M.red,-1.4,1.25,1.04);B2.cyl(.02,2.4,M.steel,-2.5,2.2,.8);B2.box(.5,.3,.02,M.orange,-2.25,3.2,.8);
  for(const[wx,wz]of[[1.4,1],[1.4,-1],[-1.4,1],[-1.4,-1]])B2.put(wh,M.rubber,new THREE.Matrix4().makeTranslation(wx,.46,wz))}
 for(const[x,z,s]of[[P.x-60,P.z+8,1],[P.x-52,P.z-22,.7]]){const y=gy(x,z);B2.at(x,y,z,0);B2.put(new THREE.ConeGeometry(13*s,8*s,18),M.ore,new THREE.Matrix4().makeTranslation(0,4*s,0))}
 {B2.at(P.x,P.h,P.z,0);B2.box(38,.25,1,M.steelD,6,9.5,20);B2.box(38,.25,1,M.steelD,6,9.9,20);for(let x=-12;x<=24;x+=6){B2.box(.3,9.9,.3,M.steelD,x,4.95,20)}for(let x=-12;x<=24;x+=2)B2.box(.06,.5,1.1,M.steelD,x,9.7,20)}
 DETB=new THREE.Group();DETB.visible=false;B2.build(DETB,false);world.add(DETB)}
// --- poeira (pontos, atualizada na CPU: barata)
const DN=420,dPos=new Float32Array(DN*3),dLife=new Float32Array(DN),dVel=new Float32Array(DN*3);let dHead=0;
function dustAt(_k,p){if(!dust||!dust.visible)return;const i=dHead++%DN;dPos.set([p.x,p.y,p.z],i*3);dVel.set([(Math.random()-.5)*1.4,1+Math.random()*1.6,(Math.random()-.5)*1.4],i*3);dLife[i]=1}
function buildDust(){const cv=document.createElement('canvas');cv.width=cv.height=64;const c=cv.getContext('2d'),g=c.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(220,196,160,.9)');g.addColorStop(1,'rgba(220,196,160,0)');c.fillStyle=g;c.fillRect(0,0,64,64);
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(dPos,3));for(let i=0;i<DN;i++)dPos[i*3+1]=-999;
 dust=new THREE.Points(geo,new THREE.PointsMaterial({map:new THREE.CanvasTexture(cv),size:7,transparent:true,opacity:.45,depthWrite:false,sizeAttenuation:true}));dust.frustumCulled=false;world.add(dust)}
function stepDust(dt){for(let i=0;i<DN;i++){if(dLife[i]<=0)continue;dLife[i]-=dt*.35;if(dLife[i]<=0){dPos[i*3+1]=-999;continue}for(let k=0;k<3;k++)dPos[i*3+k]+=dVel[i*3+k]*dt}dust.geometry.attributes.position.needsUpdate=true}

// ---------------------------------------------------------------- câmera: visão geral + aproximação por operação, com órbita livre
const VIEWS=[{p:[330,230,430],t:[30,10,0]},{p:[42,30,-150],t:[-20,15,-228]},{p:[118,36,128],t:[30,5,4]},{p:[186,58,-178],t:[296,12,-62]},{p:[274,10,44],t:[302,3,72]},{p:[-326,15,166],t:[-288,9,118]}].map(c=>{
 const p=V(c.p[0],height(c.p[0],c.p[2])+c.p[1],c.p[2]),t=V(c.t[0],height(c.t[0],c.t[2])+c.t[1],c.t[2]),d=p.clone().sub(t),dist=d.length();
 return{t,dist,yaw:Math.atan2(d.x,d.z),pitch:Math.asin(d.y/dist)}});
const cam={t:VIEWS[0].t.clone(),dist:VIEWS[0].dist,yaw:VIEWS[0].yaw,pitch:VIEWS[0].pitch};
let fly=null,sec=0,drag=null;
const camP=V(0,0,0),camT=V(0,0,0);
const angLerp=(a,b,e)=>{let d=b-a;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return a+d*e};
function flyTo(i){const v=VIEWS[i];fly={a:{t:cam.t.clone(),dist:cam.dist,yaw:cam.yaw,pitch:cam.pitch},b:v,s:performance.now(),d:RM?1:1800}}
function camStep(now){if(fly){const k=clamp((now-fly.s)/fly.d,0,1),e=k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2,a=fly.a,b=fly.b;
  cam.t.lerpVectors(a.t,b.t,e);cam.yaw=angLerp(a.yaw,b.yaw,e);cam.pitch=lerp(a.pitch,b.pitch,e);cam.dist=lerp(a.dist,b.dist,e)+Math.sin(Math.PI*e)*Math.min(260,a.t.distanceTo(b.t)*.45);if(k>=1)fly=null}
 else if(!RM&&!drag)cam.yaw+=sec===0?.00022:.0005;
 const cp=Math.cos(cam.pitch);camT.copy(cam.t);camP.set(cam.t.x+Math.sin(cam.yaw)*cp*cam.dist,cam.t.y+Math.sin(cam.pitch)*cam.dist,cam.t.z+Math.cos(cam.yaw)*cp*cam.dist);
 const g=height(camP.x,camP.z)+3;if(camP.y<g)camP.y=g;return clamp(cam.dist*.55,40,320)}
// arrastar = girar em volta da operação; roda = aproximar/afastar
canvas.addEventListener('pointerdown',e=>{if(!entered)return;drag={x:e.clientX,y:e.clientY,id:e.pointerId};canvas.setPointerCapture(e.pointerId);fly=null});
canvas.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;cam.yaw-=(e.clientX-drag.x)*.005;cam.pitch=clamp(cam.pitch+(e.clientY-drag.y)*.004,.06,1.38);drag.x=e.clientX;drag.y=e.clientY});
const endDrag=e=>{if(drag&&e.pointerId===drag.id)drag=null};canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);
canvas.addEventListener('wheel',e=>{if(!entered)return;e.preventDefault();fly=null;const b=VIEWS[sec].dist;cam.dist=clamp(cam.dist*Math.exp(e.deltaY*.0012),sec?Math.max(12,b*.3):220,sec?b*2.8:1100)},{passive:false});

// ---------------------------------------------------------------- qualidade + FPS
const QL=[{pr:.75,sh:1024,trees:.35,rocks:.4,dust:0,pp:0,ao:0,det:0,hd:0},{pr:1,sh:2048,trees:.7,rocks:.75,dust:1,pp:1,ao:0,det:0,hd:0},{pr:1,sh:2048,trees:1,rocks:1,dust:1,pp:1,ao:1,det:1,hd:1},{pr:0,sh:4096,trees:1,rocks:1,dust:1,pp:1,ao:1,det:2,hd:1}];
const forced=(location.search.match(/[?&]q=([0-3])/)||[])[1];
let qAuto=forced==null,q=forced!=null?+forced:1,lowered=false;
(()=>{if(forced!=null)return;try{const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info'),name=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'';q=/intel|uhd|iris|mali|adreno|powervr|swiftshader|llvmpipe/i.test(name)?1:2}catch(e){q=1}})();
{const cp=store.get('hmh-mina-qcap');if(cp!=null&&forced==null)q=Math.min(q,+cp)}
const prFor=l=>l===3?clamp(3840/innerWidth,1,3):Math.min(devicePixelRatio||1,QL[l].pr)||QL[l].pr;
function applyQ(l){q=l;const c=QL[l];renderer.setPixelRatio(prFor(l));renderer.setSize(innerWidth,innerHeight,false);
 if(sun.shadow.mapSize.x!==c.sh){sun.shadow.mapSize.set(c.sh,c.sh);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null}}
 if(trees){trees.count=trunks.count=Math.round(trees.userData.max*c.trees);rocks.count=Math.round(rocks.userData.max*c.rocks)}if(dust)dust.visible=!!c.dust;if(DET)DET.visible=c.det>=1;if(DETB)DETB.visible=c.det>=2;ssao.enabled=!!c.ao;smaa.enabled=!!c.pp;composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(innerWidth,innerHeight);if(c.hd)loadHD();updQ()}
const draw=()=>QL[q].pp?composer.render():renderer.render(scene,camera);
const qBtn=$('#qBtn'),qMenu=$('#qMenu');let fpsNow=0;
function updQ(){$('#qLbl').textContent=(qAuto?U('auto')+' · ':'')+U('q')[q].split(' ')[0];qBtn.setAttribute('aria-label',U('qual')+': '+(qAuto?U('auto')+', ':'')+U('q')[q]);
 const w=Math.round(innerWidth*renderer.getPixelRatio()),h=Math.round(innerHeight*renderer.getPixelRatio());
 qMenu.innerHTML=`<button role="menuitemradio" data-q="a" aria-checked="${qAuto}">${U('auto')}</button>`+U('q').map((n,i)=>`<button role="menuitemradio" data-q="${i}" aria-checked="${!qAuto&&q===i}">${n}<small>${U('qf')[i]}</small></button>`).join('')+
  `<p class="info">${U('res')}: ${w}×${h}<br>${fpsNow?fpsNow+' '+U('fps'):''}</p>`;
 qMenu.querySelectorAll('button').forEach(b=>b.onclick=()=>{if(b.dataset.q==='a'){qAuto=true;lowered=false}else{qAuto=false;applyQ(+b.dataset.q)}updQ()})}
qBtn.onclick=e=>{e.stopPropagation();const on=!qMenu.classList.contains('on');qMenu.classList.toggle('on',on);qBtn.setAttribute('aria-expanded',on)};
addEventListener('click',e=>{if(!qMenu.contains(e.target)){qMenu.classList.remove('on');qBtn.setAttribute('aria-expanded',false)}});
let fFrames=0,fT=performance.now(),goodWin=0,coolUntil=0,fLast=0,fGap=false;
function fpsWatch(now){fFrames++;if(now-fLast>250)fGap=true;fLast=now;if(now-fT<2000)return;fpsNow=Math.round(fFrames*1000/(now-fT));fFrames=0;fT=now;$('#hudF').textContent=fpsNow+' '+U('fps');
 // janela com pausa longa (aba em segundo plano, painel oculto) não conta para a qualidade automática
 const gap=fGap;fGap=false;if(qMenu.classList.contains('on'))updQ();if(gap||!qAuto||!entered||now<coolUntil)return;
 if(fpsNow<38&&q>0){applyQ(q-1);lowered=true;goodWin=0;coolUntil=now+4000}else if(fpsNow>57&&q<2&&!lowered){if(++goodWin>=2){applyQ(q+1);goodWin=0;coolUntil=now+4000}}else goodWin=0}

// ---------------------------------------------------------------- interface
const tabs=$('#tabs');SECS.forEach((s,i)=>{const b=document.createElement('button');b.onclick=()=>go(i);tabs.appendChild(b);s.tab=b});
let shown=-1,entered=false;
function go(i){i=clamp(i,0,SECS.length-1);if(openId)closeP();sec=i;flyTo(i);setSec()}
function setSec(){SECS.forEach((s,i)=>{s.tab.classList.toggle('on',i===sec);i===sec?s.tab.setAttribute('aria-current','true'):s.tab.removeAttribute('aria-current')});
 $('#zoomOut').hidden=sec===0;$('#hudS').textContent=sec?`${pad(sec)} · ${TP(SECS[sec]).tab}`:TP(SECS[0]).tab;if(entered){fillCopy(sec);shown=sec}
 history.replaceState(null,'',sec?'#s'+sec:location.pathname+location.search);mmDirty=true}
$('#zoomOut').onclick=()=>go(0);document.querySelectorAll('.mcard .mn').forEach(b=>b.onclick=()=>{const c=b.closest('.mcard'),mn=c.classList.toggle('min');b.textContent=mn?'+':'–';b.setAttribute('aria-label',mn?'Expandir':'Minimizar');mmDirty=true});$('#flowBtn').onclick=()=>setFlow(!FLOW.visible);
const hots=$('#hots');
for(const[id,p]of Object.entries(PR)){const b=document.createElement('button');b.className='mhp off'+(p.ctx?' ctx':'');b.innerHTML='<i></i><span></span>';b.onclick=()=>openP(id);hots.appendChild(b);p.el=b}
// marcadores das operações na visão geral (clique = aproxima)
const OPM=[],OPA=[];for(let i=1;i<SECS.length;i++){const b=document.createElement('button');b.className='mhp op off';b.innerHTML=`<i>${i}</i><span></span>`;b.onclick=()=>go(i);hots.appendChild(b);OPM.push(b);OPA.push(VIEWS[i].t.clone().add(V(0,14,0)))}
function fillCopy(i){const s=TP(SECS[i]);$('#cEb').textContent=s.eb;$('#cT').textContent=s.t;$('#cP').textContent=s.p;
 $('#cChips').innerHTML=(i===0?SECS.slice(1).map((o,k)=>`<button class="ctx" data-op="${k+1}">${k+1} · ${TP(o).tab}</button>`).join(''):'')+SECS[i].prods.map(id=>`<button data-id="${id}"${PR[id].ctx?' class="ctx"':''}>${TP(PR[id]).n}</button>`).join('');
 $('#cChips').querySelectorAll('button').forEach(b=>b.onclick=()=>b.dataset.op?go(+b.dataset.op):openP(b.dataset.id))}
// minimapa da operação
const mm=$('#mm'),mx=mm.getContext('2d');let mmDirty=true;const MB={x0:-390,x1:530,z0:-330,z1:330};
const mmXY=(x,z)=>[(x-MB.x0)/(MB.x1-MB.x0)*mm.width,(z-MB.z0)/(MB.z1-MB.z0)*mm.height];
function drawMM(){const dpr=Math.min(2,devicePixelRatio||1),W=Math.round(mm.clientWidth*dpr),H=Math.round(mm.clientHeight*dpr);if(!W)return;if(mm.width!==W||mm.height!==H){mm.width=W;mm.height=H}
 const c=mx,sx=W/(MB.x1-MB.x0),sz=H/(MB.z1-MB.z0);c.clearRect(0,0,W,H);c.fillStyle='#b9a77f';c.fillRect(0,0,W,H);
 const[cx,cy]=mmXY(0,0);for(let k=0;k<=KMAX;k++){const r=PIT_R-BW*k;c.beginPath();c.ellipse(cx,cy,EX*r*sx,r*sz,0,0,Math.PI*2);c.fillStyle=`rgb(${178-k*10},${116-k*7},${74-k*5})`;c.fill();c.strokeStyle='rgba(255,235,200,.5)';c.lineWidth=dpr*.7;c.stroke()}
 for(const p of Object.values(PADS)){const[x,y]=mmXY(p.x,p.z);c.beginPath();c.arc(x,y,p.r*sx,0,Math.PI*2);c.fillStyle='#d9d3c5';c.fill()}
 {const[x,y]=mmXY(POND.x,POND.z);c.beginPath();c.ellipse(x,y,POND.r*.86*sx,POND.r*.86*sz,0,0,Math.PI*2);c.fillStyle='#7a9c9b';c.fill()}
 c.lineCap='round';c.lineWidth=2.2*dpr;c.strokeStyle='#2f3d4a';c.beginPath();c.moveTo(...mmXY(178,-36));c.lineTo(...mmXY(314,-74));c.stroke();
 c.strokeStyle='#ffb347';c.beginPath();c.moveTo(...mmXY(310,72));c.quadraticCurveTo(...mmXY(360,120),...mmXY(397,181));c.stroke();
 if(FLOW&&FLOW.visible){c.lineWidth=2.4*dpr;c.setLineDash([5*dpr,4*dpr]);c.lineDashOffset=-performance.now()/60*dpr;for(const f of FLOWS){c.strokeStyle=f.c;c.beginPath();f.pts.forEach((p,i)=>{const[x,y]=mmXY(p.x,p.z);i?c.lineTo(x,y):c.moveTo(x,y)});c.stroke()}c.setLineDash([])}
 // câmera
 {const[x,y]=mmXY(camP.x,camP.z),[tx,ty]=mmXY(camT.x,camT.z),a=Math.atan2(ty-y,tx-x),fov=.42;c.beginPath();c.moveTo(x,y);c.arc(x,y,Math.min(70*dpr,Math.hypot(tx-x,ty-y)*1.2),a-fov,a+fov);c.closePath();c.fillStyle='rgba(255,255,255,.28)';c.fill();
  c.beginPath();c.arc(x,y,3.5*dpr,0,Math.PI*2);c.fillStyle='#fff';c.fill()}
 c.font=`600 ${11*dpr}px Inter,system-ui,sans-serif`;c.textAlign='center';c.textBaseline='middle';
 for(let i=1;i<SECS.length;i++){const[x,y]=mmXY(VIEWS[i].t.x,VIEWS[i].t.z),on=i===sec,hv=i===mmHover;c.beginPath();c.arc(x,y,(on||hv?11:9)*dpr,0,Math.PI*2);c.fillStyle=on?'#d9303c':'#0e2a4a';c.fill();c.lineWidth=2*dpr;c.strokeStyle='#fff';c.stroke();c.fillStyle='#fff';c.fillText(i,x,y+.5*dpr)}}
let mmHover=0;
const mmPick=e=>{const r=mm.getBoundingClientRect(),dpr=mm.width/r.width,px=(e.clientX-r.left)*dpr,py=(e.clientY-r.top)*dpr;let best=0,bd=22*dpr;for(let i=1;i<SECS.length;i++){const[x,y]=mmXY(VIEWS[i].t.x,VIEWS[i].t.z),d=Math.hypot(px-x,py-y);if(d<bd){bd=d;best=i}}return best};
mm.addEventListener('pointermove',e=>{const i=mmPick(e);if(i!==mmHover){mmHover=i;mmDirty=true;mm.style.cursor=i?'pointer':'default';mm.title=i?`${i} · ${TP(SECS[i]).t}`:''}});
mm.addEventListener('pointerleave',()=>{mmHover=0;mmDirty=true});
mm.addEventListener('click',e=>{const i=mmPick(e);if(i)go(i)});
mm.addEventListener('keydown',e=>{if(/^[1-5]$/.test(e.key))go(+e.key);if(e.key==='0')go(0)});
const panel=$('#panel'),scrim=$('#scrim');let openId=null,lastFocus=null,pTab='f',pImg=0;
let visor=null;
function media(){const p=PR[openId],t=TP(p),ph=$('#pPh');if(visor){visor.dispose();visor=null}
 if(pTab==='m'&&p.m){ph.className='ph mod';ph.style.backgroundImage='';ph.setAttribute('role','img');ph.setAttribute('aria-label',t.n);ph.innerHTML=`<span class="mdload">${U('prep')}</span><small class="mdnote">${U('mdInterp')}</small>`;
  visor=mountVisor(ph,p.m,{reduced:RM,onReady(){ph.querySelector('.mdload')?.remove()},onError(){const l=ph.querySelector('.mdload');if(l)l.textContent='—'}})}
 else if(pTab==='v'&&p.yt){ph.className='ph vid';ph.style.backgroundImage='';ph.removeAttribute('role');
  ph.innerHTML=`<iframe src="https://www.youtube-nocookie.com/embed/${p.yt}?autoplay=1&rel=0&modestbranding=1&hl=${L==='pt'?'pt-BR':'en'}" title="${t.n}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe>`}
 else{ph.innerHTML='';ph.className='ph'+(p.f?'':' none');ph.style.backgroundImage=p.f?`url("assets/fotos/${p.f[pImg]}")`:'';ph.setAttribute('role','img');ph.setAttribute('aria-label',t.n)}
 const pv=$('#pV');if(pv)pv.hidden=pTab==='v';const tb=$('#pTabs');tb.innerHTML=(p.f?`<button data-k="f" aria-pressed="${pTab==='f'}">${U('fotos')}</button>`:'')+(p.m?`<button data-k="m" aria-pressed="${pTab==='m'}">${U('modelo3d')}</button>`:'')+(p.yt?`<button data-k="v" aria-pressed="${pTab==='v'}">${U('video')}</button>`:'');tb.hidden=tb.children.length<2;
 tb.querySelectorAll('button').forEach(b=>b.onclick=()=>{pTab=b.dataset.k;media()});
 const th=$('#pTh');th.innerHTML=pTab==='f'&&p.f&&p.f.length>1?p.f.map((f,i)=>`<button style="background-image:url('assets/fotos/${f}')" aria-label="${U('fotos')} ${i+1}" aria-pressed="${i===pImg}"></button>`).join(''):'';
 th.querySelectorAll('button').forEach((b,i)=>b.onclick=()=>{pImg=i;media()})}
function openP(id,keep){const p=PR[id],t=TP(p);if(!keep||openId!==id){pTab=p.f?'f':'v';pImg=0}if(!openId)lastFocus=document.activeElement;openId=id;
 $('#pC').textContent=t.c;$('#pT').textContent=t.n;$('#pD').textContent=t.d;
 $('#pL').innerHTML=(p.u?`<a href="${BASE+p.u}" target="_blank" rel="noopener">${U('site')}</a>`:'')+(p.yt&&pTab!=='v'?`<button class="yt" id="pV">${U('video')}</button>`:'');
 const pv=$('#pV');if(pv)pv.onclick=()=>{pTab='v';openP(id,true)};
 if(!keep||!panel.classList.contains('on')||pTab!=='v'||!$('#pPh iframe'))media();
 panel.classList.add('on');scrim.classList.add('on');if(!keep)setTimeout(()=>$('#pX').focus({preventScroll:true}),200)}
function closeP(){if(!openId)return;openId=null;if(visor){visor.dispose();visor=null}$('#pPh').innerHTML='';panel.classList.remove('on');if(!eqEl.classList.contains('on'))scrim.classList.remove('on');if(lastFocus)lastFocus.focus({preventScroll:true})}
// lista de todos os equipamentos HMH para mineração
const eqEl=$('#eqList'),secOf=id=>SECS.findIndex(s=>s.prods.includes(id));
function renderEq(){$('#eqG').innerHTML=EQ.map(id=>{const p=PR[id],t=TP(p),s=secOf(id);return`<button class="eqc" data-id="${id}"><span class="im"${p.f?` style="background-image:url('assets/fotos/${p.f[0]}')"`:''}>${p.yt?'<i>▶</i>':''}</span><b>${t.n}</b><small>${t.c} · ${pad(s+1)} ${TP(SECS[s]).tab}</small></button>`}).join('');
 $('#eqG').querySelectorAll('button').forEach(b=>b.onclick=()=>{const id=b.dataset.id,s=secOf(id);setEq(false);const far=s!==sec;go(s);setTimeout(()=>openP(id),far&&!RM?1850:60)})}
function setEq(v){if(v===eqEl.classList.contains('on'))return;eqEl.classList.toggle('on',v);scrim.classList.toggle('on',v||!!openId);if(v){renderEq();setTimeout(()=>$('#eqX').focus({preventScroll:true}),150)}}
$('#eqBtn').onclick=()=>{closeP();setEq(true)};$('#eqX').onclick=()=>setEq(false);
$('#pX').onclick=closeP;scrim.onclick=()=>{closeP();setEq(false)};
addEventListener('keydown',e=>{if(e.key==='Escape'){if(openId)closeP();else if(eqEl.classList.contains('on'))setEq(false);else if(sec)go(0);qMenu.classList.remove('on');return}if(openId||!entered||eqEl.classList.contains('on'))return;
 if(/^[0-5]$/.test(e.key)&&!e.ctrlKey&&!e.metaKey)go(+e.key)});
function applyLang(){document.documentElement.lang=L==='pt'?'pt-BR':'en';document.querySelectorAll('[data-t]').forEach(e=>{if(e.id==='goBtn'&&ready)return;e.textContent=U(e.dataset.t)});
 for(const b of[$('#langBtn'),$('#introLang')]){(b.querySelector('.lt')||b).textContent=U('lang');b.setAttribute('aria-label',U('langNome'))}
 $('#introT').textContent=L==='pt'?'MINERAÇÃO':'MINING';$('#deepBtn').setAttribute('aria-label',U('deep'));if(ready)$('#goBtn').textContent=U('go');
 $('#pX').setAttribute('aria-label',U('fechar'));OPM.forEach((b,k)=>{b.querySelector('span').textContent=TP(SECS[k+1]).tab;b.setAttribute('aria-label',`${k+1} · ${TP(SECS[k+1]).t}`)});$('#zoomOut').setAttribute('aria-label',U('zoomOut'));mm.setAttribute('aria-label',U('mapa'));mmDirty=true;if(entered)setSec();renderFlowLeg();
 SECS.forEach((s,i)=>{const t=TP(s);s.tab.innerHTML=`<b>${pad(i+1)}</b> <span>${t.tab}</span>`;s.tab.setAttribute('aria-label',`${pad(i+1)} ${t.tab}`)});
 for(const p of Object.values(PR)){p.el.querySelector('span').textContent=TP(p).n;p.el.setAttribute('aria-label',TP(p).n)}
 if(entered)fillCopy(sec);if(openId)openP(openId,true);if(eqEl.classList.contains('on'))renderEq();updQ()}
const toggleLang=()=>{L=L==='pt'?'en':'pt';store.set('hmh-lang',L);applyLang()};$('#langBtn').onclick=toggleLang;$('#introLang').onclick=toggleLang;

// ---------------------------------------------------------------- início
let ready=false;
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(prFor(q));renderer.setSize(innerWidth,innerHeight,false);composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(innerWidth,innerHeight)});
(async()=>{
 applyLang();
 const [sky,soil,rock,gnd,grv,rustD,rustN,plR,plN,rubD,rubN,corD,corN,cnD,cnN,cnR]=await Promise.all([hdr(),tex('mina/soil_diff.webp'),tex('mina/rock_diff.webp'),tex('mina/ground_diff.webp'),tex('mina/gravel_diff.webp'),
  tex('mina/rusty_metal_03_diff.webp'),tex('mina/rusty_metal_03_nor.webp',0,false),tex('mina/metal_plate_02_rough.webp',0,false),tex('mina/metal_plate_02_nor.webp',0,false),tex('mina/rubberized_track_diff.webp'),tex('mina/rubberized_track_nor.webp',0,false),
  tex('mina/corrugated_iron_02_diff.webp'),tex('mina/corrugated_iron_02_nor.webp',0,false),tex('mina/concrete_floor_02_diff.webp'),tex('mina/concrete_floor_02_nor.webp',0,false),tex('mina/concrete_floor_02_rough.webp',0,false)]);
 const nm=(m,t,k)=>{if(t){m.normalMap=t;m.normalScale=new THREE.Vector2(k,k)}};
 for(const m of[M.navy,M.yellow,M.dark,M.red,M.white,M.blue,M.orange,M.aqua,M.blue2,M.hred,M.sblue]){nm(m,plN,.5);if(plR){m.roughnessMap=plR;m.roughness=Math.min(1,m.roughness*1.7)}}
 nm(M.steel,plN,.3);
 if(rustD){M.steelD.map=rustD;M.steelD.color.set(0xb8bec4);nm(M.steelD,rustN,.8);M.pipe.map=rustD;M.pipe.color.set(0x5a5d61);nm(M.pipe,rustN,.6)}
 if(rubD){M.rubber.map=rubD;M.rubber.color.set(0x8c8c8c);nm(M.rubber,rubN,1)}
 if(corD){M.corr.map=corD;nm(M.corr,corN,.7);M.corr.color.set(0xf4f6f8)}
 if(cnD){M.conc.map=cnD;nm(M.conc,cnN,.6);if(cnR)M.conc.roughnessMap=cnR;M.conc.color.set(0xd8d6cf)}
 if(sky){sky.mapping=THREE.EquirectangularReflectionMapping;scene.background=sky;scene.backgroundIntensity=1;const pm=new THREE.PMREMGenerator(renderer);scene.environment=pm.fromEquirectangular(sky).texture;scene.environmentIntensity=.75;pm.dispose()}
 else scene.background=new THREE.Color(0xa9c7da);
 buildTerrain({soil,rock,ground:gnd,gravel:grv});scatter();buildModels();buildPackB();buildDust();buildFlow();FLOW.visible=true;
 applyQ(q);camStep(performance.now());camera.position.copy(camP);camera.lookAt(camT);
 try{if(renderer.compileAsync)await renderer.compileAsync(scene,camera);else renderer.compile(scene,camera)}catch(e){}FLOW.visible=false;
 draw();progBar.style.width='100%';ready=true;const gb=$('#goBtn');gb.disabled=false;gb.textContent=U('go');
 const h=location.hash.match(/^#s([1-5])$/);
 gb.onclick=()=>{$('#intro').classList.add('out');setTimeout(()=>$('#intro').remove(),1200);$('#nav').classList.add('in');entered=true;setSec();if(h)setTimeout(()=>go(+h[1]),500)};
 requestAnimationFrame(loop)})().catch(e=>{console.error(e);$('#goBtn').textContent='Erro: '+e.message});

const clock=new THREE.Clock();let frame=0;
const tmp=V(0,0,0);
function place(el,a){tmp.copy(a).project(camera);if(tmp.z>1||Math.abs(tmp.x)>1.05||Math.abs(tmp.y)>1.05){el.classList.add('off');return}
 el.style.transform=`translate(${(tmp.x*.5+.5)*innerWidth-16}px,${(-tmp.y*.5+.5)*innerHeight-16}px)`;el.classList.remove('off')}
function loop(now){requestAnimationFrame(loop);if(document.hidden)return;frame++;
 if(openId&&frame%2)return;// painel aberto: metade dos quadros
 const dt=Math.min(.05,clock.getDelta()),t=clock.elapsedTime;
 const shSize=camStep(now);camera.position.copy(camP);camera.lookAt(camT);
 for(const d of DYN)d(t);if(dust.visible)stepDust(dt);
 // a sombra acompanha o ponto de interesse (resolução útil onde se olha)
 sun.target.position.copy(camT);sun.position.copy(camT).addScaledVector(SUN_DIR,500);const sc=sun.shadow.camera;
 if(Math.abs(sc.right-shSize)>.5){sc.left=-shSize;sc.right=shSize;sc.top=shSize;sc.bottom=-shSize;sc.near=50;sc.far=1100;sc.updateProjectionMatrix()}
 draw();fpsWatch(now);
 const ok=entered&&!fly;
 for(const[id,p]of Object.entries(PR)){const a=ANCH[id];if(ok&&a&&SECS[sec].prods.includes(id))place(p.el,a);else p.el.classList.add('off')}
 OPM.forEach((b,i)=>{if(ok&&sec===0)place(b,OPA[i]);else b.classList.add('off')});
 if(entered&&(mmDirty||frame%5===0)){drawMM();mmDirty=false}
}
