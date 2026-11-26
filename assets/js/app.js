import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';
import {SSAOPass} from './ssao.js';
import {createOp} from './operacao.js';
import {createClima,WXU} from './clima.js';
import {createCenarios} from './cenarios.js';
import {createCinema} from './cinema.js';
import {createRemoto} from './remoto.js';
import {riserDetail,seabedDetail,makeJellyfish} from './detalhes3d.js';
import {applyDetailToScene,setDetailTexture,detLevel} from './detalhe.js';
import {SEABED,GBOT,GH,FRONT,BACK,HALFW,SLOT,clamp,lerp,smooth,V,UP,rnd,wave,SEA,GERSTNER_GLSL,TEXS,ctex,dotTex,rayTex,shadowTex,foamTex,M,PAINTED,G,add,bake,instancify,pbr,grime} from './kit.js';
import {makeShip,makeBOP,makeTensioner,makeRiserJoint,makeROV,makeBit,makeTopDrive,makeRoughneck,makeDrawworks,makeRotary,makeMudPump,makeCrane,makeDerrick,makeAnnular,makeRam,makeH4,makePod,makeGateValve,makeDiverter,fishGeometry,fishMat,fishTime} from './modelos.js';

const mark=k=>{(window.__t??={})[k]=Math.round(performance.now())};mark('modulo');
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches,TOUCH=matchMedia('(hover: none)').matches;
const BASE='https://hmhw.com',EASE='cubic-bezier(.2,.8,.2,1)',f1=n=>n.toFixed(1),pad=n=>String(n).padStart(2,'0');
const store={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}}};

/* =====================================================================
   Conteúdo (content/conteudo.json, PT e EN)
   ===================================================================== */
const [C,MODELS]=await Promise.all([fetch('content/conteudo.json'+(window.__v?'?v='+window.__v:'')).then(r=>r.json()),fetch('assets/models/modelos.json'+(window.__v?'?v='+window.__v:'')).then(r=>r.ok?r.json():{}).catch(()=>({}))]);mark('conteudo');
const AR_IDS=new Set(['cranes','diverter','drawworks','ebop','gk','gxp','h4','mudpumps','pods','rams','riser','rotary','roughneck','sentry','structures','telescopic','topdrive','valves','wbsr']);
const SECS=C.secoes,P=C.produtos,ESG=C.esg.map(e=>Object.assign(e,{esg:1})),TOUR=C.tour,ALL=[...P,...ESG];
const byId=Object.fromEntries(ALL.map(p=>[p.id,p]));
let L=store.get('hmh-lang')==='en'?'en':'pt';
const T=o=>o[L]||o.pt,U=k=>C.ui[L][k]??C.ui.pt[k];
const fotoUrl=n=>'assets/fotos/'+n.replace(/\.\w+$/,'')+'.webp';
const thumbUrl=n=>'assets/fotos/t/'+n.replace(/\.\w+$/,'')+'.webp';

/* =====================================================================
   Água realista: atenuação pela distância percorrida dentro da fatia d'água
   e absorção de cor com a profundidade (substitui o fog padrão do three.js)
   ===================================================================== */
THREE.ShaderChunk.fog_pars_vertex='#ifdef USE_FOG\nvarying float vFogDepth;\nvarying vec3 vFogWorld;\n#endif';
THREE.ShaderChunk.fog_vertex='#ifdef USE_FOG\nvFogDepth=-mvPosition.z;\nvFogWorld=(inverse(viewMatrix)*mvPosition).xyz;\n#endif';
THREE.ShaderChunk.fog_pars_fragment='#ifdef USE_FOG\nuniform vec3 fogColor;\nuniform float fogNear;\nuniform float fogFar;\nvarying float vFogDepth;\nvarying vec3 vFogWorld;\n#endif';
THREE.ShaderChunk.fog_fragment=`#ifdef USE_FOG
 float uw=1.0-smoothstep(-2.4,-1.5,vFogWorld.y);
 float gr=1.0-smoothstep(${f1(SEABED-1.5)},${f1(SEABED+0.3)},vFogWorld.y);
 float inside=step(abs(vFogWorld.x),${f1(HALFW+2)})*step(vFogWorld.z,${f1(FRONT+0.5)});
 float wk=clamp(-vFogWorld.y/${f1(-SEABED)},0.0,1.0);
 float w=uw*(1.0-gr)*inside;
 float path=max(0.0,${f1(FRONT)}-vFogWorld.z)+max(0.0,-vFogWorld.y)*0.22;
 float att=1.0-exp(-path*mix(0.0075,0.0125,wk));
 vec3 deep=mix(vec3(0.030,0.190,0.250),vec3(0.004,0.034,0.062),pow(wk,0.75));
 vec3 absb=exp(-vec3(1.15,0.42,0.22)*(0.3+wk*1.5));
 gl_FragColor.rgb*=mix(vec3(1.0),absb,w);
 gl_FragColor.rgb=mix(gl_FragColor.rgb,deep,w*att);
 float haze=(1.0-uw)*max(1.0-exp(-vFogDepth*0.00012),smoothstep(9000.0,19000.0,vFogDepth));   // no fim do mar distante a cor é exatamente a da névoa: sem linha no horizonte
 gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,clamp(haze,0.0,1.0));
 gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,(1.0-uw)*(1.0-exp(-max(0.0,30.0-vFogWorld.z)*fogNear)));   // chuva e neblina (clima.js): o que está atrás da sonda some primeiro
#endif`;

/* =====================================================================
   Renderizador, qualidade adaptativa, luz e sombras
   ===================================================================== */
const canvas=$('#gl');let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'})}catch(e){window.__fail(U('noWebgl'));throw e}
const gpuInfo=(()=>{try{const g=renderer.getContext(),d=g.getExtension('WEBGL_debug_renderer_info');return d?String(g.getParameter(d.UNMASKED_RENDERER_WEBGL)):''}catch(e){return''}})();
const WEAK=/Intel|Mali|Adreno|PowerVR|SwiftShader|llvmpipe|Software/i.test(gpuInfo),VWEAK=/UHD|HD Graphics|SwiftShader|llvmpipe|Software|Mali-[GT]?\d{2,3}/i.test(gpuInfo);
const QF=/[?&]q=([0-3])/.exec(location.search); // ?q=0..3 força o nível (3 = Ultra 4K, sem queda automática)
const QSAVED=(()=>{try{return localStorage.getItem('hmh-q')}catch(e){return null}})();
const STRONG=/RTX|GTX (1[0-9]|[2-9][0-9])|Radeon RX|Radeon Pro|Apple M|Arc.{0,6} A\d/i.test(gpuInfo);
const autoLevel=()=>VWEAK?0:TOUCH||WEAK?1:2; // o Ultra (4K) só por escolha: a seleção automática nunca sobe até ele
const QMODE0=QF?+QF[1]:/^[0-3]$/.test(QSAVED||'')?+QSAVED:'auto';
const Q={level:QMODE0==='auto'?autoLevel():QMODE0,mode:QMODE0,frames:0,acc:0,lastCheck:0,lock:QMODE0!=='auto',good:0,fps:0,tried3:true};
// se a placa de vídeo perder o contexto (tela preta por memória ou driver), guarda um nível menor e recarrega a cena
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();try{localStorage.setItem('hmh-q',String(Math.max(0,Q.level-1)))}catch(_){}const d=document.createElement('div');d.textContent='A placa de vídeo reiniciou a cena. Recarregando…';d.style.cssText='position:fixed;inset:0;z-index:999;display:grid;place-content:center;background:#0b1724;color:#fff;font:600 16px system-ui';document.body.appendChild(d);setTimeout(()=>location.reload(),1500)},false);
const MAXTEX=renderer.capabilities.maxTextureSize;
const DET2=[],DET3=[];   // pacotes de detalhe 3D: DET2 aparece a partir do nível Alta, DET3 só no Ultra
// resolução interna: Baixa/Média/Alta respeitam um orçamento de pixels; Ultra renderiza em 4K (com supersampling em telas Full HD)
// resolução dinâmica: dentro de cada nível, a resolução interna desce em passos de 10% (até 70%) antes de cair de nível, e sobe de volta quando sobra folga
const DRS={k:1};
const dprFor=l=>{const n=devicePixelRatio,w=innerWidth,px=w*innerHeight;
 const cap=[Math.min(n,1.15),Math.min(n,1.4),Math.min(n,1.75),Math.max(n,Math.min(2,3840/w))][l],budget=Math.sqrt([2.4e6,3.2e6,4.6e6,8.9e6][l]/px);
 return Math.max(.75,Math.min(cap,budget,MAXTEX/w/1.02))*DRS.k};
renderer.setPixelRatio(dprFor(Q.level));renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.localClippingEnabled=true;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;   // sombras estáticas: só recalcula quando a câmera muda (ver frame)
const STATS=location.search.includes('stats');if(STATS)renderer.info.autoReset=false;
const ANISO=renderer.capabilities.getMaxAnisotropy();TEXS.forEach(t=>t.anisotropy=ANISO);
const scene=new THREE.Scene();scene.fog=new THREE.Fog(0xffffff,0,2);const HAZE=new THREE.Color().setRGB(.74,.82,.89),HAZE_N=new THREE.Color().setRGB(.03,.05,.09);scene.fog.color.copy(HAZE);
const pmrem=new THREE.PMREMGenerator(renderer);mark('renderer');
const studio=pmrem.fromScene(new RoomEnvironment(),.04).texture;scene.environment=studio;scene.environmentIntensity=.62;
const camera=new THREE.PerspectiveCamera(22,innerWidth/innerHeight,10,30000);scene.add(camera);
const SUN=V(330,520,560).normalize().multiplyScalar(700);
const key=new THREE.DirectionalLight(0xfff0dc,2.6);key.castShadow=true;const SM=TOUCH?1024:2048;key.shadow.mapSize.set(SM,SM);
Object.assign(key.shadow.camera,{left:-85,right:85,top:85,bottom:-85,near:100,far:1500});key.shadow.bias=-.0004;key.shadow.normalBias=.5;scene.add(key,key.target);
const rim=new THREE.DirectionalLight(0xbfe3ff,.7);rim.position.set(-400,250,-300);scene.add(rim);
const hemi=new THREE.HemisphereLight(0xe2efff,0x2b3138,.5);scene.add(hemi);
function setQuality(l){Q.level=l;renderer.setPixelRatio(dprFor(l));composer.setPixelRatio(dprFor(l));renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);ssao.enabled=l>=2;syncAA(l);{const sm=[512,1024,2048,Math.min(4096,MAXTEX)][l];if(key.shadow.mapSize.x!==sm){key.shadow.mapSize.set(sm,sm);key.shadow.map?.dispose();key.shadow.map=null}}bloom.enabled=l>0;detLevel.value=l>0?2:1;
 DET2.forEach(g=>g.visible=l>=2);DET3.forEach(g=>g.visible=l>=3);
 fishSchools.forEach(F=>F.im.count=l>0?F.S.n:Math.ceil(F.S.n/2));snow.visible=l>0;
 if(typeof hdMaps!=='undefined'&&hdMaps&&strataWidth()!==SW){clearTimeout(setQuality.t);setQuality.t=setTimeout(()=>drawStrata(hdMaps.dm,hdMaps.nm,strataWidth()),500)}
 if(typeof qUI==='function')qUI()}

/* ---------- carregamento com progresso ---------- */
let nDone=0,nTotal=0;const progBar=$('#progBar'),progT=$('#progT');
function prog(){const k=nTotal?nDone/nTotal:0;progBar.style.width=(k*100).toFixed(0)+'%';progT.textContent=k<1?`${U('carregando')} ${Math.round(k*100)}%`:U('carregado')}
const TL=new THREE.TextureLoader(),IL=new THREE.ImageLoader();
function tex(file,{srgb=true,rep=[1,1]}={}){nTotal++;return new Promise(res=>TL.load('assets/texturas/'+file,t=>{if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(...rep);t.anisotropy=ANISO;nDone++;prog();res(t)},undefined,()=>{nDone++;prog();res(null)}))}
function img(file){nTotal++;return new Promise(res=>IL.load('assets/texturas/'+file,i=>{nDone++;prog();res(i)},undefined,()=>{nDone++;prog();res(null)}))}

/* =====================================================================
   Cenário: céu, oceano (ondas na GPU), fatia d'água em corte
   ===================================================================== */
const worldVS='varying vec3 w;void main(){vec4 p=modelMatrix*vec4(position,1.);w=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}';
const uNight={value:0},uTime={value:0};
const sky=new THREE.Mesh(new THREE.PlaneGeometry(140000,60000),new THREE.ShaderMaterial({depthWrite:false,fog:false,vertexShader:worldVS,uniforms:{n:uNight,stm:WXU.storm,fl:WXU.flash},
 fragmentShader:`varying vec3 w;uniform float n,stm,fl;void main(){vec3 c;float y=w.y;
  if(y>0.){float k=clamp(y/5200.,0.,1.);c=mix(vec3(.74,.82,.89),vec3(.20,.42,.70),pow(k,.5));
   vec2 sp=vec2(16000.,3600.);float s=length(w.xy-sp);c+=vec3(1.,.9,.72)*exp(-s/2600.)*.28;
   float nn=sin(w.x*.00055+sin(w.y*.002)*2.)*sin(w.y*.0016+w.x*.0002)+.5*sin(w.x*.0013+w.y*.003);c=mix(c,vec3(.93,.95,.97),smoothstep(.7,1.4,nn)*.45*smoothstep(500.,2600.,y)*(1.-smoothstep(5000.,9000.,y)));
   vec3 cn=mix(vec3(.03,.05,.09),vec3(.0,.008,.03),pow(k,.4));vec2 g=floor(w.xy/38.);float st=step(.9975,fract(sin(dot(g,vec2(12.9898,78.233)))*43758.5453))*smoothstep(150.,900.,y);cn+=st*.9;
   float cl=sin(w.x*.0004+w.y*.0011)*sin(w.y*.0021-w.x*.0003)*.5+.5;vec3 cs=mix(vec3(.42,.46,.5),vec3(.2,.23,.27),pow(k,.6))*mix(.85,1.08,cl);c=mix(c,cs,stm);c+=fl*vec3(.75,.8,.95)*(1.-k*.4)*mix(.6,1.,cl);
   cn+=fl*vec3(.35,.38,.5);c=mix(c,cn,n);}
  else{float k=clamp(-y/700.,0.,1.);c=mix(vec3(.05,.14,.2),vec3(.015,.03,.05),k)*(1.-n*.6);}
  gl_FragColor=vec4(c,1.);}`}));sky.position.z=-20000;scene.add(sky);
const oceanMat=new THREE.MeshPhysicalMaterial({color:0x0b3c52,roughness:.12,metalness:0,envMapIntensity:1,clearcoat:.5,clearcoatRoughness:.06});
const uSea={value:new THREE.Vector2(1,0)};
oceanMat.onBeforeCompile=s=>{s.uniforms.uTime=uTime;s.uniforms.uSea=uSea;s.vertexShader=GERSTNER_GLSL+s.vertexShader
 .replace('#include <beginnormal_vertex>','float gF=smoothstep(-500.,-300.,position.z);vec3 gN;vec3 gD=gerst(position.xz,gN);vec3 objectNormal=normalize(mix(vec3(0.,1.,0.),gN,gF));\n#ifdef USE_TANGENT\nvec3 objectTangent=vec3(tangent.xyz);\n#endif')
 .replace('#include <begin_vertex>','vec3 transformed=vec3(position.x+gD.x*gF,mix(-1.2,position.y+gD.y,gF),position.z+gD.z*gF);vWh=transformed.y;\n#ifdef USE_ALPHAHASH\nvPosition=vec3(position);\n#endif').replace('void main() {','varying float vWh;\nvoid main() {');
 // espuma nas cristas quando há vento (clima.js)
 s.fragmentShader='uniform vec2 uSea;varying float vWh;\n'+s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(.8,.85,.87),smoothstep(.35,1.,(vWh-.45*uSea.x)/(.3+uSea.y))*clamp(uSea.y,0.,1.)*.8);')};
const oceanFar=oceanMat.clone();oceanFar.onBeforeCompile=()=>{};
const ocean=new THREE.Mesh(new THREE.PlaneGeometry(1800,520,240,96).rotateX(-Math.PI/2).translate(0,0,FRONT-260),oceanMat);ocean.receiveShadow=true;scene.add(ocean);
// Modo Cinema: o mar continua à frente do corte do diorama (as câmeras de cinema ficam ali)
const oceanFront=new THREE.Mesh(new THREE.PlaneGeometry(1800,700,200,60).rotateX(-Math.PI/2).translate(0,0,FRONT+350),oceanMat);oceanFront.visible=false;scene.add(oceanFront);
const oceanFarFront=new THREE.Mesh(new THREE.PlaneGeometry(60000,20000).rotateX(-Math.PI/2).translate(0,-1.2,FRONT+10000),oceanFar);oceanFarFront.visible=false;scene.add(oceanFarFront);
// cúpula de céu (mesmo shader e mesmos uniforms do céu plano): no cinema a câmera olha em qualquer direção
const skyDome=new THREE.Mesh(new THREE.SphereGeometry(16000,48,24),new THREE.ShaderMaterial({vertexShader:sky.material.vertexShader,fragmentShader:sky.material.fragmentShader,uniforms:sky.material.uniforms,side:THREE.BackSide,depthWrite:false,fog:false}));
skyDome.visible=false;skyDome.frustumCulled=false;skyDome.renderOrder=-1;scene.add(skyDome);
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(60000,20100).rotateX(-Math.PI/2).translate(0,-1.2,FRONT-10050),oceanFar));
const glassFront=new THREE.Mesh(new THREE.PlaneGeometry(HALFW*2,-SEABED),new THREE.ShaderMaterial({transparent:true,depthWrite:false,fog:false,vertexShader:worldVS,uniforms:{t:uTime,n:uNight},
 fragmentShader:`varying vec3 w;uniform float t;uniform float n;void main(){float k=clamp(-w.y/${f1(-SEABED)},0.,1.);vec3 c=mix(vec3(.20,.62,.75),vec3(.01,.06,.11),pow(k,.8))*(1.-n*.55);float a=mix(.08,.22,k);
  float caus=0.;if(k<.35){caus=pow(abs(sin(w.x*.21+t*1.2)*sin(w.y*.27-t*.8+w.x*.05)),3.)*(1.-k/.35)*.22*(1.-n);}
  float edge=smoothstep(2.5,0.,-w.y)*.4*(1.-n*.6);gl_FragColor=vec4(c+caus+edge,a+edge*.4);}`}));
glassFront.position.set(0,SEABED/2,FRONT);glassFront.renderOrder=6;scene.add(glassFront);
const backWall=new THREE.Mesh(new THREE.PlaneGeometry(HALFW*2,-SEABED+2),new THREE.ShaderMaterial({fog:false,vertexShader:worldVS,uniforms:{n:uNight},
 fragmentShader:`varying vec3 w;uniform float n;void main(){float k=clamp(-w.y/${f1(-SEABED)},0.,1.);gl_FragColor=vec4(mix(vec3(.030,.190,.250),vec3(.004,.034,.062),pow(k,.75))*(1.-n*.55),1.);}`}));
backWall.position.set(0,SEABED/2-1,BACK-.5);scene.add(backWall);
const ribGeo=new THREE.PlaneGeometry(HALFW*2,1,160,1);const ribbon=new THREE.Mesh(ribGeo,new THREE.MeshBasicMaterial({color:0x8fd8ea,transparent:true,opacity:.5,depthWrite:false,fog:false}));ribbon.position.z=FRONT+.05;ribbon.renderOrder=7;scene.add(ribbon);
function updRibbon(t){const p=ribGeo.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i);p.setY(i,i<=160?wave(x,FRONT,t):-1.8)}p.needsUpdate=true}
const foam=new THREE.Mesh(new THREE.CircleGeometry(1,64).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:foamTex,transparent:true,opacity:.55,depthWrite:false,fog:true}));foam.scale.set(92,1,21);foam.position.set(-6,.35,0);foam.renderOrder=2;scene.add(foam);
const rays=[];for(let i=0;i<10;i++){const m=new THREE.Mesh(new THREE.PlaneGeometry(10+rnd()*12,130),new THREE.MeshBasicMaterial({map:rayTex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.06,color:0xbfefff,fog:false}));m.position.set(-180+i*40+rnd()*10,-66,FRONT-12-rnd()*80);m.rotation.z=-.18+rnd()*.08;m.renderOrder=4;m.userData.ph=rnd()*6;scene.add(m);rays.push(m)}
const NS=1200,snowG=new THREE.BufferGeometry(),snowA=new Float32Array(NS*3),snowS=[];for(let i=0;i<NS;i++)snowS.push([(rnd()*2-1)*190,SEABED+rnd()*(-SEABED-4),BACK+rnd()*(FRONT-BACK-2),rnd()]);snowG.setAttribute('position',new THREE.BufferAttribute(snowA,3));
const snow=new THREE.Points(snowG,new THREE.PointsMaterial({size:.5,map:dotTex,transparent:true,opacity:.45,depthWrite:false,color:0xd8eef7}));snow.frustumCulled=false;snow.renderOrder=4;scene.add(snow);

/* ---------- bloco geológico (texturas reais compostas por camada) ---------- */
const LAY=[[0,'#8a7556','damp_sand'],[.1,'#6e5a45','excavated_soil_wall'],[.22,'#a88d64','old_sandstone_02'],[.38,'#4b4744','dark_rock_02'],[.52,'#8b8475','marble_cliff_03'],[.63,'#4a443f','dark_rock'],[.7,'#8f6c3c','rock_06'],[.92,'#2c2522','rock_face']];
const domeAt=(xn,i)=>i>=4?Math.exp(-(((xn-.5)/.13)**2))*.06*(i===4?.5:1):0;
const layerTop=(i,xn)=>i===0?0:i>=LAY.length?1.01:LAY[i][0]+Math.sin(xn*44+i*1.7)*.006+Math.sin(xn*131+i*2.3)*.003-domeAt(xn,i);
let SW=TOUCH?2048:2560,SHH=Math.round(SW*GH/(HALFW*2));
const strataCanvas=document.createElement('canvas');strataCanvas.width=SW;strataCanvas.height=SHH;
const strataNormCanvas=document.createElement('canvas');strataNormCanvas.width=SW;strataNormCanvas.height=SHH;
const glossCanvas=document.createElement('canvas');glossCanvas.width=1024;glossCanvas.height=Math.round(1024*SHH/SW);
const strataTex=new THREE.CanvasTexture(strataCanvas);strataTex.colorSpace=THREE.SRGBColorSpace;strataTex.anisotropy=ANISO;
const glossTex=new THREE.CanvasTexture(glossCanvas);
const strataNormTex=new THREE.CanvasTexture(strataNormCanvas);strataNormTex.anisotropy=ANISO;
// imgs/nors: texturas por camada; newW refaz os canvas em resolução maior (pacote HD). O lado da repetição é fixo em px de canvas, então a aparência não muda ao trocar de resolução.
function drawStrata(imgs,nors,newW){
 if(newW&&newW!==SW){SW=newW;SHH=Math.round(SW*GH/(HALFW*2));for(const c of[strataCanvas,strataNormCanvas]){c.width=SW;c.height=SHH}glossCanvas.height=Math.round(1024*SHH/SW);[strataTex,glossTex,strataNormTex].forEach(t=>t.dispose())}
 const g=strataCanvas.getContext('2d'),W=SW,H=SHH;g.clearRect(0,0,W,H);
 const layerPath=i=>{const p=new Path2D();p.moveTo(0,layerTop(i,0)*H);for(let x=0;x<=W;x+=12)p.lineTo(x,layerTop(i,x/W)*H);for(let x=W;x>=0;x-=12)p.lineTo(x,layerTop(i+1,x/W)*H);p.closePath();return p},tileS=im=>(600*W/2560)/(im.naturalWidth||im.width);
 for(let i=0;i<LAY.length;i++){const p=layerPath(i);
  g.save();g.clip(p);const im=imgs&&imgs[LAY[i][2]];
  if(im){const pat=g.createPattern(im,'repeat');const s=tileS(im);pat.setTransform(new DOMMatrix([s,0,0,s,(i*331)%400,(i*173)%300]));g.fillStyle=pat;g.fillRect(0,0,W,H);
   g.globalCompositeOperation='soft-light';g.globalAlpha=.4;g.fillStyle=LAY[i][1];g.fillRect(0,0,W,H);g.globalCompositeOperation='source-over';g.globalAlpha=1}
  else{g.fillStyle=LAY[i][1];g.fillRect(0,0,W,H)}
  g.restore();if(i>0){g.strokeStyle='rgba(0,0,0,.5)';g.lineWidth=3;g.beginPath();for(let x=0;x<=W;x+=12)g.lineTo(x,layerTop(i,x/W)*H);g.stroke();g.strokeStyle='rgba(255,240,220,.12)';g.lineWidth=1.5;g.beginPath();for(let x=0;x<=W;x+=12)g.lineTo(x,layerTop(i,x/W)*H+3);g.stroke()}}
 const cx=W/2,rt=layerTop(6,.5)*H;g.save();g.beginPath();for(let x=0;x<=W;x+=12)g.lineTo(x,layerTop(6,x/W)*H);g.lineTo(W,H);g.lineTo(0,H);g.closePath();g.clip();
 g.globalCompositeOperation='multiply';for(let b=0;b<9;b++){const bx=cx+(b-4)*W*.035+(rnd()-.5)*W*.02,by=rt+H*(.065+rnd()*.03),br=W*(.07+rnd()*.05);const r=g.createRadialGradient(bx,by,4,bx,by,br);r.addColorStop(0,'rgba(40,24,10,.85)');r.addColorStop(.6,'rgba(60,38,18,.55)');r.addColorStop(1,'rgba(90,60,30,0)');g.save();g.translate(bx,by);g.scale(1,.32);g.translate(-bx,-by);g.fillStyle=r;g.fillRect(0,0,W,H);g.restore()}
 g.globalCompositeOperation='source-over';const r=g.createRadialGradient(cx,rt+H*.018,10,cx,rt+H*.018,W*.11);r.addColorStop(0,'rgba(240,226,170,.7)');r.addColorStop(1,'rgba(240,226,170,0)');g.save();g.translate(cx,rt+H*.018);g.scale(1,.16);g.translate(-cx,-(rt+H*.018));g.fillStyle=r;g.fillRect(0,0,W,H);g.restore();g.restore();
 const sh=g.createLinearGradient(0,0,0,H);sh.addColorStop(0,'rgba(0,0,0,0)');sh.addColorStop(1,'rgba(0,0,0,.35)');g.fillStyle=sh;g.fillRect(0,0,W,H);
 const q=glossCanvas.getContext('2d'),QW=glossCanvas.width,QH=glossCanvas.height;q.fillStyle='#fff';q.fillRect(0,0,QW,QH);const qx=QW/2,qy=layerTop(6,.5)*QH+QH*.07;const qr=q.createRadialGradient(qx,qy,4,qx,qy,QW*.18);qr.addColorStop(0,'#181818');qr.addColorStop(.75,'#3a3a3a');qr.addColorStop(1,'#ffffff');q.save();q.translate(qx,qy);q.scale(1,.24);q.translate(-qx,-qy);q.fillStyle=qr;q.fillRect(0,0,QW,QH);q.restore();
 // normais: mesmas camadas e mesmo deslocamento do difuso; sem pacote HD fica um mapa plano (#8080ff)
 {const ng=strataNormCanvas.getContext('2d');ng.fillStyle='#8080ff';ng.fillRect(0,0,W,H);
  if(nors)for(let i=0;i<LAY.length;i++){const nim=nors[LAY[i][2]];if(!nim)continue;ng.save();ng.clip(layerPath(i));const pt=ng.createPattern(nim,'repeat');pt.setTransform(new DOMMatrix([tileS(nim),0,0,tileS(nim),(i*331)%400,(i*173)%300]));ng.fillStyle=pt;ng.fillRect(0,0,W,H);ng.restore()}}
 strataTex.needsUpdate=true;glossTex.needsUpdate=true;strataNormTex.needsUpdate=true}
drawStrata(null);
const strataMat=new THREE.MeshPhysicalMaterial({map:strataTex,roughnessMap:glossTex,roughness:.95,normalMap:strataNormTex,normalScale:new THREE.Vector2(1.1,1.1),bumpMap:strataTex,bumpScale:2});
const strataBack=strataMat.clone();strataBack.side=THREE.BackSide;
function uvWorld(g,mode){const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
 if(mode!=='curve'&&Math.abs(n.getY(i))>.5){uv.setXY(i,x/24,z/24);continue}let u=(x+HALFW)/(HALFW*2);if(mode==='curve'||Math.abs(n.getX(i))>.5)u+=(z-FRONT)/(HALFW*2)*.3;uv.setXY(i,u,(y-GBOT)/GH)}uv.needsUpdate=true}
function blockBox(x0,x1,z0,z1){const g=new THREE.BoxGeometry(x1-x0,GH,z1-z0);g.translate((x0+x1)/2,(SEABED+GBOT)/2,(z0+z1)/2);uvWorld(g);const m=new THREE.Mesh(g,[strataMat,strataMat,M.seabed,strataMat,strataMat,strataMat]);m.receiveShadow=true;return m}
scene.add(blockBox(-HALFW,-SLOT,BACK,FRONT),blockBox(SLOT,HALFW,BACK,FRONT),blockBox(-SLOT,SLOT,BACK,-SLOT));
{const g=new THREE.CylinderGeometry(SLOT,SLOT,GH,40,1,true,Math.PI/2,Math.PI);g.translate(0,(SEABED+GBOT)/2,0);uvWorld(g,'curve');scene.add(new THREE.Mesh(g,strataBack))}
{const rocks=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,1),M.rock,70),d=new THREE.Object3D();for(let i=0;i<70;i++){let x,z;do{x=(rnd()*2-1)*190;z=BACK+rnd()*(FRONT-BACK-4)}while(Math.abs(x)<28&&z>-34);const s=.4+rnd()*1.6;d.position.set(x,SEABED+s*.25,z);d.scale.set(s,s*.55,s*(.7+rnd()*.5));d.rotation.set(rnd(),rnd()*6,rnd());d.updateMatrix();rocks.setMatrixAt(i,d.matrix)}rocks.castShadow=rocks.receiveShadow=true;scene.add(rocks)}
const sb=seabedDetail();scene.add(sb.A,sb.B);DET2.push(sb.A);DET3.push(sb.B);
const jelly=makeJellyfish(9);scene.add(jelly.group);DET2.push(jelly.group);

/* =====================================================================
   Montagem dos equipamentos (peças fixas mescladas por material)
   ===================================================================== */
const A={};const anchor=(id,parent,x,y,z)=>{const o=new THREE.Object3D();o.position.set(x,y,z);parent.add(o);A[id]=o;return o};
const ship=makeShip();scene.add(ship);const SU=ship.userData;
anchor('topdrive',SU.td,0,4.5,1.6);anchor('structures',ship,5.5,42,4);anchor('rotary',ship,0,18.4,2.2);anchor('roughneck',SU.rn,0,3.2,0);anchor('drawworks',ship,-5,20.4,6.5);
anchor('mudpumps',ship,-24,12,12.8);anchor('mudsys',ship,-16,10.4,3.5);anchor('cranes',SU.kc[0],0,6.4,0);anchor('motion',ship,0,68.5,0);anchor('diverter',ship,0,14.6,1.8);{const dv=makeDiverter();dv.position.set(0,12.9,0);ship.add(dv)}
anchor('deal',ship,6.5,19.6,-5);anchor('beaware',ship,51,22,15);anchor('gk',SU.disp,0,4.4,0);anchor('sentry',SU.disp,2.4,1.2,1.4);
anchor('esg_dls',ship,-6,34,6);anchor('esg_hsse',ship,46,31.5,0);anchor('esg_digital',ship,6.5,21.6,-5);anchor('esg_supply',ship,-34,13.5,-4);
add(ship,G.cyl(1.9,1.9,15,40),M.grey,[0,-14.5,0]);add(ship,G.cyl(2.1,2.1,.8,40),M.dark,[0,-7.4,0]);add(ship,G.cyl(2.1,2.1,.8,40),M.dark,[0,-21.6,0]);anchor('telescopic',ship,0,-15,2.1);
const flood=[[V(0,63,7),V(0,8,0)],[V(44,31,0),V(8,8,0)]].map(([p,t])=>{const s=new THREE.SpotLight(0xffe2b0,0,180,.85,.6,1.1);s.position.copy(p);const o=new THREE.Object3D();o.position.copy(t);ship.add(s,o);s.target=o;return s});
bake(ship,[SU.td,...SU.wires,SU.dpipe,SU.rn.userData.arm,SU.dw.userData.drum,...SU.kc.map(c=>c.userData.tur),...SU.pc.map(c=>c.t),SU.detA,SU.detB]);DET2.push(SU.detA);DET3.push(SU.detB);
add(scene,G.cyl(1.3,1.3,16,40),M.chrome,[0,-20,0]);
const ring=new THREE.Group();ring.position.y=-26;scene.add(ring);add(ring,G.tor(2.7,.55,48),M.dark,[0,0,0],[Math.PI/2,0,0]);
const ATT=[[13,5],[-13,5],[13,-5],[-13,-5]];for(const[x,z]of ATT)add(ring,G.rbox(1.2,1.2,1.2,.15),M.dark,[Math.sign(x)*3,0,Math.sign(z)*1.6]);
const tens=ATT.map(([x,z])=>{const t=makeTensioner(20);scene.add(t);bake(t,[t.userData.rod]);return{t,hull:V(x,-7.2,z),ring:V(Math.sign(x)*3,0,Math.sign(z)*1.6)}});anchor('tens',tens[0].t,0,8,1.2);
const mpd=makeRiserJoint(14,{mpd:true});mpd.position.y=-34;scene.add(mpd);bake(mpd);anchor('mpd',mpd,0,1.4,2.2);anchor('esg_mpd',mpd,-3.2,3.6,1.5);
const bop=makeBOP({rams:3,anns:1,body:M.ramBody,bonnet:M.ramBon});bop.position.set(0,SEABED,0);scene.add(bop);const BU=bop.userData;
const RTOP=-41,RBOT=SEABED+BU.top,NJ=5,JL=(RTOP-RBOT)/NJ;
const riserI=instancify(makeRiserJoint(JL),NJ,scene);
const riserD=instancify(riserDetail(JL),NJ,scene),ZEROM=new THREE.Matrix4().makeScale(0,0,0);DET2.push(...riserD.ims);const rdm=new THREE.Object3D();
const bend=(y,t)=>.6*(1+Math.max(0,SEA.amp-1)*.45)*Math.sin(Math.PI*clamp((y-RBOT)/(RTOP-RBOT)))*Math.sin(t*.25);
function updRiser(t){for(let i=0;i<NJ;i++){const y=RTOP-JL*(i+.5);rdm.position.set(bend(y,t),y,0);rdm.rotation.set(0,i*.6,0);rdm.updateMatrix();riserI.set(i,rdm.matrix);riserD.set(i,i%2===0?rdm.matrix:ZEROM)}riserI.done();riserD.done();mpd.position.x=bend(-34,t)}
anchor('riser',scene,0,-96,2.6);
anchor('gxp',bop,0,BU.annYs[0],4.7);anchor('rams',bop,6,BU.ramYs[1],3.3);anchor('wbsr',bop,6,BU.ramYs[0],3.3);anchor('h4',bop,0,9.6,4.1);
anchor('pods',BU.pods[0],0,3,1.4);anchor('valves',BU.valves[1],0,1.2,.8);anchor('esg_bop',bop,-4.6,BU.annYs[0]+1.5,3.6);
bake(bop,[...BU.leds,BU.detA,BU.detB]);DET2.push(BU.detA);DET3.push(BU.detB);
const eb=makeBOP({rams:2,anns:1,electric:true,body:pbr(0x5c6c78,.5,.4),bonnet:pbr(0x3a4a56,.5,.45),annCol:pbr(0x5c6c78,.5,.4)});eb.scale.setScalar(.7);eb.position.set(36,SEABED,-34);eb.rotation.y=-.35;scene.add(eb);
anchor('ebop',eb,0,eb.userData.top*.7,0);anchor('esg_ebop',eb,-5,eb.userData.top*.92,2);bake(eb,[...eb.userData.leds,eb.userData.detA,eb.userData.detB]);DET2.push(eb.userData.detA);DET3.push(eb.userData.detB);
const k20=makeBOP({rams:4,anns:1,bonnet:pbr(0xc8452c,.25,.5,{clearcoat:.3})});k20.scale.setScalar(.7);k20.position.set(-34,SEABED,-60);k20.rotation.y=.45;scene.add(k20);anchor('k20',k20,0,k20.userData.top*.75,0);bake(k20,[...k20.userData.leds,k20.userData.detA,k20.userData.detB]);DET2.push(k20.userData.detA);DET3.push(k20.userData.detB);
const coneMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,fog:false,
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;void main(){gl_FragColor=vec4(.8,.95,1.,pow(vUv.y,2.4)*.14);}'});
function rovWithLights(){const r=makeROV();scene.add(r);const cone=new THREE.ConeGeometry(5,16,32,1,true);cone.translate(0,-8,0);
 // os feixes são só cones aditivos: luzes reais nos ROVs multiplicavam o custo de cada shader
 for(const x of[-2.2,2.2]){
  const c=new THREE.Mesh(cone,coneMat);c.position.set(x,.1,2.5);c.rotation.set(-Math.PI/2+.5,0,0);c.renderOrder=5;r.add(c)}bake(r);return r}
const rovs=[rovWithLights(),rovWithLights(),rovWithLights()];anchor('rovB',rovs[0],0,2.4,0);anchor('rovA',rovs[1],0,2.4,0);
// poço em corte
const clip=[new THREE.Plane(V(0,0,-1),0)];
const halfMat=m=>{const c=m.clone();c.clippingPlanes=clip;c.side=THREE.DoubleSide;return c};
const cementM=halfMat(M.cement),casingM=halfMat(M.steel),holeM=halfMat(new THREE.MeshStandardMaterial({color:0x2a2420,roughness:1}));
const shell=(r,y0,y1,mat)=>add(scene,new THREE.CylinderGeometry(r,r,y0-y1,48,1,true),mat,[0,(y0+y1)/2,0]);
shell(4.2,SEABED,SEABED-24,cementM);shell(3.4,SEABED,SEABED-24,casingM);shell(3.3,SEABED-24,SEABED-52,cementM);shell(2.7,SEABED,SEABED-52,casingM);shell(2.6,SEABED-52,SEABED-82,cementM);shell(2.0,SEABED,SEABED-82,casingM);
const openHole=add(scene,new THREE.CylinderGeometry(1.6,1.6,1,48,1,true),holeM);
const dstring=add(scene,G.cyl(.5,.5,1,24),M.pipe);
const bit=makeBit();bit.scale.setScalar(.55);scene.add(bit);anchor('bit',bit,0,4,3.4);anchor('casing',scene,-2.4,SEABED-40,.6);
anchor('reservoir',scene,12,SEABED-GH*.8,FRONT+.5);anchor('dls',scene,26,SEABED-GH*.87,FRONT+.5);
const BIT0=SEABED-62,BIT1=SEABED-GH*.735;
// lupa com close da broca (render-to-texture)
const lensRT=new THREE.WebGLRenderTarget(512,512,{samples:2});const lensScene=new THREE.Scene();lensScene.environment=studio;lensScene.environmentIntensity=.9;lensScene.background=new THREE.Color(0x1d1915);
const lensCam=new THREE.PerspectiveCamera(34,1,.1,100);lensCam.position.set(3,3.2,15.5);lensCam.lookAt(0,4,0);
lensScene.add(new THREE.HemisphereLight(0xffffff,0x40352a,1));{const l=new THREE.DirectionalLight(0xffe6c8,2.5);l.position.set(6,10,8);lensScene.add(l)}
const lensBit=makeBit();lensScene.add(lensBit);
const lensWallMat=new THREE.MeshStandardMaterial({color:0x8f7a5c,roughness:1,side:THREE.BackSide});
{const wall=new THREE.Mesh(new THREE.CylinderGeometry(4,4,30,48,1,true,Math.PI/2,Math.PI),lensWallMat);wall.position.y=8;lensScene.add(wall);add(lensScene,G.cyl(.9,.9,20,32),M.pipe,[0,18,0]);add(lensScene,G.cyl(4.2,4.2,1,48),new THREE.MeshStandardMaterial({color:0x6b5a45,roughness:1}),[0,-.6,0])}
const chipG=new THREE.BufferGeometry(),chipA=new Float32Array(120*3),chipS=[];for(let i=0;i<120;i++)chipS.push({a:rnd()*6.28,l:rnd(),s:.5+rnd()});chipG.setAttribute('position',new THREE.BufferAttribute(chipA,3));
lensScene.add(new THREE.Points(chipG,new THREE.PointsMaterial({size:.22,color:0xc9b087})));
const LENS=V(29,SEABED-56,FRONT+2.5),LR=13.5;
const lens=new THREE.Group();lens.position.copy(LENS);scene.add(lens);
add(lens,new THREE.CircleGeometry(LR,72),new THREE.MeshBasicMaterial({map:lensRT.texture,fog:false}));add(lens,G.tor(LR,.6,96),M.lattice,[0,0,.2]);add(lens,G.tor(LR+.8,.18,96),M.dark,[0,0,.1]);
const beamGeo=new THREE.BufferGeometry();beamGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(9),3));
const lensBeam=new THREE.Mesh(beamGeo,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.1,depthWrite:false,side:THREE.DoubleSide,fog:false}));lensBeam.renderOrder=6;scene.add(lensBeam);
const bitRing=add(scene,G.tor(2.6,.16,48),M.lampW,[0,0,1.6]);
const pts=(n,size,color,o={})=>{const g=new THREE.BufferGeometry(),a=new Float32Array(n*3);g.setAttribute('position',new THREE.BufferAttribute(a,3));const p=new THREE.Points(g,new THREE.PointsMaterial({size,map:dotTex,color,transparent:true,depthWrite:false,...o}));p.frustumCulled=false;scene.add(p);return{p,a,g}};
const oil=pts(220,.9,0xffb347,{opacity:0,blending:THREE.AdditiveBlending,fog:false}),oilS=[...Array(220)].map(()=>({x:(rnd()*2-1)*1.1,y:rnd(),s:.4+rnd()*.6}));
const bub=pts(140,.5,0xe6f8ff,{opacity:.6}),bubS=[...Array(140)].map(()=>({x:(rnd()*2-1)*2,y:rnd()*60,z:(rnd()*2-1)*2,s:2+rnd()*3}));bub.p.renderOrder=4;

/* ---------- peixes ---------- */
const SCH=[
 {n:TOUCH?50:80,size:1.5,y:[-50,-18],z:[-70,-8],dir:1,v:7,sp:[20,7,16],col:[0x1d3346,0x9aa7b0,0xe6e9ec],ph:0},
 {n:TOUCH?36:56,size:1.9,y:[-130,-100],z:[4,15],dir:-1,v:5.5,sp:[24,8,5],col:[0x223d58,0x8e9ead,0xdfe5ea],ph:200},
 {n:TOUCH?30:44,size:1.2,y:[-188,-164],z:[-90,-20],dir:1,v:4.5,sp:[18,6,14],col:[0x3b3a2a,0xa79c7a,0xe0d8c2],ph:330},
 {n:6,size:5.5,y:[-170,-40],z:[-100,-30],dir:-1,v:3.4,sp:[90,60,30],col:[0x10243a,0x5f7f99,0xd9e2e8],ph:120,solo:1}];
const fishSchools=SCH.map(S=>{const geo=fishGeometry(new THREE.Color(S.col[0]),new THREE.Color(S.col[1]),new THREE.Color(S.col[2]));
 const ph=new Float32Array(S.n);for(let i=0;i<S.n;i++)ph[i]=rnd()*6.28;geo.setAttribute('aPhase',new THREE.InstancedBufferAttribute(ph,1));
 const im=new THREE.InstancedMesh(geo,fishMat(),S.n);im.frustumCulled=false;scene.add(im);
 return{S,im,off:[...Array(S.n)].map(()=>({x:(rnd()*2-1)*S.sp[0],y:(rnd()*2-1)*S.sp[1],z:(rnd()*2-1)*S.sp[2],s:.75+rnd()*.5,w:rnd()*6.28})),yc:lerp(S.y[0],S.y[1],.5),zc:lerp(S.z[0],S.z[1],.5)}});
const fd=new THREE.Object3D();
function updFish(t){fishTime.value=t;for(const F of fishSchools){const{S,im,off}=F;const span=HALFW*2+120,cx=((t*S.v+S.ph)%span)-span/2,X=S.dir>0?cx:-cx;
 for(let i=0;i<im.count;i++){const o=off[i];let x=X+o.x+Math.sin(t*.7+o.w)*2.5,y=F.yc+o.y+Math.sin(t*.9+o.w*1.3)*1.2,z=F.zc+o.z+Math.cos(t*.6+o.w)*1.5;
  if(S.solo){x=(((t*S.v*(.8+o.s*.3)+o.w*90)%span)-span/2)*S.dir;y=lerp(S.y[0],S.y[1],o.w/6.28);z=lerp(S.z[0],S.z[1],o.s-.75)}
  fd.position.set(x,y,z);fd.rotation.set(0,(S.dir>0?0:Math.PI)+Math.sin(t*1.3+o.w)*.12,Math.sin(t*.8+o.w)*.06);fd.scale.setScalar(S.size*o.s);fd.updateMatrix();im.setMatrixAt(i,fd.matrix)}
 im.instanceMatrix.needsUpdate=true}}

/* ---------- "Como funciona": circulação do fluido (desce em azul, volta em âmbar) ---------- */
const downC=new THREE.CatmullRomCurve3([V(-24,14,9),V(-20,17.5,5),V(-9,20,-7),V(-5.5,42,-5.5),V(-2.5,62,-2.5),V(0,58,0),V(0,40,0),V(0,17,0),V(0,0,0),V(0,-41,0),V(0,-150,0),V(0,SEABED,0)].map(v=>v.clone()),false,'centripetal');
const upC=new THREE.CatmullRomCurve3([V(1.3,SEABED,.4),V(1.3,-150,.4),V(1.3,-41,.4),V(1.3,0,.4),V(1.6,16,.4),V(-6,15.5,4),V(-16,11,1),V(-22,12,8)],false,'centripetal');
const LD=downC.getLength(),LU=upC.getLength();
const flowDown=pts(260,1.3,0x59d0ff,{opacity:0,blending:THREE.AdditiveBlending,depthTest:false,fog:false}),flowUp=pts(260,1.3,0xffb347,{opacity:0,blending:THREE.AdditiveBlending,depthTest:false,fog:false});flowDown.p.renderOrder=flowUp.p.renderOrder=9;
const fS=[...Array(260)].map(()=>rnd()),tmpv=new THREE.Vector3();
function updFlow(t,dt,bitY,k){fluidUpd(t,k,bitY);flowDown.p.material.opacity=flowUp.p.material.opacity=k*.95;if(k<.01)return;const LB=SEABED-bitY,TD=LD+LB,TU=LU+LB,sp=38;
 for(let i=0;i<260;i++){const u=(fS[i]+t*sp/TD)%1,s=u*TD;if(s<LD){downC.getPointAt(s/LD,tmpv)}else tmpv.set(0,SEABED-(s-LD),0);flowDown.a.set([tmpv.x,tmpv.y,tmpv.z],i*3);
  const v=(fS[i]*1.7+t*sp/TU)%1,s2=v*TU;if(s2<LB)tmpv.set(1.3,bitY+s2,.4);else upC.getPointAt((s2-LB)/LU,tmpv);flowUp.a.set([tmpv.x,tmpv.y,tmpv.z],i*3)}
 flowDown.g.attributes.position.needsUpdate=flowUp.g.attributes.position.needsUpdate=true}
/* fluido realista: volume com fluxo viscoso (ruído em movimento, brilho de fresnel e bolhas), sobre as mesmas trajetórias */
const FL_VS='varying vec3 vN;varying vec3 vV;varying vec2 vUv;void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}';
const FL_FS=`uniform float uT,uK,uDir;uniform vec3 uA,uB;uniform float uLen;varying vec3 vN;varying vec3 vV;varying vec2 vUv;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p=p*2.07+vec2(3.1,1.7);a*=.5;}return v;}
void main(){float s=vUv.x*uLen;vec2 q=vec2(vUv.y*6.2831*.9,s*.07-uT*uDir*1.6);float f=fbm(q*vec2(1.6,1.)+vec2(0.,fbm(q*2.+uT*.2)*1.4));float st=smoothstep(.35,.85,f);
 vec3 N=normalize(vN),V=normalize(vV);float fr=pow(1.-max(dot(N,V),0.),2.4);vec3 L=normalize(vec3(.4,.8,.5));float sp=pow(max(dot(reflect(-L,N),V),0.),40.);
 vec3 col=mix(uA,uB,st)*(.55+.5*max(dot(N,L),0.))+vec3(.9,.95,1.)*sp*.7+uB*fr*.9;
 float bub=smoothstep(.93,.97,n(q*7.+vec2(5.,uT*uDir*3.)));col+=bub*.35;
 float a=(.55+.35*st+fr*.35)*uK;gl_FragColor=vec4(col,a);}`;
function fluidTube(curve,r,A,B,dir){const g=new THREE.TubeGeometry(curve,260,r,20,false);const m=new THREE.ShaderMaterial({vertexShader:FL_VS,fragmentShader:FL_FS,transparent:true,depthWrite:false,uniforms:{uT:{value:0},uK:{value:0},uDir:{value:dir},uA:{value:new THREE.Color(A)},uB:{value:new THREE.Color(B)},uLen:{value:curve.getLength()}}});const o=new THREE.Mesh(g,m);o.renderOrder=8;o.frustumCulled=false;scene.add(o);return o}
const fldD=fluidTube(downC,.5,0x7a4a24,0xc8803a,1),fldU=fluidTube(upC,.62,0x4a3320,0x9a6a38,1);
const shaftG=new THREE.CylinderGeometry(1,1,1,20,1,true);
const shD=new THREE.Mesh(shaftG,fldD.material.clone()),shU=new THREE.Mesh(shaftG,fldU.material.clone());for(const o of[shD,shU]){o.renderOrder=8;o.frustumCulled=false;scene.add(o)}
function fluidUpd(t,k,bitY){const on=k>.01;for(const o of[fldD,fldU,shD,shU])o.visible=on;if(!on)return;const LB=Math.max(1,SEABED-bitY);
 for(const o of[fldD,fldU,shD,shU]){o.material.uniforms.uT.value=t;o.material.uniforms.uK.value=k*.9}fldD.material.uniforms.uDir.value=1;fldU.material.uniforms.uDir.value=-1;
 shD.position.set(0,SEABED-LB/2,0);shD.scale.set(.5,LB,.5);shD.material.uniforms.uLen.value=LB;shD.material.uniforms.uDir.value=1;
 shU.position.set(1.3,SEABED-LB/2,.4);shU.scale.set(.62,LB,.62);shU.material.uniforms.uLen.value=LB;shU.material.uniforms.uDir.value=-1}


/* ---------- números gigantes em profundidade (tipografia em camadas) ---------- */
const FR=[30,-22,-96,-172,-262,-322],bigNums=[];
document.fonts.ready.then(()=>FR.forEach((y,i)=>{const t=ctex(1024,560,g=>{g.font='600 520px Oswald, Arial Narrow, sans-serif';g.textAlign='center';g.textBaseline='middle';g.lineWidth=7;g.strokeStyle=i===0?'rgba(14,42,74,1)':'rgba(255,255,255,1)';g.strokeText(pad(i+1),512,300)},{wrap:false});
 const m=new THREE.Mesh(new THREE.PlaneGeometry(96,52.5),new THREE.MeshBasicMaterial({map:t,transparent:true,opacity:i===0?.1:.07,depthWrite:false,fog:false}));m.position.set(64,y+14,i<4?BACK+6:FRONT+.6);m.renderOrder=i<4?3:2;m.userData={base:m.material.opacity,y:FR[i]};scene.add(m);bigNums.push(m)}));

// sombras: tudo projeta e recebe, menos efeitos e transparências
scene.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&o.material&&!o.material.transparent&&!o.material.isShaderMaterial&&!Array.isArray(o.material)){o.castShadow=true;o.receiveShadow=true}});
ocean.castShadow=false;
applyDetailToScene(scene,grime);

/* =====================================================================
   Texturas reais (locais, WebP), HDRI e modelos oficiais opcionais (GLB)
   ===================================================================== */
async function loadTextures(){
 const hdriP=new Promise(res=>{nTotal++;new RGBELoader().load('assets/hdri/ceu.hdr',t=>{const env=pmrem.fromEquirectangular(t).texture;t.dispose();scene.environment=env;oceanMat.envMap=oceanFar.envMap=env;oceanMat.needsUpdate=oceanFar.needsUpdate=true;nDone++;prog();res()},undefined,()=>{nDone++;prog();res()})});
 const[dd,dn,dr,cd,cn,wn]=await Promise.all([tex('metal_plate_diff.webp'),tex('metal_plate_nor_gl.webp',{srgb:false}),tex('metal_plate_rough.webp',{srgb:false}),
  tex('corrugated_iron_diff.webp',{rep:[3,1]}),tex('corrugated_iron_nor_gl.webp',{srgb:false,rep:[3,1]}),tex('waternormals.webp',{srgb:false,rep:[18,6]})]);
 if(dd){Object.assign(M.deck,{map:dd,normalMap:dn,roughnessMap:dr,roughness:1});M.deck.color.set(0xb9bcbb);M.deck.needsUpdate=true}
 if(cd){Object.assign(M.wall,{map:cd,normalMap:cn});M.wall.needsUpdate=true}
 if(wn){for(const m of[oceanMat,oceanFar]){m.normalMap=wn;m.normalScale=new THREE.Vector2(.55,.55);m.needsUpdate=true}}
 await hdriP}
let geoBase=null;
async function loadGeology(){
 const ids=[...new Set(LAY.map(l=>l[2]))],ims=await Promise.all(ids.map(id=>img(id+'_diff.webp'))),map={};ids.forEach((id,i)=>map[id]=ims[i]);geoBase=map;drawStrata(map);
 const[sd,sn,sr,cc,rk,r6]=await Promise.all([tex('damp_beach_sand_diff.webp',{rep:[1,1]}),tex('damp_beach_sand_nor_gl.webp',{srgb:false}),tex('damp_beach_sand_rough.webp',{srgb:false}),tex('granular_concrete_diff.webp',{rep:[2,4]}),tex('dark_rock_diff.webp',{rep:[.5,.5]}),tex('rock_06_diff.webp',{rep:[2,3]})]);
 if(sd){Object.assign(M.seabed,{map:sd,normalMap:sn,roughnessMap:sr,roughness:1});M.seabed.color.set(0xc9bfa9);M.seabed.needsUpdate=true}
 if(rk){M.rock.map=rk;M.rock.color.set(0x9a9088);M.rock.needsUpdate=true}
 if(r6){lensWallMat.map=r6;lensWallMat.color.set(0xd2c2a6);lensWallMat.needsUpdate=true}
 if(cc)for(const m of[cementM,M.cement]){m.map=cc;m.needsUpdate=true}}
/* ---------- pacote HD: depois que o visitante entra, só em GPU/rede capazes; troca as texturas nos mesmos slots (sem recompilar shaders) ---------- */
const loadDetail=()=>['paint','steel'].forEach(k=>TL.load('assets/texturas/det_'+k+'.webp',t=>{t.anisotropy=ANISO;setDetailTexture(k,t)}));
let hdStarted=false,hdMaps=null;
const strataWidth=()=>Q.level>=3?Math.min(6144,MAXTEX):clamp(Math.round(innerWidth*Math.min(devicePixelRatio,1.5)*1.9),2560,4096);
const texQ=(f,o={})=>new Promise(res=>TL.load('assets/texturas/hd/'+f,t=>{if(o.srgb!==false)t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(...(o.rep||[1,1]));t.anisotropy=ANISO;res(t)},undefined,()=>res(null)));
const imgQ=f=>new Promise(res=>IL.load('assets/texturas/hd/'+f,i=>res(i),undefined,()=>res(null)));
async function loadHD(){
 if(hdStarted||document.hidden)return;if(!/[?&]hd/.test(location.search)&&(TOUCH||Q.level<1||navigator.connection?.saveData))return;hdStarted=true;
 const [sd,sn,dd,dn,cd]=await Promise.all([texQ('damp_beach_sand_diff.webp',{rep:[1,1]}),texQ('damp_beach_sand_nor_gl.webp',{srgb:false}),texQ('metal_plate_diff.webp'),texQ('metal_plate_nor_gl.webp',{srgb:false}),texQ('corrugated_iron_diff.webp',{rep:[3,1]})]);
 const swap=(m,k,t)=>{if(!t||!m[k])return;const old=m[k];m[k]=t;if(old!==t)old.dispose()};
 swap(M.seabed,'map',sd);swap(M.seabed,'normalMap',sn);swap(M.deck,'map',dd);swap(M.deck,'normalMap',dn);swap(M.wall,'map',cd);
 // rochas: o canvas dos estratos é refeito maior, com texturas HD e mapa de normais de verdade
 const ids=[...new Set(LAY.map(l=>l[2]))],[d,n]=await Promise.all([Promise.all(ids.map(k=>imgQ(k+'_diff.webp'))),Promise.all(ids.map(k=>imgQ(k+'_nor_gl.webp')))]);
 const dm={},nm={};ids.forEach((k,j)=>{dm[k]=d[j]||(geoBase&&geoBase[k]);nm[k]=n[j]});
 await new Promise(r=>setTimeout(r,60));
 hdMaps={dm,nm};drawStrata(dm,nm,strataWidth());mark('hd');
}
let gltf=null;
const glbFor=async k=>{if(!MODELS[k])return null;gltf??=new (await import('three/addons/loaders/GLTFLoader.js')).GLTFLoader().setMeshoptDecoder((await import('three/addons/libs/meshopt_decoder.module.js')).MeshoptDecoder);return new Promise(res=>gltf.load('assets/models/'+MODELS[k],g=>res(g.scene),undefined,()=>res(null)))};
// troca o modelo procedural pelo oficial, mantendo posição, escala e âncoras
async function swapOfficial(k,group){const s=await glbFor(k);if(!s)return;group.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(group),gs=group.getWorldScale(V()),sz=b.getSize(V()).divide(gs),c=group.worldToLocal(b.getCenter(V()));
 const sb=new THREE.Box3().setFromObject(s),ss=sb.getSize(V()),sc=sb.getCenter(V());group.traverse(o=>{if(o.isMesh)o.visible=false});
 const wrap=new THREE.Group();s.position.sub(sc);wrap.add(s);wrap.scale.setScalar(Math.min(sz.x/ss.x,sz.y/ss.y,sz.z/ss.z));wrap.position.copy(c);group.add(wrap);s.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true})}
swapOfficial('ship',ship);swapOfficial('bop',bop);swapOfficial('ebop',eb);swapOfficial('k20',k20);rovs.forEach(r=>swapOfficial('rov',r));

/* =====================================================================
   Câmera: descida reta (só translação vertical)
   ===================================================================== */
const OV={cy:-172,h:640,tl:.12},TILT=.06;
const isWide=()=>innerWidth/innerHeight>1.05&&innerWidth>820;
function viewH(){const asp=innerWidth/innerHeight;return isWide()?Math.max(128,150/(asp*.7)):clamp(160/(asp*.94),128,240)}
const cur={cy:FR[0],h:viewH(),tl:TILT};let overview=false,fScroll=0,sec=0,settled=false,entered=false;
let snaps=$$('#snaps .snap');if(snaps.length<6){$('#snaps').innerHTML=SECS.map((s,i)=>`<section class="snap" id="s${i}"></section>`).join('');snaps=$$('#snaps .snap')}
const snapH=()=>snaps[1].offsetTop-snaps[0].offsetTop||innerHeight;
function scrollState(){const f=clamp(scrollY/snapH(),0,FR.length-1),i=Math.min(FR.length-2,Math.floor(f)),e=smooth(f-i);return{f,cy:lerp(FR[i],FR[i+1],e)}}
let camT=V();
/* ---------- zoom: aproxima ou afasta a câmera do ponto de enquadramento da seção; com zoom, arrastar para os lados percorre a cena ---------- */
let zoom=1,panT=0,panCur=0;const ZMIN=.8,ZMAX=3.2,ZSTEP=1.4;
function placeCamera(dt){const st=scrollState();fScroll=st.f;const Tg=overview?OV:{cy:st.cy,h:viewH()/zoom,tl:TILT},k=RM?1:1-Math.exp(-dt*3.4);
 cur.cy+=(Tg.cy-cur.cy)*k;cur.h=Math.exp(lerp(Math.log(cur.h),Math.log(Tg.h),k));cur.tl+=(Tg.tl-cur.tl)*k;
 const asp=innerWidth/innerHeight,wide=isWide(),vh0=viewH()/zoom,ovk=clamp((cur.h-vh0)/(OV.h-vh0)),d=(cur.h/2)/Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
 const shift=wide?cur.h*asp*.16*(1-ovk):0,yoff=wide?0:cur.h*.2*(1-ovk);
 const pl=Math.max(0,118-cur.h*asp/2);panT=clamp(panT,-pl,pl);panCur+=(panT-panCur)*k;
 const tx=-shift+panCur*(1-ovk),ty=cur.cy-yoff;camera.position.set(tx,ty+d*cur.tl,FRONT+d);camera.lookAt(tx,ty,0);camT.set(tx,ty,0);
 camera.near=Math.max(5,d*.2);camera.far=d+21000;camera.updateProjectionMatrix();
 // sombra acompanha o que está na tela
 const half=Math.min(260,cur.h*asp*.62);Object.assign(key.shadow.camera,{left:-half,right:half,top:half,bottom:-half});key.shadow.camera.updateProjectionMatrix();key.target.position.copy(camT);key.position.copy(camT).add(SUN)}

/* =====================================================================
   Som ambiente (Web Audio, procedural)
   ===================================================================== */
const audio={on:false,ready:false,u:0,g:0,
 init(){const C=this.ctx=new (window.AudioContext||window.webkitAudioContext)();this.master=C.createGain();this.master.gain.value=0;this.master.connect(C.destination);this.duckG=C.createGain();this.duckG.connect(this.master);const out=this.duckG;
  const len=C.sampleRate*4,w=C.createBuffer(1,len,C.sampleRate),b=C.createBuffer(1,len,C.sampleRate),wd=w.getChannelData(0),bd=b.getChannelData(0);let last=0;for(let i=0;i<len;i++){const r=Math.random()*2-1;wd[i]=r;last=(last+.02*r)/1.02;bd[i]=last*3.5}this.white=w;
  const src=buf=>{const s=C.createBufferSource();s.buffer=buf;s.loop=true;s.start(0,Math.random()*3);return s},filt=(t,f,q=.7)=>{const x=C.createBiquadFilter();x.type=t;x.frequency.value=f;x.Q.value=q;return x},gain=v=>{const g=C.createGain();g.gain.value=v;return g},lfo=(r,d,p)=>{const o=C.createOscillator();o.frequency.value=r;const g=gain(d);o.connect(g);g.connect(p);o.start()};
  this.surf=gain(0);this.surf.connect(out);{const g=gain(.5);src(b).connect(filt('lowpass',650)).connect(g).connect(this.surf);lfo(.11,.32,g.gain)}{const g=gain(.05);src(w).connect(filt('highpass',2600)).connect(g).connect(this.surf);lfo(.11,.04,g.gain)}
  {const f=filt('bandpass',500,.6),g=gain(.05);src(w).connect(f).connect(g).connect(this.surf);lfo(.05,.04,g.gain);lfo(.07,200,f.frequency)}{const o=C.createOscillator();o.type='sawtooth';o.frequency.value=48;o.connect(filt('lowpass',170)).connect(gain(.03)).connect(this.surf);o.start()}
  this.under=gain(0);this.under.connect(out);{const g=gain(.65);src(b).connect(filt('lowpass',300)).connect(g).connect(this.under);lfo(.08,.2,g.gain)}{const g=gain(.045);for(const f of[41,43.3]){const o=C.createOscillator();o.frequency.value=f;o.connect(g);o.start()}g.connect(this.under)}
  this.verb=C.createConvolver();const LL=C.sampleRate*3.4,ib=C.createBuffer(2,LL,C.sampleRate);for(let ch=0;ch<2;ch++){const d=ib.getChannelData(ch);for(let i=0;i<LL;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/LL,3)}this.verb.buffer=ib;this.verb.connect(gain(.7)).connect(this.under);
  this.ground=gain(0);this.ground.connect(out);{const g=gain(.7);src(b).connect(filt('lowpass',130)).connect(g).connect(this.ground);const o=C.createOscillator();o.frequency.value=2.6;o.connect(gain(.25)).connect(g.gain);o.start()}
  this.grindG=gain(0);src(w).connect(filt('bandpass',850,3)).connect(this.grindG).connect(this.ground);this.next={ping:2,bub:1,clank:3};this.ready=true},
 start(){try{if(!this.ready)this.init();this.ctx.resume();this.on=true;this.master.gain.setTargetAtTime(.85,this.ctx.currentTime,.8)}catch(e){this.on=false}sndUI()},
 stop(){if(this.ready)this.master.gain.setTargetAtTime(0,this.ctx.currentTime,.3);this.on=false;sndUI()},
 mix(u,g,drill){if(!this.ready)return;const t=this.ctx.currentTime;this.surf.gain.setTargetAtTime((1-u)*(1-g),t,.4);this.under.gain.setTargetAtTime(u*(1-g),t,.4);this.ground.gain.setTargetAtTime(g,t,.5);this.grindG.gain.setTargetAtTime(g*drill*.3,t,.3);this.u=u;this.g=g},
 duck(v){if(this.ready)this.duckG.gain.setTargetAtTime(v?.15:1,this.ctx.currentTime,.4)},
 env(n,a,p,d){const t=this.ctx.currentTime;n.gain.setValueAtTime(0,t);n.gain.linearRampToValueAtTime(p,t+a);n.gain.exponentialRampToValueAtTime(.0001,t+a+d)},
 tone(type,f0,f1,dur,peak,dest){const C=this.ctx,o=C.createOscillator(),g=C.createGain(),t=C.currentTime;o.type=type;o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+dur*.7);o.connect(g);[].concat(dest).forEach(d=>g.connect(d));this.env(g,.004,peak,dur);o.start();o.stop(t+dur+.1)},
 noise(f0,f1,q,dur,peak,dest){const C=this.ctx,s=C.createBufferSource(),f=C.createBiquadFilter(),g=C.createGain(),t=C.currentTime;s.buffer=this.white;f.type='bandpass';f.Q.value=q;f.frequency.setValueAtTime(f0,t);f.frequency.exponentialRampToValueAtTime(f1,t+dur);s.connect(f).connect(g).connect(dest);this.env(g,.01,peak,dur);s.start(0,Math.random()*2);s.stop(t+dur+.1)},
 update(dt){if(!this.on)return;const n=this.next;n.ping-=dt;n.bub-=dt;n.clank-=dt;
  if(this.u>.4&&this.g<.5&&n.ping<0){this.tone('sine',1150+Math.random()*80,1140,1.8,.14,[this.under,this.verb]);n.ping=6+Math.random()*5}
  if(this.u>.4&&this.g<.5&&n.bub<0){this.tone('sine',260+Math.random()*200,900+Math.random()*700,.1,.04,this.under);n.bub=.4+Math.random()*1.6}
  if(this.u<.5&&n.clank<0){this.noise(1200+Math.random()*1800,1300,12,.5,.07,this.surf);n.clank=3+Math.random()*6}},
 tick(){if(this.on)this.tone('sine',1700,1650,.05,.03,this.duckG)},whoosh(o){if(this.on)this.noise(o?300:2000,o?2200:300,1.2,.4,.1,this.master)}};
const sndBtn=$('#sndBtn');function sndUI(){sndBtn.setAttribute('aria-pressed',audio.on)}sndBtn.onclick=()=>audio.on?audio.stop():audio.start();
document.addEventListener('visibilitychange',()=>{if(!audio.ready)return;if(document.hidden)audio.ctx.suspend();else if(audio.on)audio.ctx.resume()});

/* =====================================================================
   Animações de texto
   ===================================================================== */
function splitWords(el,text){el.innerHTML=text.split(' ').map(w=>`<span class="w"><span>${w}</span></span>`).join(' ');return[...el.querySelectorAll('.w>span')]}
function scramble(el,text,dur=650){if(RM){el.textContent=text;return}const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·';const t0=performance.now();
 const step=now=>{const k=clamp((now-t0)/dur);const n=Math.floor(k*text.length);let s=text.slice(0,n);for(let i=n;i<text.length;i++)s+=text[i]===' '?' ':chars[(Math.random()*chars.length)|0];el.textContent=s;if(k<1)requestAnimationFrame(step)};requestAnimationFrame(step)}
function rollNumber(el,txt){[...el.children].slice(0,-1).forEach(c=>c.remove());const old=el.lastElementChild;if(old&&old.textContent===txt)return;
 const nu=document.createElement('span');nu.textContent=txt;el.appendChild(nu);
 if(RM||!old){old&&old.remove();return}old.getAnimations().forEach(a=>a.cancel());el.style.position='relative';nu.style.position='absolute';nu.style.left='0';nu.style.top='0';
 old.animate([{transform:'translateY(0)'},{transform:'translateY(-105%)'}],{duration:520,easing:EASE,fill:'forwards'}).onfinish=()=>{old.remove();if(nu.isConnected&&el.lastElementChild===nu)nu.style.position=''};
 nu.animate([{transform:'translateY(105%)'},{transform:'translateY(0)'}],{duration:620,easing:EASE,fill:'both'})}
function countUp(el,txt){const m=txt.match(/^(\d+)(.*)$/);if(!m||RM){el.textContent=txt;return}const n=+m[1],sfx=m[2],t0=performance.now();const step=now=>{const k=smooth((now-t0)/900);el.textContent=Math.round(n*k)+sfx;if(k<1)requestAnimationFrame(step)};requestAnimationFrame(step)}
const wordsIn=(ws,base=0,step=12)=>{if(!RM)ws.forEach((w,k)=>w.animate([{transform:'translateY(8px)',opacity:0,filter:'blur(4px)'},{transform:'none',opacity:1,filter:'blur(0)'}],{duration:700,delay:base+k*step,easing:EASE,fill:'both'}))};

/* =====================================================================
   Interface
   ===================================================================== */
const nav=$('#nav'),tabs=$('#tabs'),ind=$('#ind'),sheetMenu=$('#sheetMenu'),copy=$('#copy'),scrim=$('#scrim'),fp=$('#fp'),cat=$('#cat');
const leaf='<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/></svg>';
SECS.forEach((s,i)=>{const b=document.createElement('button');b.onclick=()=>go(i);tabs.appendChild(b);s.tabEl=b;
 const m=document.createElement('button');m.onclick=()=>{go(i);menu(false)};sheetMenu.appendChild(m);s.menuEl=m;
 const li=document.createElement('li');li.innerHTML='<button></button>';li.firstChild.onclick=()=>go(i);$('#mTicks').appendChild(li);s.tick=li;
 const o=document.createElement('button');o.className='ov glass';o.onclick=()=>go(i);$('#ovb').appendChild(o);s.ob=o});
// no celular, tour, noite e idioma saem da navbar e ficam no fim do menu (mesmos botões, por procuração)
{const row=document.createElement('div');row.className='prefs';for(const[id,k]of[['tourBtn','tour'],['nightBtn','noite'],['langBtn','langNome']]){const o=$('#'+id),b=document.createElement('button');b.innerHTML=o.querySelector('svg').outerHTML+`<span data-i="${k}"></span>`;b.onclick=()=>{o.click();if(id==='tourBtn')menu(false)};const sync=()=>o.hasAttribute('aria-pressed')&&b.setAttribute('aria-pressed',o.getAttribute('aria-pressed'));sync();new MutationObserver(sync).observe(o,{attributes:true,attributeFilter:['aria-pressed']});row.appendChild(b)}sheetMenu.append(document.createElement('hr'),row)}
// a dica da navbar só aparece quando o botão está sem texto visível
const syncTips=()=>$$('#nav .nb[data-tip]').forEach(b=>{const l=b.querySelector('.lbl');b.classList.toggle('tip-on',!l||l.offsetParent===null)});addEventListener('resize',syncTips);
for(const p of ALL){if(!A[p.id])continue;const b=document.createElement('button');b.className='hp off'+(p.esg?' esg':p.ctx?' ctx':'');b.tabIndex=-1;b.innerHTML=`<i>${p.esg?leaf:''}</i><span>${p.fotos?`<img alt="" data-src="${thumbUrl(p.fotos[0])}">`:''}<em></em></span>`;
 b.onclick=e=>{e.stopPropagation();openPanel(p,b)};b.onmouseenter=()=>{audio.tick();loadPrev(p)};b.onfocus=()=>loadPrev(p);$('#hots').appendChild(b);p.el=b}
function loadPrev(p){const im=p.el&&p.el.querySelector('img[data-src]');if(im&&!im.src)im.src=im.dataset.src}
const tagsEl=$('#tags');const TAGS=[...LAY.slice(0,7).map((l,i)=>({k:i,p:V(-58,SEABED-((l[0]+LAY[i+1][0])/2)*GH-(i>=4?-GH*.03:0),FRONT+.5)})),{k:7,p:V(20,SEABED-GH*.655,FRONT+.5),big:1},{k:8,p:V(-16,SEABED-GH*.77,FRONT+.5),big:1}]
 .map(o=>{const e=document.createElement('div');e.className='tag3d'+(o.big?' big':'');tagsEl.appendChild(e);return{...o,e}});
function menu(v){const was=sheetMenu.classList.contains('on');sheetMenu.classList.toggle('on',v);$('#menuBtn').setAttribute('aria-expanded',v);if(v&&!was)setTimeout(()=>SECS[sec].menuEl.focus({preventScroll:true}),60);else if(!v&&was&&sheetMenu.contains(document.activeElement))$('#menuBtn').focus({preventScroll:true})}
$('#menuBtn').onclick=e=>{e.stopPropagation();menu(!sheetMenu.classList.contains('on'))};
document.addEventListener('click',e=>{if(!e.target.closest('#sheetMenu,#menuBtn'))menu(false)});
function moveInd(i){const b=SECS[i].tabEl;if(!b.offsetParent)return;ind.style.left=b.offsetLeft+'px';ind.style.width=b.offsetWidth+'px'}
function go(i,instant){i=clamp(i,0,SECS.length-1);if(overview)setOverview(false);snaps[i].scrollIntoView({behavior:RM||instant?'auto':'smooth'})}
$('#bUp').onclick=()=>go(sec-1);$('#bDn').onclick=()=>go(sec+1);
function waitSettled(cb,max=4500){const t0=performance.now();const f=()=>{if(settled||performance.now()-t0>max)cb();else setTimeout(f,120)};setTimeout(f,250)}
function openItem(p,fromPop){if(fpState)return;if(p.s>=0&&p.s!==sec){go(p.s);waitSettled(()=>openPanel(p,p.el&&!p.el.classList.contains('off')?p.el:null,fromPop))}else openPanel(p,p.el&&!p.el.classList.contains('off')?p.el:null,fromPop)}

// texto da seção
const cIdx=$('#cIdx'),cEb=$('#cEb'),cTitle=$('#cTitle'),cText=$('#cText'),cChips=$('#cChips'),cCta=$('#cCta'),cCta2=$('#cCta2');
let shown=-1,shownKey='',copyBusy=null,esgMode=false;
const itemsOf=i=>esgMode?ESG.filter(e=>e.s===i):P.filter(p=>p.s===i);
function fillChips(i){cChips.innerHTML='';const items=itemsOf(i);$('#cCnt').textContent=items.length;$('#cChlT').textContent=esgMode?U('nestaEsg'):U('nesta');
 items.forEach((p,k)=>{const b=document.createElement('button');b.className='chip'+(p.esg?' esg':p.ctx?' ctx':'');b.innerHTML=`<i></i>${T(p).n}`;b.onclick=()=>openPanel(p,b);
  b.onmouseenter=()=>{if(p.el){p.el.classList.add('hl');loadPrev(p)}audio.tick()};b.onmouseleave=()=>p.el&&p.el.classList.remove('hl');cChips.appendChild(b);
  if(!RM)b.animate([{opacity:0,transform:'translateY(10px) scale(.92)'},{opacity:1,transform:'none'}],{duration:520,delay:380+k*45,easing:'cubic-bezier(.34,1.4,.64,1)',fill:'both'})});
 if(!items.length)cChips.innerHTML=`<span style="font-size:12px;opacity:.85">${U('semEsg')}</span>`;cChips.scrollTop=0;requestAnimationFrame(chipsMore)}
const chipsMore=()=>cChips.classList.toggle('more',cChips.scrollHeight-cChips.scrollTop-cChips.clientHeight>4);
function setCopy(i,force){const k=i+'|'+esgMode+'|'+L;if(k===shownKey&&!force)return;const same=i===shown&&!force;const first=shown<0;shown=i;shownKey=k;const s=SECS[i];
 const fill=()=>{$('#secLive').textContent=`${U('secao')} ${i+1} ${U('de')} ${SECS.length}: ${T(s).t}`;rollNumber(cIdx,pad(i+1));scramble(cEb,T(s).eb.toUpperCase());const tw=splitWords(cTitle,T(s).t),pw=splitWords(cText,T(s).p);cCta.href=BASE+s.u;cCta2.hidden=i!==SECS.length-1;fillChips(i);
  if(!RM){tw.forEach((w,k)=>w.animate([{transform:'translateY(110%)',opacity:0},{transform:'none',opacity:1}],{duration:900,delay:80+k*55,easing:EASE,fill:'both'}));wordsIn(pw,260);
   cCta.parentNode.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:600,delay:520,easing:EASE,fill:'both'})}};
 if(same){fillChips(i);return}
 if(first||RM){fill();return}
 const kids=[cTitle,cText,cChips,cCta.parentNode];if(copyBusy)copyBusy.forEach(a=>a.cancel());
 copyBusy=kids.map((el,k)=>el.animate([{opacity:1,transform:'none'},{opacity:0,transform:'translateY(-10px)'}],{duration:240,delay:k*25,easing:'ease-in',fill:'forwards'}));
 Promise.all(copyBusy.map(a=>a.finished.catch(()=>{}))).then(()=>{if(shown!==i)return;copyBusy.forEach(a=>a.cancel());copyBusy=null;fill()})}

// pontos clicáveis
const tmp=new THREE.Vector3();
const toScreen=v=>{tmp.copy(v).project(camera);return{x:(tmp.x*.5+.5)*innerWidth,y:(-tmp.y*.5+.5)*innerHeight,on:tmp.z<1&&Math.abs(tmp.x)<.97&&Math.abs(tmp.y)<.9}};
let hotRects=null;
function updHots(){if(!hotRects||frameN%10===0)hotRects={cr:copy.classList.contains('hide')?null:copy.getBoundingClientRect(),tr:tourOn?$('#tour').getBoundingClientRect():null,nr:nav.getBoundingClientRect()};const{cr,tr,nr}=hotRects,shownPts=[];
 for(const p of ALL){if(!p.el)continue;A[p.id].getWorldPosition(tmp);const s=toScreen(tmp);
  let on=s.on&&(p.esg?esgMode:!esgMode)&&(overview?p.esg:(p.s===sec&&settled));
  for(const r of[cr,tr])if(on&&r&&s.x>r.left-12&&s.x<r.right+12&&s.y>r.top-12&&s.y<r.bottom+12)on=false;
  if(on&&s.y<nr.bottom+10)on=false;
  if(on){let px=s.x,py=s.y;if(shownPts.some(q=>Math.hypot(q.x-px,q.y-py)<34)){let ok=false;   // pontos agrupados (ex.: topsides): afasta em anel em vez de esconder
   for(const rad of[38,58,78]){for(let k=0;k<12&&!ok;k++){const an=k*Math.PI/6+rad*.1,cx=s.x+Math.cos(an)*rad,cy=s.y+Math.sin(an)*rad;if(cx>20&&cx<innerWidth-20&&cy>nr.bottom+14&&cy<innerHeight-70&&!shownPts.some(q=>Math.hypot(q.x-cx,q.y-cy)<34)){px=cx;py=cy;ok=true}}if(ok)break}
   if(!ok)on=false}
  if(on){shownPts.push({x:px,y:py});s.x=px;s.y=py}}
  p.el.classList.toggle('off',!on);p.el.tabIndex=on?0:-1;if(on)p.el.style.transform=`translate3d(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px,0)`}}

// visão geral
function setOverview(v){overview=v;$('#zoom').classList.toggle('hide',v);$('#ovBtn').setAttribute('aria-pressed',v);copy.classList.toggle('hide',v||tourOn);$('#meter').style.visibility=v?'hidden':'';
 SECS.forEach((s,i)=>{s.ob.classList.toggle('on',v);s.ob.style.transitionDelay=v?(120+i*70)+'ms':'0ms'})}
$('#ovBtn').onclick=()=>{if(tourOn)setTour(false);setOverview(!overview)};
// só a rolagem do usuário sai da visão geral (não a rolagem suave disparada pelo próprio site)
function updZoomUI(){const p=Math.round(zoom*100);$('#zPct').textContent=p+'%';$('#zPct').setAttribute('aria-label',`${U('zoomReset')} (${p}%)`);$('#zIn').disabled=zoom>=ZMAX-.01;$('#zOut').disabled=zoom<=ZMIN+.01;document.body.classList.toggle('zoomed',zoom>1.02)}
function setZoom(z){z=clamp(z,ZMIN,ZMAX);if(Math.abs(z-1)<.07)z=1;zoom=z;if(zoom<=1.02)panT=0;updZoomUI()}
const zoomBy=f=>setZoom(zoom*f);
$('#zIn').onclick=()=>zoomBy(ZSTEP);$('#zOut').onclick=()=>zoomBy(1/ZSTEP);$('#zPct').onclick=()=>setZoom(1);
/* ---------- seletor de qualidade: Automática, Baixa, Média, Alta (Full HD) e Ultra (4K) ---------- */
const qBtn=$('#qBtn'),qMenu=$('#qMenu'),qEl=$('#qual'),toastEl=$('#toast'),Q_NAMES=['qBaixa','qMedia','qAlta','qUltra'];
const qName=l=>U(Q_NAMES[l]);
function toast(msg){toastEl.textContent=msg;toastEl.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>toastEl.classList.remove('on'),2400)}
function qUI(){
 $('#qLbl').textContent=Q.mode==='auto'?`Auto · ${qName(Q.level)}`:qName(Q.level);
 qMenu.querySelectorAll('button').forEach(b=>b.setAttribute('aria-checked',String(b.dataset.m===String(Q.mode))));
 const sz=new THREE.Vector2();renderer.getDrawingBufferSize(sz);const info=qMenu.querySelector('.qinfo');
 if(info)info.textContent=`${U('qRender')} ${sz.x}×${sz.y}${Q.fps?` · ${Math.round(Q.fps)} ${U('qFps')}`:''}`}
function buildQMenu(){
 qMenu.innerHTML=[['auto','qAuto','qAutoD'],[0,'qBaixa','qBaixaD'],[1,'qMedia','qMediaD'],[2,'qAlta','qAltaD'],[3,'qUltra','qUltraD']].map(([m,n,d])=>`<button role="menuitemradio" data-m="${m}" aria-checked="false"><i></i><b>${U(n)}</b><small>${U(d)}</small></button>`).join('')+'<div class="qinfo"></div>';
 qMenu.querySelectorAll('button').forEach(b=>b.onclick=()=>{setQMode(b.dataset.m==='auto'?'auto':+b.dataset.m);openQ(false)});qUI()}
function setQMode(m){Q.mode=m;Q.lock=m!=='auto';Q.tried3=false;Q.good=0;try{localStorage.setItem('hmh-q',String(m))}catch(e){}
 setQuality(m==='auto'?autoLevel():m);toast(`${U('qAtiva')}: ${m==='auto'?U('qAuto')+' · ':''}${qName(Q.level)}`)}
function openQ(v){qEl.classList.toggle('on',v);qBtn.setAttribute('aria-expanded',v);if(v){qUI();qMenu.querySelector('[aria-checked="true"]')?.focus()}else if(qMenu.contains(document.activeElement))qBtn.focus()}
qBtn.onclick=e=>{e.stopPropagation();openQ(!qEl.classList.contains('on'))};
document.addEventListener('click',e=>{if(!e.target.closest('#qual'))openQ(false)});
let pan=null;
addEventListener('pointerdown',e=>{if(zoom<=1.02||overview||fpState||(e.pointerType==='mouse'&&e.button!==0))return;if(!e.target.closest||e.target.closest('button,a,input,.hp,.glass,.copy,#fp,#cat,#esgSheet,#tour,#intro'))return;pan={id:e.pointerId,x:e.clientX,start:panT,moved:false}});
addEventListener('pointermove',e=>{if(!pan||e.pointerId!==pan.id)return;const dx=e.clientX-pan.x;if(!pan.moved&&Math.abs(dx)<4)return;pan.moved=true;document.body.classList.add('panning');panT=pan.start-dx*(cur.h*(innerWidth/innerHeight)/innerWidth)});
const endPan=e=>{if(pan&&e.pointerId===pan.id){pan=null;document.body.classList.remove('panning')}};addEventListener('pointerup',endPan);addEventListener('pointercancel',endPan);
const userScroll=()=>{if(overview&&!fpState&&!cat.classList.contains('on'))setOverview(false)};
addEventListener('wheel',userScroll,{passive:true});addEventListener('touchmove',userScroll,{passive:true});

// ESG
const esgSheet=$('#esgSheet'),esgList=$('#esgList'),esgBtn=$('#esgBtn');
function renderEsg(){esgList.innerHTML='';ESG.forEach(e=>{const c=document.createElement('article');c.className='ecard';const t=T(e);c.innerHTML=`<div class="top">${t.cat}<span class="est">${t.st}</span></div><h4>${t.n}</h4><p>${t.d}</p><div class="row">${e.s>=0?`<button>${U('verCena')}</button>`:''}<a href="${BASE+e.u}" target="_blank" rel="noopener">${U('fonteLink')}</a></div>`;
 const vb=c.querySelector('button');if(vb)vb.onclick=()=>{if(innerWidth<820)esgSheet.classList.remove('on');openItem(e)};esgList.appendChild(c);e.card=c})}
function closeEsgSheet(){if(!esgSheet.classList.contains('on'))return;esgSheet.classList.remove('on');if(esgSheet.contains(document.activeElement))esgBtn.focus({preventScroll:true})}
function setEsg(v,openSheet=v){esgMode=v;esgBtn.setAttribute('aria-pressed',v);if(openSheet){esgSheet.classList.add('on');setTimeout(()=>$('#esgT').focus({preventScroll:true}),80)}else closeEsgSheet();
 if(openSheet&&!RM)ESG.forEach((e,k)=>e.card.animate([{opacity:0,transform:'translateX(24px)',filter:'blur(6px)'},{opacity:1,transform:'none',filter:'blur(0)'}],{duration:620,delay:160+k*60,easing:EASE,fill:'both'}));
 if(shown>=0)setCopy(shown)}
esgBtn.onclick=()=>{if(tourOn)setTour(false);setEsg(!esgMode)};$('#esgClose').onclick=closeEsgSheet;$('#esgCnt').textContent=ESG.length;

/* ---------- catálogo ---------- */
const catG=$('#catG'),catF=$('#catF'),catA=$('#catA'),catQ=$('#catQ');let catFilter='*',catArea='*',lastFocus=null;
const catItems=()=>P.filter(p=>!p.ctx),AREAS=[['off','areaOff'],['on','areaOn'],['srv','areaSrv'],['mc','areaMc']],areaOf=p=>p.a||'off',areaLabel=p=>U(AREAS.find(a=>a[0]===areaOf(p))[1]);
const inArea=p=>catArea==='*'||areaOf(p)===catArea;
function renderCatFilters(){catA.innerHTML=[['*','areaTodas'],...AREAS].map(([k,l])=>`<button data-k="${k}" aria-pressed="${k===catArea}">${U(l)}</button>`).join('')+'<span class="catn" id="catN" aria-live="polite"></span>';
 catA.querySelectorAll('button').forEach(b=>b.onclick=()=>{catArea=b.dataset.k;catFilter='*';renderCatFilters();renderCat()});
 const cats=[...new Set(catItems().filter(inArea).map(p=>T(p).c))];catF.innerHTML=[['*',U('todos')],...cats.map(c=>[c,c])].map(([k,l])=>`<button data-k="${k}" aria-pressed="${k===catFilter}">${l}</button>`).join('');
 catF.querySelectorAll('button').forEach(b=>b.onclick=()=>{catFilter=b.dataset.k;renderCatFilters();renderCat()})}
function renderCat(){const q=catQ.value.trim().toLowerCase(),items=catItems().filter(p=>{const t=T(p);return inArea(p)&&(catFilter==='*'||t.c===catFilter)&&(!q||(t.n+' '+t.d+' '+t.c).toLowerCase().includes(q))});
 const n=$('#catN');if(n)n.textContent=`${items.length} ${U(items.length===1?'catContagem1':'catContagem')}`;
 catG.innerHTML=items.length?items.map(p=>`<button class="card" data-id="${p.id}"><div class="ph${p.fotos?'':' noph'}"><img loading="lazy" decoding="async" alt="" src="${p.fotos?thumbUrl(p.fotos[0]):'assets/img/hmh-logo-placa.png'}"></div><div class="in"><b>${T(p).n}</b><small><span>${T(p).c}</span><span>${p.s>=0?pad(p.s+1)+' · '+T(SECS[p.s]).tab:areaLabel(p)}</span></small></div></button>`).join(''):`<p class="empty">${U('nenhum')}</p>`;
 catG.querySelectorAll('.card').forEach((c,k)=>{c.onclick=()=>{setCat(false);openItem(byId[c.dataset.id])};if(!RM)c.animate([{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'none'}],{duration:500,delay:Math.min(k,12)*30,easing:EASE,fill:'both'})})}
function setCat(v){if(v===cat.classList.contains('on'))return;cat.classList.toggle('on',v);scrim.classList.toggle('on',v||!!fpState);document.documentElement.style.overflow=v||fpState?'hidden':'';
 if(v){lastFocus=document.activeElement;renderCatFilters();renderCat();setTimeout(()=>catQ.focus({preventScroll:true}),250)}else if(lastFocus&&lastFocus.focus)lastFocus.focus({preventScroll:true})}
$('#catBtn').onclick=()=>setCat(true);$('#catClose').onclick=()=>setCat(false);catQ.oninput=renderCat;


/* ---------- "Como funciona" ---------- */
let tourOn=false,tourI=0,tourPlay=true,tourT=0;const tourEl=$('#tour');
function clearFoco(){ALL.forEach(p=>p.el&&p.el.classList.remove('tourfoco','hl'))}
function showStep(i){tourI=(i+TOUR.length)%TOUR.length;const st=TOUR[tourI],t=T(st);tourT=0;
 $('#tourH').textContent=t.t;const pw=splitWords($('#tourP'),t.d);wordsIn(pw,80,10);
 $('#tourDots').innerHTML=TOUR.map((_,k)=>`<i class="${k===tourI?'on':''}"></i>`).join('');$('#tourPlay').textContent=tourPlay?U('pausar'):U('continuar');
 go(st.s);clearFoco();const p=byId[st.foco];if(p&&p.el)p.el.classList.add('tourfoco','hl')}
function setTour(v){if(v===tourOn)return;tourOn=v;$('#tourBtn').setAttribute('aria-pressed',v);tourEl.classList.toggle('on',v);copy.classList.toggle('hide',v||overview);
 if(v){if(overview)setOverview(false);if(esgMode)setEsg(false);tourPlay=!RM;showStep(0)}else clearFoco()}
$('#tourBtn').onclick=()=>setTour(!tourOn);$('#tourX').onclick=()=>setTour(false);$('#tourNext').onclick=()=>{tourPlay=false;showStep(tourI+1)};$('#tourPrev').onclick=()=>{tourPlay=false;showStep(tourI-1)};
$('#tourPlay').onclick=()=>{tourPlay=!tourPlay;$('#tourPlay').textContent=tourPlay?U('pausar'):U('continuar')};

/* ---------- modo noite e idioma ---------- */
let night=store.get('hmh-night')==='1',nightK=night?1:0;
function setNight(v){night=v;store.set('hmh-night',v?'1':'0');$('#nightBtn').setAttribute('aria-pressed',v)}
$('#nightBtn').onclick=()=>setNight(!night);setNight(night);
function applyLang(){document.documentElement.lang=L==='pt'?'pt-BR':'en';
 $$('[data-i]').forEach(e=>e.textContent=U(e.dataset.i));$$('[data-i-label]').forEach(e=>{e.setAttribute('aria-label',U(e.dataset.iLabel));if(e.classList.contains('nb'))e.dataset.tip=U(e.dataset.iLabel)});$$('[data-i-ph]').forEach(e=>e.placeholder=U(e.dataset.iPh));
 for(const b of[$('#langBtn'),$('#introLang')].filter(Boolean)){(b.querySelector('.lt')||b).textContent=U('lang');b.setAttribute('aria-label',U('langNome'));b.dataset.tip=U('langNome')}
 $('#nav .nb.link').dataset.tip='hmhw.com';syncTips();updZoomUI();buildQMenu();
 $('#hintTxt').textContent=TOUCH?U('deslizar'):U('rolar');if(ready)goBtn.textContent=U('iniciar')+'  🔊';prog();
 SECS.forEach((s,i)=>{const t=T(s);s.tabEl.innerHTML=`<b>${pad(i+1)}</b> <span>${t.tab}</span>`;s.tabEl.setAttribute('aria-label',`${pad(i+1)} ${t.tab}`);s.menuEl.innerHTML=`<b>${pad(i+1)}</b>${t.t}`;s.tick.firstChild.innerHTML=`<b>${pad(i+1)}</b><span>${t.tab}</span>`;s.tick.firstChild.setAttribute('aria-label',t.t);s.ob.innerHTML=`<b>${pad(i+1)}</b>${t.tab}`});
 for(const p of ALL)if(p.el){p.el.querySelector('em').textContent=T(p).n;p.el.setAttribute('aria-label',T(p).n)}
 TAGS.forEach(g=>g.e.textContent=C.camadas[L][g.k]);renderEsg();renderIN();{const m=L==='pt'?'Mineração':'Mining';$('#minLbl').textContent=m;$('#minBtn').setAttribute('aria-label',L==='pt'?'Versão Mineração':'Mining version');$('#minBtn').dataset.tip=m;{const im=$('#introMine');if(im)im.textContent=L==='pt'?'Ver versão Mineração ⛏':'See the Mining version ⛏'}}if(cat.classList.contains('on')){renderCatFilters();renderCat()}
 {const o=L==='pt'?'Operações':'Operations';$('#opsLbl').textContent=o;$('#opsBtn').setAttribute('aria-label',o);$('#opsBtn').dataset.tip=o}if(typeof WX!=='undefined'){WX.retext();const b=$('#wxBtn');b.setAttribute('aria-label',(L==='pt'?'Clima: ':'Weather: ')+WX.label());b.dataset.tip=b.getAttribute('aria-label');b.querySelector('.lbl').textContent=WX.label();b.querySelector('.i').outerHTML=WX.icon();b.classList.toggle('alert',WX.wow)}if(SCN)SCN.retext();{const c=L==='pt'?'Cinema':'Cinema';const b=$('#cineBtn');b.setAttribute('aria-label',L==='pt'?'Modo Cinema':'Cinema mode');b.dataset.tip=b.getAttribute('aria-label');if(CIN)CIN.retext();if(typeof REM!=='undefined')REM.retext()}
 if(tourOn)showStep(tourI);if(entered&&!overview&&!tourOn)setCopy(sec,true);if(fpState&&!fpState.closing)rerenderPanel();moveInd(sec)}
function toggleLang(){L=L==="pt"?"en":"pt";store.set("hmh-lang",L);applyLang();if(typeof OP!=="undefined"&&OP.isOpen())OP.retext()}
$('#langBtn').onclick=toggleLang;$('#introLang').onclick=toggleLang;

// teclado: atalhos, Esc e foco preso nos diálogos
addEventListener('keydown',e=>{if(e.target.closest&&e.target.closest('input,textarea')&&e.key!=='Escape'&&e.key!=='Tab')return;
 if(SCN&&SCN.isOpen()&&!fpState&&!cat.classList.contains('on')){SCN.key(e);return}
 if(CIN&&CIN.active()&&!fpState){CIN.key(e);return}
 if(qEl.classList.contains('on')&&(e.key==='ArrowDown'||e.key==='ArrowUp')){e.preventDefault();const bs=[...qMenu.querySelectorAll('button')],i=bs.indexOf(document.activeElement);bs[(i+(e.key==='ArrowDown'?1:-1)+bs.length)%bs.length].focus();return}
 if(e.key==='Tab'){const box=fpState?fp:cat.classList.contains('on')?cat:null;if(!box)return;const f=[...box.querySelectorAll('button,a[href],input,iframe')].filter(x=>x.offsetParent!==null);if(!f.length)return;
  if(!box.contains(document.activeElement)){e.preventDefault();f[0].focus();return}if(e.shiftKey&&document.activeElement===f[0]){e.preventDefault();f[f.length-1].focus()}else if(!e.shiftKey&&document.activeElement===f[f.length-1]){e.preventDefault();f[0].focus()}return}
 if(fpState){if(e.key==='Escape')closePanel();if(e.key==='ArrowRight')stepPanel(1);if(e.key==='ArrowLeft')stepPanel(-1);return}
 if(e.key==='Escape'){if(qEl.classList.contains('on')){openQ(false);return}if(cat.classList.contains('on'))setCat(false);else if(tourOn)setTour(false);else if(esgSheet.classList.contains('on'))closeEsgSheet();else if(overview)setOverview(false);menu(false);return}
 if(cat.classList.contains('on'))return;
 if(!e.ctrlKey&&!e.metaKey&&!e.altKey){if(e.key==='+'||e.key==='=')zoomBy(ZSTEP);else if(e.key==='-'||e.key==='_')zoomBy(1/ZSTEP);else if(e.key==='0')setZoom(1)}
 const k=e.key.toLowerCase();if(k==='q'&&!e.ctrlKey&&!e.metaKey&&!e.altKey){const seq=['auto',0,1,2,3];setQMode(seq[(seq.indexOf(Q.mode)+1)%seq.length])}if(k==='v')setOverview(!overview);if(k==='e')setEsg(!esgMode);if(k==='c')setCat(true);if(k==='n')setNight(!night)});

/* =====================================================================
   Painel flutuante "Atlas": gatilho vira painel (mola) + vídeo + foto + ficha
   ===================================================================== */
let fpState=null;
function spring(k=240,c=21){const o=[];let x=0,v=0;const dt=1/60;for(let i=0;i<240;i++){v+=(-k*(x-1)-c*v)*dt;x+=v*dt;o.push(x);if(i>8&&Math.abs(1-x)<.0015&&Math.abs(v)<.02)break}o.push(1);return o}
const isHttp=/^https?:/.test(location.protocol);
const FACT={topdrive:makeTopDrive,roughneck:makeRoughneck,drawworks:makeDrawworks,rotary:makeRotary,mudpump:makeMudPump,crane:makeCrane,derrick:()=>makeDerrick(),tensioner:()=>makeTensioner(14),riser:()=>makeRiserJoint(16),mpd:()=>makeRiserJoint(14,{mpd:true}),
 rov:makeROV,annular:()=>makeAnnular(),ram:()=>makeRam(),h4:makeH4,pod:makePod,valve:()=>makeGateValve(),bop:()=>makeBOP({rams:4,anns:1,bonnet:pbr(0xc8452c,.25,.5,{clearcoat:.3})}),
 ebop:()=>makeBOP({rams:2,anns:1,electric:true,body:pbr(0x5c6c78,.5,.4),bonnet:pbr(0x3a4a56,.5,.45),annCol:pbr(0x5c6c78,.5,.4)}),bit:makeBit,ship:makeShip,
 block:()=>{const g=new THREE.Group();const geo=new THREE.BoxGeometry(16,8,8);const p=geo.attributes.position,uv=geo.attributes.uv,n=geo.attributes.normal;for(let i=0;i<p.count;i++){if(Math.abs(n.getY(i))<.5)uv.setXY(i,.36+(p.getX(i)+8)/16*.28+(Math.abs(n.getX(i))>.5?p.getZ(i)/40:0),(p.getY(i)+4)/8*.92+.06)}
  g.add(new THREE.Mesh(geo,[strataMat,strataMat,M.seabed,strataMat,strataMat,strataMat]));add(g,new THREE.CylinderGeometry(.35,.35,8.6,24),M.steel,[0,.3,4.05]);const b=makeBit();b.scale.setScalar(.12);b.position.set(0,-1.5,4.1);g.add(b);return g}};
let viewer=null;
function getViewer(){if(viewer)return viewer;const c=document.createElement('canvas');const r=new THREE.WebGLRenderer({canvas:c,antialias:true,alpha:true});r.setPixelRatio(Math.min(devicePixelRatio,2));r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.05;
 const s=new THREE.Scene();const pm=new THREE.PMREMGenerator(r);s.environment=pm.fromScene(new RoomEnvironment(),.04).texture;s.environmentIntensity=1.5;const k=new THREE.DirectionalLight(0xffffff,2.2);k.position.set(5,8,6);s.add(k);s.add(new THREE.HemisphereLight(0xffffff,0x303540,.7));
 const shadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;s.add(shadow);
 const cam=new THREE.PerspectiveCamera(30,16/10,.1,1000);viewer={c,r,s,cam,shadow,model:null,yaw:.7,pitch:.28,auto:true,raf:0,drag:null,t0:0};
 c.addEventListener('pointerdown',e=>{viewer.drag={x:e.clientX,y:e.clientY,yaw:viewer.yaw,pitch:viewer.pitch};viewer.auto=false;c.setPointerCapture(e.pointerId)});
 c.addEventListener('pointermove',e=>{const d=viewer.drag;if(!d)return;viewer.yaw=d.yaw-(e.clientX-d.x)*.008;viewer.pitch=clamp(d.pitch+(e.clientY-d.y)*.006,-.2,1.2)});
 const up=()=>{viewer.drag=null;setTimeout(()=>{if(!viewer.drag)viewer.auto=true},2500)};c.addEventListener('pointerup',up);c.addEventListener('pointercancel',up);return viewer}
async function showModel(key,stage){const v=getViewer();if(v.model){v.s.remove(v.model);v.model.traverse(o=>{if(o.isMesh)o.geometry.dispose()})}
 const m=(await glbFor(key))||(FACT[key]||makeBOP)();if(!stage.isConnected)return;const box=new THREE.Box3().setFromObject(m),size=box.getSize(V()),c=box.getCenter(V());const sc=10/Math.max(size.x,size.y,size.z);
 const piv=new THREE.Group();m.position.sub(c);piv.add(m);piv.scale.setScalar(sc);piv.position.y=size.y*sc/2;v.s.add(piv);v.model=piv;v.shadow.scale.set(size.x*sc*1.5,size.z*sc*1.5+4,1);
 stage.prepend(v.c);const w=stage.clientWidth,h=stage.clientHeight;v.r.setSize(w,h,false);v.cam.aspect=w/h;v.cam.updateProjectionMatrix();v.yaw=.7;v.pitch=.28;v.auto=true;v.t0=performance.now();
 cancelAnimationFrame(v.raf);const loop=now=>{if(!fpState||!v.c.isConnected)return;if(v.auto&&!RM)v.yaw+=.004;const R=17;v.cam.position.set(Math.sin(v.yaw)*Math.cos(v.pitch)*R,5+Math.sin(v.pitch)*R,Math.cos(v.yaw)*Math.cos(v.pitch)*R);v.cam.lookAt(0,4.5,0);
  const t=(now-v.t0)/1000;v.model.children[0].traverse(o=>{const u=o.userData;if(u.cones)u.cones.forEach(c=>c.rotation.y=t*3);if(u.drum)u.drum.rotation.x=t*1.5;if(u.rod)u.rod.position.y=u.base+Math.sin(t*1.2)*1.2;if(u.arm)u.arm.rotation.y=Math.sin(t*.8)*.5;if(u.tur)u.tur.rotation.y=Math.sin(t*.4)*.8});
  v.r.render(v.s,v.cam);v.raf=requestAnimationFrame(loop)};v.raf=requestAnimationFrame(loop)}
const lineOf=p=>p.esg?'ESG · '+T(p).cat:/Hydril/.test(T(p).n)?'Hydril®':/Wirth/.test(T(p).n)?'Wirth™':/^MH /.test(T(p).n)?'MH':/Vetco/.test(T(p).n)?'Vetco':p.ctx?'—':'HMH';
const listFor=p=>p.esg?ESG.filter(e=>e.s>=0||e===p):P.filter(q=>q.s===p.s);
const slugOf=p=>(p.s>=0?SECS[p.s].id:p.esg?'esg':'catalogo')+'/'+p.id;
// abas: equipamentos HMH mostram foto real (e vídeo, quando existe); só os itens de contexto, sem foto da HMH, ficam com o modelo 3D
function tabDefs(p){const t=[];if(p.esg)t.push(['stat',U('destaque')]);if(!p.esg&&p.yt)t.push(['video',U('video')]);if(p.fotos)t.push(['photo',p.fotos.length>1?U('fotos'):U('foto')]);else if(!p.esg&&p.m)t.push(['3d',U('modelo')]);else if(!p.esg&&!p.yt)t.push(['info',U('resumo')]);return t}
function panelHTML(p){const list=listFor(p),i=list.indexOf(p),W=fpState?fpState.W:0,t=T(p);
 const tag=p.esg?'<span class="tag esg">ESG Point</span>':`<span class="tag ${p.ctx?'ctx':''}">${p.ctx?U('contexto'):U(p.a==='srv'?'servico':'produto')}</span>`;
 const td=tabDefs(p),tabs=td.length>1?`<div class="tabs2" role="tablist">${td.map(([k,l])=>`<button data-t="${k}" role="tab">${l}</button>`).join('')}</div>`:'';
 const facts=p.esg?[[U('categoria'),t.cat],[U('destaque'),t.st+' '+t.sl],[U('fonte'),'hmhw.com']]:[[U('linha'),lineOf(p)],[U('categoria'),t.c],...(p.s>=0?[[U('secao'),T(SECS[p.s]).tab],[U('profundidade'),T(SECS[p.s]).prof]]:[[U('area'),areaLabel(p)]])];
 const links=p.esg?`<a class="grn" href="${BASE+p.u}" target="_blank" rel="noopener">${U('verFonte')}</a>`:`${p.u?`<a class="pri" href="${BASE+p.u}" target="_blank" rel="noopener">${U('verHmh')}</a>`:''}${p.yt?`<a href="https://www.youtube.com/watch?v=${p.yt}" target="_blank" rel="noopener">${U('abrirYt')}</a>`:(p.ctx||p.a==='srv'?'':`<a href="https://www.youtube.com/results?search_query=${encodeURIComponent('HMH '+t.n)}" target="_blank" rel="noopener">${U('buscarYt')}</a>`)}`;
 const prev=list[(i-1+list.length)%list.length],next=list[(i+1)%list.length];
 return `<div class="fp-in"${W?` style="width:${W}px"`:''}><div class="fp-h"><i class="${p.esg?'esg':p.ctx?'ctx':''}"></i><b id="fpT">${[...t.n].map(ch=>`<span class="c">${ch===' '?'&nbsp;':ch}</span>`).join('')}</b>${tag}<button class="x" aria-label="${U('fechar')}">×</button></div>
  <div class="fp-l">${tabs}<div class="stage"><span class="cap"></span></div><div class="thumbs"></div></div>
  <div class="side"><p>${t.d}</p><div class="facts">${facts.map(([a,b])=>`<div><span>${a}</span><b>${b}</b></div>`).join('')}</div><div class="links">${links}</div>${AR_IDS.has(p.id)?`<div class="arqr-box"><img src="assets/ar/qr/${p.id}.png" width="104" height="104" alt="${L==='pt'?'QR code para ver em AR':'QR code to view in AR'}"><span>${L==='pt'?'Escaneie com a câmera do celular para ver em AR, em tamanho real.':'Scan with your phone camera to view in AR at real size.'}</span></div>`:''}</div>
  ${list.length>1?`<div class="fp-n"><button data-s="-1" aria-label="${U('anterior')}">‹ <span>${T(prev).n}</span></button><span class="pg">${pad(i+1)} / ${pad(list.length)}</span><button data-s="1" aria-label="${U('proximo')}"><span>${T(next).n}</span> ›</button></div>`:''}</div>`}
function clearStage(stage){for(const s of['canvas','iframe','.play','.stat','.photo','.info'])stage.querySelector(s)?.remove();const th=fp.querySelector('.thumbs');if(th)th.innerHTML=''}
function stageVideo(stage,p){if(!isHttp){stage.insertAdjacentHTML('beforeend',`<a class="play" href="https://www.youtube.com/watch?v=${p.yt}" target="_blank" rel="noopener" style="background-image:url(https://i.ytimg.com/vi/${p.yt}/hqdefault.jpg)"><span>▶</span><div class="note">${U('arquivoLocal')}</div></a>`);return}
 stage.insertAdjacentHTML('beforeend',`<iframe src="https://www.youtube-nocookie.com/embed/${p.yt}?autoplay=1&rel=0&modestbranding=1&playsinline=1&hl=${L==='pt'?'pt-BR':'en'}&cc_lang_pref=${L}&origin=${encodeURIComponent(location.origin)}" title="${T(p).n}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`);audio.duck(true)}
function stageInfo(stage,p){stage.insertAdjacentHTML('beforeend',`<div class="info"><img src="assets/img/hmh-logo-placa.png" alt="HMH"><b>${T(p).c}</b><span>${U('semFotoNota')}</span></div>`)}
function stageStat(stage,p){stage.insertAdjacentHTML('beforeend',`<div class="stat"><b>${T(p).st}</b><span>${T(p).sl}</span></div>`);countUp(stage.querySelector('.stat b'),T(p).st)}
function stagePhoto(stage,p,k=0){const list=p.fotos;stage.querySelector('.photo')?.remove();const d=document.createElement('div');d.className='photo';d.innerHTML=`<img alt="${T(p).n}" src="${fotoUrl(list[k])}"><span class="credit">${U('credito')}</span>`;stage.appendChild(d);
 const im=d.querySelector('img');im.onload=()=>setTimeout(fitPanel,30);im.onerror=()=>{d.innerHTML=`<span class="credit">${U('fotoIndisp')}</span>`};if(!RM)im.animate([{opacity:0,transform:'scale(1.06)',filter:'blur(8px)'},{opacity:1,transform:'none',filter:'blur(0)'}],{duration:700,easing:EASE});
 const th=fp.querySelector('.thumbs');if(th){th.innerHTML=list.length>1?list.map((n,i)=>`<button class="${i===k?'on':''}" aria-label="${U('foto')} ${i+1}/${list.length}"><img alt="" src="${thumbUrl(n)}"></button>`).join(''):'';th.querySelectorAll('button').forEach((b,i)=>b.onclick=()=>stagePhoto(stage,p,i))}}
function fitPanel(){if(!fpState||fpState.closing||fpState.stepping)return;if(fp.getAnimations().some(a=>a.playState==='running')){setTimeout(fitPanel,200);return}
 const inner=fp.firstElementChild;if(!inner)return;const Tt=fpState.to,nh=Math.min(inner.scrollHeight+2,innerHeight-24);if(Math.abs(nh-Tt.h)<3)return;
 const top=clamp((innerHeight-nh)/2+10,12,innerHeight-nh-12);pinPanel(Tt);fp.style.height=nh+'px';fp.style.top=top+'px';if(!RM)fp.animate([{height:Tt.h+'px',top:Tt.t+'px'},{height:nh+'px',top:top+'px'}],{duration:380,easing:EASE});fpState.to={...Tt,t:top,h:nh}}
function setTab(tab){const st=fpState;if(!st)return;st.tab=tab;fp.querySelectorAll('.tabs2 button').forEach(b=>b.setAttribute('aria-selected',b.dataset.t===tab));const stage=fp.querySelector('.stage');if(!stage)return;clearStage(stage);audio.duck(false);
 if(tab==='video')stageVideo(stage,st.p);else if(tab==='stat')stageStat(stage,st.p);else if(tab==='photo')stagePhoto(stage,st.p,0);else if(tab==='info')stageInfo(stage,st.p);else showModel(st.p.m,stage);stage.querySelector('.cap').textContent=tab==='3d'?U('arraste'):'';setTimeout(fitPanel,60)}
function wirePanel(p,tab){const inner=fp.firstElementChild;inner.querySelector('.x').onclick=()=>closePanel();inner.querySelectorAll('.tabs2 button').forEach(b=>b.onclick=()=>setTab(b.dataset.t));inner.querySelectorAll('.fp-n button').forEach(b=>b.onclick=()=>stepPanel(+b.dataset.s));
 if(!RM)inner.querySelectorAll('.fp-h b .c').forEach((c,k)=>c.animate([{opacity:0,transform:'translateY(60%)'},{opacity:1,transform:'none'}],{duration:500,delay:120+k*14,easing:EASE,fill:'both'}));
 setTimeout(()=>{if(fpState&&fpState.p===p)setTab(tab||tabDefs(p)[0][0])},260)}
function pinPanel(Tt){fp.getAnimations().forEach(a=>a.cancel());Object.assign(fp.style,{left:Tt.l+'px',top:Tt.t+'px',width:Tt.w+'px',height:Tt.h+'px',borderRadius:'22px',opacity:'1'})}
let forcePanel=false,opItem=null;
function openPanel(p,originEl,fromPop){if(fpState)return;if(!forcePanel&&A[p.id]){if(OP.has(p.id)){if(OP.show(OP.key(p.id),{id:p.id,name:T(p).n,cat:''})){opItem=p;return}}else if(OP.hasModel(p.id)){if(OP.showModel({id:p.id,name:T(p).n,cat:T(p).c||'',desc:T(p).d||''})){opItem=p;return}}}forcePanel=false;if(cat.classList.contains('on'))setCat(false);audio.whoosh(true);const W=Math.min(900,innerWidth-24);fpState={p,W,origin:originEl};lastFocus=document.activeElement;
 fp.innerHTML=panelHTML(p);fp.style.cssText=`display:block;visibility:hidden;left:0;top:0;width:${W}px;height:auto;border-radius:22px`;fp.setAttribute('aria-labelledby','fpT');const H=Math.min(fp.offsetHeight,innerHeight-24);
 const r=originEl?originEl.getBoundingClientRect():{left:innerWidth/2-20,top:innerHeight/2-20,width:40,height:40};
 const to={l:(innerWidth-W)/2,t:clamp((innerHeight-H)/2+10,12,innerHeight-H-12),w:W,h:H},from={l:r.left,t:r.top,w:r.width,h:r.height};fpState.to=to;
 fp.style.visibility='visible';if(p.el)p.el.classList.add('gone');
 const s=spring();fp.animate(s.map(k=>({left:lerp(from.l,to.l,k)+'px',top:lerp(from.t,to.t,k)+'px',width:Math.max(24,lerp(from.w,to.w,k))+'px',height:Math.max(24,lerp(from.h,to.h,k))+'px',borderRadius:lerp(Math.min(from.h/2,24),22,k)+'px'})),{duration:RM?1:s.length*1000/60,easing:'linear',fill:'forwards'}).onfinish=()=>{if(fpState&&fpState.p===p&&!fpState.closing&&!fpState.stepping)pinPanel(fpState.to)};
 fp.firstElementChild.animate([{opacity:0,transform:'translateY(10px) scale(.985)'},{opacity:1,transform:'none'}],{duration:RM?1:520,delay:RM?0:110,easing:EASE,fill:'both'});
 scrim.classList.add('on');document.documentElement.style.overflow='hidden';wirePanel(p);setTimeout(()=>fp.querySelector('.x')?.focus({preventScroll:true}),240);
 if(!fromPop)history.pushState({panel:p.id},'','#'+slugOf(p))}
function rerenderPanel(){const p=fpState.p,tab=fpState.tab;pinPanel(fpState.to);fp.innerHTML=panelHTML(p);fp.style.height='auto';const nh=Math.min(fp.offsetHeight,innerHeight-24);fp.style.height=nh+'px';fpState.to={...fpState.to,h:nh};wirePanel(p,tab)}
function stepPanel(d){if(!fpState||fpState.closing||fpState.stepping)return;const list=listFor(fpState.p),i=list.indexOf(fpState.p),p=list[(i+d+list.length)%list.length];
 fpState.stepping=true;fp.querySelector('iframe')?.remove();audio.duck(false);if(fpState.p.el)fpState.p.el.classList.remove('gone');fpState.p=p;if(p.el)p.el.classList.add('gone');history.replaceState({panel:p.id},'','#'+slugOf(p));
 const Tt=fpState.to,old=fp.firstElementChild,swap=()=>{if(!fpState||fpState.p!==p||fpState.closing)return;
  pinPanel(Tt);fp.innerHTML=panelHTML(p);fp.style.height='auto';const nh=Math.min(fp.offsetHeight,innerHeight-24),top=clamp((innerHeight-nh)/2+10,12,innerHeight-nh-12);fp.style.height=nh+'px';fp.style.top=top+'px';
  if(!RM)fp.animate([{height:Tt.h+'px',top:Tt.t+'px'},{height:nh+'px',top:top+'px'}],{duration:420,easing:EASE});fpState.to={...Tt,t:top,h:nh};fpState.stepping=false;
  if(!RM)fp.firstElementChild.animate([{opacity:0,transform:`translateX(${d*24}px)`},{opacity:1,transform:'none'}],{duration:420,easing:EASE,fill:'both'});wirePanel(p)};
 if(RM){swap();return}old.animate([{opacity:1,transform:'none'},{opacity:0,transform:`translateX(${-d*24}px)`}],{duration:200,fill:'forwards'}).onfinish=swap}
function closePanel(fromPop){if(!fpState||fpState.closing)return;fpState.closing=true;audio.whoosh(false);audio.duck(false);const{p,to}=fpState;
 const el=p.el&&!p.el.classList.contains('off')?p.el:null,r=el?el.getBoundingClientRect():null,from=r?{l:r.left,t:r.top,w:r.width,h:r.height}:{l:to.l+to.w/2-20,t:to.t+to.h/2-20,w:40,h:40};
 fp.querySelector('iframe')?.remove();fp.firstElementChild.animate([{opacity:1},{opacity:0}],{duration:160,fill:'forwards'});
 const s=spring(320,30);pinPanel(to);const a=fp.animate(s.map(k=>({left:lerp(to.l,from.l,k)+'px',top:lerp(to.t,from.t,k)+'px',width:Math.max(24,lerp(to.w,from.w,k))+'px',height:Math.max(24,lerp(to.h,from.h,k))+'px',borderRadius:lerp(22,20,k)+'px',opacity:r?1:1-k})),{duration:RM?1:s.length*1000/60,easing:'linear',fill:'forwards'});
 if(!cat.classList.contains('on'))scrim.classList.remove('on');
 a.onfinish=()=>{fp.getAnimations().forEach(x=>x.cancel());fp.style.display='none';fp.innerHTML='';ALL.forEach(q=>q.el&&q.el.classList.remove('gone'));document.documentElement.style.overflow='';fpState=null;(el||lastFocus)?.focus?.({preventScroll:true})};
 if(!fromPop&&history.state&&history.state.panel)history.back()}
scrim.onclick=()=>{if(cat.classList.contains('on'))setCat(false);else closePanel()};
addEventListener('popstate',()=>{const h=parseHash();if(h.cine){CIN.start();return}if(CIN.active())CIN.stop(true);if(h.scn){SCN.open(h.scn);return}if(SCN.isOpen())SCN.close();if(fpState&&!fpState.closing&&!h.item)closePanel(true);else if(!fpState&&h.item)openItem(h.item,true)});
function parseHash(){const h=decodeURIComponent(location.hash.slice(1));if(!h)return{};const[a,b]=h.split('/');if(a==='cenario')return{si:-1,scn:b};if(a==='cinema')return{si:-1,cine:1};const si=SECS.findIndex(s=>s.id===a);return{si,item:byId[b]||(si<0?byId[a]:null)||null}}
addEventListener('resize',()=>{if(fpState&&!fpState.closing){const W=Math.min(900,innerWidth-24);fpState.W=W;pinPanel(fpState.to);fp.firstElementChild.style.width=W+'px';fp.style.width=W+'px';fp.style.height='auto';const H=Math.min(fp.offsetHeight,innerHeight-24);const Tt={l:(innerWidth-W)/2,t:clamp((innerHeight-H)/2,12,innerHeight-H-12),w:W,h:H};pinPanel(Tt);fpState.to=Tt}});

/* =====================================================================
   Loop
   ===================================================================== */
const composer=new EffectComposer(renderer);
// os dois alvos do composer guardam a profundidade (a cena é desenhada num ou no outro, conforme a paridade das trocas); o AO lê dela
for(const rt of[composer.renderTarget1,composer.renderTarget2])rt.depthTexture=new THREE.DepthTexture(rt.width,rt.height);
composer.addPass(new RenderPass(scene,camera));const ssao=new SSAOPass(camera,innerWidth,innerHeight);composer.addPass(ssao);const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.35,.5,.9);composer.addPass(bloom);composer.addPass(new OutputPass());
// antisserrilhado: FXAA nos níveis leves (barato, depois do tonemapping) e MSAA 4x no máximo (melhor para linhas finas como o mastro)
// MSAA em buffer de ponto flutuante gerava pixels inválidos nas cenas submarinas (o bloom espalhava em retângulos pretos); por isso o suavizado é feito depois do tonemapping:
// SMAA do nível Média em diante (melhor em linhas finas), FXAA no nível Baixa. O nível Ultra ainda renderiza em 4K (supersampling em telas Full HD).
const fxaa=new ShaderPass(FXAAShader);composer.addPass(fxaa);const smaa=new SMAAPass(innerWidth,innerHeight);composer.addPass(smaa);
const syncAA=l=>{const pr=dprFor(l);fxaa.material.uniforms.resolution.value.set(1/(innerWidth*pr),1/(innerHeight*pr));fxaa.enabled=l===0;smaa.enabled=l>=1;const ms=0;for(const rt of[composer.renderTarget1,composer.renderTarget2])if(rt.samples!==ms){rt.samples=ms;rt.dispose()}};
function resize(){const w=innerWidth,h=innerHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);composer.setSize(w,h);syncAA(Q.level);moveInd(sec)}
addEventListener('resize',resize);resize();setQuality(Q.level);
const hud={d:$('#hDepth'),p:$('#hPres'),t:$('#hTemp'),z:$('#hZone')},mFill=$('#mFill'),mMark=$('#mMark'),ct=$('#ct');let lastZone='',hintDone=false,lastSec=-1,frameN=0;
const nfs={pt:new Intl.NumberFormat('pt-BR'),en:new Intl.NumberFormat('en-US')},fmt=n=>nfs[L].format(Math.round(n));
const setTxt=(el,v)=>{if(el._v!==v){el._v=v;el.textContent=v}};
const depthOf=y=>y>=0?0:y>SEABED?-y/-SEABED*1500:Math.min(5000,1500+(SEABED-y)/(GH*.75)*3000);
// cada grupo grande só aparece na faixa de altura em que pode estar na tela (grupos com luzes: só as malhas, para não recompilar shaders)
const cullTargets=o=>{let l=false;o.traverse(x=>{if(x.isLight)l=true});if(!l)return[o];const a=[];o.traverse(x=>{if(x!==o&&(x.isMesh||x.isPoints))a.push(x)});return a};
const CULL=[[ship,-34,95],...tens.map(T=>[T.t,-52,0]),[ring,-32,-20],[mpd,-47,-23],[bop,SEABED-4,SEABED+50],[eb,SEABED-4,SEABED+42],[k20,SEABED-4,SEABED+42],[rovs[0],-120,-84],[rovs[1],SEABED-8,SEABED+30],[rovs[2],SEABED-8,SEABED+30],...fishSchools.map(F=>[F.im,F.S.y[0]-20,F.S.y[1]+20]),[bub.p,SEABED,SEABED+72],...rays.map(r=>[r,-140,2])].map(([o,a,b])=>({t:cullTargets(o),a,b,v:true}));
/* =====================================================================
   Inovação: dados ao vivo (simulados), fluxo da lama e cenário de kick
   ===================================================================== */
const XT={pt:{mud:'Fluxo da lama',kick:'Cenário: kick',
  mudDn:'Desce pela coluna',mudUp:'Volta pelo anular',mudH:'Bombas → coluna → broca → anular → sistema de lama',kTitle:'Cenário: kick no poço',again:'Repetir',close:'Fechar',ks:'Dentro do BOP',v3d:'Corte 3D',v2d:'Esquema',drag:'Arraste para girar o corte',lb:['Anular · Hydril GK','Gaveta de tubo · Sentry RAM','Cisalhante · WBSR-X','Linha do choke','Gás (kick)'],play:'Reproduzir vídeo',min:'Minimizar',expand:'Expandir',inside:['Gás da formação entra no poço e sobe pelo anular, entre a coluna e o revestimento.','O anular empurra um elemento de borracha, movido por pistão hidráulico, contra a coluna e veda o espaço anular.','Dois blocos de aço com vedação avançam das laterais, fecham sobre o tubo e travam mecanicamente.','Com o poço fechado, o fluxo para: lê-se a pressão na coluna (SIDPP) e no anular (SICP).','A lama mais pesada é bombeada pela coluna e o gás sai por uma linha do choke, com a gaveta ainda fechada.','Gavetas e anular reabrem; o poço está estável.'],
  steps:['Kick detectado: ganho no tanque e aumento da vazão de retorno','Parar as bombas e fechar o anular (Hydril GK)','Fechar a gaveta de tubo (Hydril Sentry RAM)','Poço fechado: ler as pressões SIDPP e SICP','Circular o kick para fora e controlar o poço','Poço sob controle'],
  note:['Gás entra no poço e sobe pelo anular.','O anular veda ao redor da coluna.','A gaveta fecha sobre o tubo e prende o kick abaixo.','As pressões estabilizam; a equipe calcula o peso da lama.','A lama mais pesada empurra o gás até o choke.','Segurança restabelecida; a perfuração pode retomar.']},
 en:{mud:'Mud flow',kick:'Scenario: kick',
  mudDn:'Down the string',mudUp:'Up the annulus',mudH:'Pumps → string → bit → annulus → mud system',kTitle:'Scenario: well kick',again:'Replay',close:'Close',ks:'Inside the BOP',v3d:'3D cutaway',v2d:'Diagram',drag:'Drag to rotate the cutaway',lb:['Annular · Hydril GK','Pipe ram · Sentry RAM','Shear ram · WBSR-X','Choke line','Gas (kick)'],play:'Play video',min:'Minimise',expand:'Expand',inside:['Formation gas enters the well and rises up the annulus, between the string and the casing.','The annular pushes a rubber element, driven by a hydraulic piston, against the pipe and seals the annular space.','Two steel blocks with seals advance from the sides, close on the pipe and lock mechanically.','With the well shut in, flow stops: the crew reads drill pipe pressure (SIDPP) and casing pressure (SICP).','Heavier mud is pumped down the string and the gas leaves through a choke line while the ram stays closed.','Rams and annular reopen; the well is stable.'],
  steps:['Kick detected: pit gain and higher return flow','Stop the pumps and close the annular (Hydril GK)','Close the pipe ram (Hydril Sentry RAM)','Well shut in: read SIDPP and SICP','Circulate the kick out and kill the well','Well under control'],
  note:['Gas enters the well and rises up the annulus.','The annular seals around the pipe.','The ram closes on the pipe and traps the kick below.','Pressures stabilise; the crew works out the kill mud weight.','Heavier mud pushes the gas out through the choke.','Safe again; drilling can resume.']}};
const XU=k=>XT[L][k];
const XK={on:false,t:0,ph:0,ann:0,ram:0,p:0,pump:1,gas:0,done:false};
const xe=x=>x<=0?0:x>=1?1:x*x*(3-2*x),kk=()=>XK.on&&!XK.done;
let kickGlow=0;
const nf=(v,d)=>v.toLocaleString(L==='pt'?'pt-BR':'en',{minimumFractionDigits:d,maximumFractionDigits:d});
// fluxo da lama: liga as partículas que já existem no "Como funciona"
// cenário de kick: sobreposições "raio-X" no BOP + gás subindo pelo anular
const xm=(c)=>new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:0,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending,fog:false});
const xAnn=new THREE.Mesh(new THREE.TorusGeometry(1,.3,12,48),xm(0xff5a3c)),xRam=[-1,1].map(()=>new THREE.Mesh(new THREE.BoxGeometry(3.6,1.5,2.4),xm(0xff9a2e)));
xAnn.rotation.x=Math.PI/2;xAnn.position.set(0,SEABED+BU.annYs[0]-1.5,0);xAnn.renderOrder=11;xAnn.visible=false;
const yR=SEABED+BU.ramYs[1];xRam.forEach(m=>{m.position.y=yR;m.renderOrder=11;m.visible=false});scene.add(xAnn,...xRam);
const gas=pts(150,2,0xff4a3a,{opacity:0,blending:THREE.AdditiveBlending,depthTest:false,fog:false});gas.p.renderOrder=10;
const gS=[...Array(150)].map(()=>[Math.random(),Math.random()*6.28,Math.random()]);
function kickStart(){if(tourOn)setTour(false);if(overview)setOverview(false);Object.assign(XK,{on:true,t:0,ph:0,ann:0,ram:0,p:0,pump:1,gas:0,done:false});$('#kickBtn').setAttribute('aria-pressed',true);$('#kick').hidden=false;$('#kick').classList.remove('min');document.body.classList.add('kicking');ksOpen(false);opItem=byId.h4;OP.show('bopstack',{id:'h4',name:XU('ks'),cat:L==='pt'?'Cenário de kick':'Kick scenario'});copy.classList.add('hide');
 if(sec!==3)go(3);kickRender()}
function kickStop(){XK.on=false;XK.done=false;XK.pump=1;XK.ann=XK.ram=XK.p=XK.gas=0;$('#kickBtn').setAttribute('aria-pressed',false);$('#kick').hidden=true;document.body.classList.remove('kicking');ks.hidden=true;if(opItem&&opItem.id==='h4')OP.close();xAnn.visible=false;xRam.forEach(m=>m.visible=false);gas.p.material.opacity=0;kickGlow=0;
 if(entered&&!overview&&!tourOn)copy.classList.remove('hide')}
function kickRender(){const i=XK.done?5:XK.ph;$('#kTitle').textContent=XU('kTitle');$('#kStep').textContent=XU('steps')[i];$('#kNote').textContent=XU('note')[i];
 $('#kDots').innerHTML=XU('steps').map((s,k)=>`<i class="${k<i?'ok':k===i?'on':''}"></i>`).join('');$('#kick').classList.toggle('safe',i===5);$('#kAgain').textContent=XU('again');$('#kClose').setAttribute('aria-label',XU('close'));ksRender()}
function kickStep(dt,t,bitY){if(!XK.on)return;XK.t+=dt;const T=XK.t;
 const ph=T<3?0:T<6?1:T<9?2:T<13?3:T<18?4:5;if(ph!==XK.ph){XK.ph=ph;kickRender()}if(T>=18&&!XK.done){XK.done=true;kickRender()}
 XK.ann=T<3?0:T<5?xe((T-3)/2):T<14?1:1-xe((T-14)/3);XK.ram=T<6?0:T<8?xe((T-6)/2):T<15?1:1-xe((T-15)/3);
 XK.p=T<2?xe(T/2)*.45:T<6?.45+xe((T-2)/4)*.35:T<13?.8+xe((T-6)/7)*.2:Math.max(0,1-xe((T-13)/5));
 XK.pump=T<3?1:T<4?1-xe(T-3):T<14?0:xe((T-14)/3);XK.gas=T<1?T:T<16?1:Math.max(0,1-(T-16)/2);
 kickGlow=(XK.ann>.02||XK.ram>.02)&&T<14?(.35+.25*Math.sin(t*6))*Math.max(XK.ann,XK.ram):0;
 // anular: anel que aperta a coluna
 xAnn.visible=XK.ann>.01;const r=lerp(3.1,1.5,XK.ann);xAnn.scale.set(r,r,r);xAnn.material.opacity=.85*XK.ann;
 // gaveta: dois blocos entram no furo
 xRam.forEach((m,i)=>{m.visible=XK.ram>.01;m.position.x=(i?1:-1)*lerp(8.6,1.9,XK.ram);m.material.opacity=.8*XK.ram});
 // gás: coluna que sobe pelo anular e fica presa sob a gaveta
 gas.p.material.opacity=.95*XK.gas;const top=lerp(SEABED+BU.top+36,SEABED+BU.ramYs[1]-3,XK.ram),rise=T<3?lerp(SEABED-55,SEABED+BU.top+36,xe(T/3)):top,len=T<3?70:62;
 for(let i=0;i<150;i++){const g=gS[i],u=(g[0]+t*(XK.ram>.9?.05:.2))%1,y=Math.min(rise,top+(XK.ram>.9?0:30))-u*len;gas.a[i*3]=1.3+Math.cos(g[1])*(.35+g[2]*.55);gas.a[i*3+1]=y;gas.a[i*3+2]=.4+Math.sin(g[1])*(.35+g[2]*.55)}gas.g.attributes.position.needsUpdate=true;ksUpdate(t);kcFrame(t)}
// painel lateral do cenário de kick: corte do BOP animado + operações internas + vídeos oficiais da HMH
const KV=[{id:'DZ8fkK0ZY1A',pt:'Anular GK',en:'GK annular'},{id:'cvjERw0n1D4',pt:'Gaveta Sentry RAM',en:'Sentry RAM'},{id:'TTbdtZv8JHU',pt:'Cisalhante WBSR-X',en:'WBSR-X shear ram'}];
const ks=$('#kside'),KS={a1:$('#kA1'),a2:$('#kA2'),r1:$('#kR1'),r2:$('#kR2'),ch:$('#kCh'),p:$('#kP')};let ksV=0,ksPlay=false,ksClosed=false;
const ksG=[...Array(12)].map((_,i)=>{const c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.setAttribute('r',2.5+(i%3));c.setAttribute('fill','#ff6b5a');$('#kGas').appendChild(c);return{c,s:Math.random(),side:i%2?1:-1,o:Math.random()*20}});
function ksOpen(v){ksClosed=!v;ks.hidden=!v;if(v){ks.classList.remove('min');ksPlay=false;ksV=0;if(!KC&&kcTab==='3d')kcBuild();ksRender()}}
function ksVideo(){const f=$('#ksFrame'),v=KV[ksV];f.innerHTML=ksPlay?`<iframe src="https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0&modestbranding=1&hl=${L==='pt'?'pt-BR':'en'}" title="${v[L]}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe>`:`<button class="ksp" aria-label="${XU('play')}: ${v[L]}" style="background-image:url('https://i.ytimg.com/vi/${v.id}/hqdefault.jpg')"><i>▶</i></button>`;
 const b=f.querySelector('.ksp');if(b)b.onclick=()=>{ksPlay=true;ksVideo()};
 $('#ksChips').innerHTML=KV.map((x,i)=>`<button aria-pressed="${i===ksV}" data-i="${i}">${x[L]}</button>`).join('');$('#ksChips').querySelectorAll('button').forEach(b=>b.onclick=()=>{ksV=+b.dataset.i;ksPlay=false;ksVideo()})}
function ksRender(){if(ks.hidden)return;$('#kcT3').textContent=XU('v3d');$('#kcT2').textContent=XU('v2d');$('#kcH').textContent=XU('drag');XU('lb').forEach((x,i)=>$('#kcl'+i).textContent=x);const i=XK.done?5:XK.ph;$('#ksT').textContent=XU('ks');$('#ksDesc').textContent=XU('inside')[i];
 $('#ksList').innerHTML=XU('steps').slice(0,5).map((s,k)=>`<li class="${k<i?'ok':k===i?'on':''}">${s}</li>`).join('');
 if(!ksPlay){if(XK.ph===1&&ksV!==0){ksV=0}else if(XK.ph===2&&ksV!==1){ksV=1}}ksVideo()}
function ksUpdate(t){if(ks.hidden||ks.classList.contains('min'))return;const l=(a,b,k)=>a+(b-a)*k;
 KS.a1.setAttribute('x',l(96,128,XK.ann));KS.a2.setAttribute('x',l(202,170,XK.ann));KS.r1.setAttribute('x',l(86,118,XK.ram));KS.r2.setAttribute('x',l(202,170,XK.ram));
 const top=XK.ram>.9?178:XK.ann>.9?106:36;for(const g of ksG){const u=(g.s+t*.14)%1,y=284-u*(284-top);g.c.setAttribute('cy',y.toFixed(1));g.c.setAttribute('cx',(160+g.side*(27+g.o*.4)).toFixed(1));g.c.setAttribute('opacity',(XK.gas*(y>top+3?1:0)).toFixed(2))}
 KS.ch.setAttribute('opacity',XK.ph===4&&!XK.done?1:0);KS.ch.setAttribute('stroke-dashoffset',(-t*30%12).toFixed(1));KS.p.textContent=nf(520+190*XK.p,0)+' bar'}
// cartões que podem ser minimizados (–) para não tapar a cena
document.querySelectorAll('.mcard .mn').forEach(b=>b.onclick=()=>{const c=b.closest('.mcard'),m=c.classList.toggle('min');b.textContent=m?'+':'–';b.setAttribute('aria-label',m?XU('expand'):XU('min'))});
$('#ksX').onclick=()=>{ks.hidden=true;ksClosed=true};
// ---------------------------------------------------------------- corte 3D do BOP (renderer próprio dentro do painel): anular, gavetas, tubo, gás e linha do choke
let KC=null,kcTab='3d',kcAz=.32,kcEl=.16,kcDrag=null,kcLastAnn=-1;
function kcBuild(){
 const cv=$('#kcCanvas'),r=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true});r.setPixelRatio(Math.min(devicePixelRatio||1,2));r.localClippingEnabled=true;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.1;r.outputColorSpace=THREE.SRGBColorSpace;
 const sc=new THREE.Scene(),pm=new THREE.PMREMGenerator(r);sc.environment=pm.fromScene(new RoomEnvironment(),.04).texture;pm.dispose();
 const cam=new THREE.PerspectiveCamera(32,1,.1,100);sc.add(new THREE.HemisphereLight(0xcfe8ff,0x1b2a38,.6));const dl=new THREE.DirectionalLight(0xffffff,2.4);dl.position.set(5,9,10);sc.add(dl);
 const clip=new THREE.Plane(new THREE.Vector3(0,0,-1),0);// corta tudo que está do lado da câmera (z>0): a face cortada fica visível
 const fm=(c,rg,m)=>new THREE.MeshStandardMaterial({color:c,roughness:rg,metalness:m,clippingPlanes:[clip]}),cm=c=>new THREE.MeshBasicMaterial({color:c,side:THREE.BackSide,clippingPlanes:[clip]});
 const MT={steel:fm(0x1f6aa0,.38,.55),red:fm(0xc42630,.4,.4),pipe:fm(0xb9c7d2,.3,.8),rub:fm(0xd8602d,.7,0),grey:fm(0x7b8a97,.45,.7),yel:fm(0xf0b020,.5,.3),dark:fm(0x2a2f35,.6,.4),wh:fm(0xe8eef2,.5,.2)};
 const CP={steel:cm(0x4aa0e0),red:cm(0xf06060),pipe:cm(0xeaf0f4),rub:cm(0xff9a62),grey:cm(0xbcc8d2),yel:cm(0xffd060),dark:cm(0x5a6068),wh:cm(0xffffff)};
 const root=new THREE.Group();root.position.y=-5.2;sc.add(root);
 const add=(geo,k,x=0,y=0,z=0,par=root)=>{const g=new THREE.Group();g.position.set(x,y,z);const a=new THREE.Mesh(geo,MT[k]),b=new THREE.Mesh(geo,CP[k]);g.add(a,b);g.userData.m=[a,b];par.add(g);return g};
 const LA=(p,s=64)=>new THREE.LatheGeometry(p.map(q=>new THREE.Vector2(q[0],q[1])),s),RG=(ro,ri,y0,y1,s=64)=>LA([[ro,y0],[ro,y1],[ri,y1],[ri,y0],[ro,y0]],s);
 const alongX=g=>{g.rotateZ(-Math.PI/2);return g};
 const plate=(w,d,hr,h)=>{const s=new THREE.Shape();s.moveTo(-w/2,-d/2);s.lineTo(w/2,-d/2);s.lineTo(w/2,d/2);s.lineTo(-w/2,d/2);s.closePath();const hl=new THREE.Path();hl.absarc(0,0,hr,0,Math.PI*2,true);s.holes.push(hl);const g=new THREE.ExtrudeGeometry(s,{depth:h,bevelEnabled:false,curveSegments:40});g.rotateX(-Math.PI/2);return g};
 const BX=(w,h,d)=>new THREE.BoxGeometry(w,h,d),CY=(rd,h,s=32)=>new THREE.CylinderGeometry(rd,rd,h,s);
 // ---- tubo de perfuração + junta
 add(CY(.45,12.6),'pipe',0,5.0,0);add(CY(.64,1.1),'pipe',0,9.1,0);add(CY(.5,.3),'grey',0,8.35,0);add(CY(.5,.3),'grey',0,9.85,0);
 const band=add(CY(.47,.22),'yel',0,7,0);
 // ---- BOP: cisalhante (0), carretel com saída do choke, gaveta de tubo, carretel, anular
 const Y_SH=0,Y_PR=2.6,Y_AN=5.2,rams=[];
 const ramUnit=(y0,kind)=>{
  add(plate(5.6,3.4,1.0,.35),'steel',0,y0,0);add(plate(5.6,3.4,1.0,.35),'steel',0,y0+1.45,0);
  add(BX(5.6,1.1,.3),'steel',0,y0+.9,-1.55);add(BX(5.6,1.1,.3),'steel',0,y0+.9,1.55);
  for(const s of[-1,1]){add(alongX(RG(.95,.58,-.65,.65,40)),'steel',s*3.45,y0+.9,0);add(alongX(RG(1.12,.4,-.12,.12,40)),'red',s*4.2,y0+.9,0);add(alongX(CY(.72,1.2,36)),'red',s*4.95,y0+.9,0);add(alongX(CY(.8,.18,36)),'dark',s*5.65,y0+.9,0);
   for(let i=0;i<8;i++){const a=i/8*Math.PI*2;add(alongX(CY(.07,.34,8)),'grey',s*4.2,y0+.9+Math.sin(a)*.98,Math.cos(a)*.98)}}
  const U=[];for(const s of[-1,1]){const bg=new THREE.ExtrudeGeometry((()=>{const sh=new THREE.Shape();sh.moveTo(-.8,-1);sh.lineTo(.8,-1);if(kind==='pipe'){sh.lineTo(.8,-.5);sh.absarc(.8,0,.5,-Math.PI/2,Math.PI/2,true);sh.lineTo(.8,1)}else{sh.lineTo(.8,-.3);sh.lineTo(.25,0);sh.lineTo(.8,.3);sh.lineTo(.8,1)}sh.lineTo(-.8,1);sh.closePath();return sh})(),{depth:.95,bevelEnabled:true,bevelSize:.04,bevelThickness:.04,bevelSegments:2,curveSegments:24});bg.rotateX(-Math.PI/2);
   const blk=add(bg,kind==='pipe'?'wh':'grey',s*2.5,y0+.45,0);blk.scale.x=-s;const rod=add(alongX(CY(.2,1,16)),'pipe',s*3.3,y0+.9,0);U.push({blk,rod,s})}
  rams.push({u:U,kind});return U};
 const shU=ramUnit(Y_SH,'shear'),prU=ramUnit(Y_PR,'pipe');
 // carretéis (flanges) e parafusos
 for(const y of[1.8,4.4]){add(RG(1.75,1.0,y,y+.8),'steel');add(RG(2.15,1.0,y,y+.2),'steel');add(RG(2.15,1.0,y+.6,y+.8),'steel')}
 // saída do choke com válvula de gaveta
 const ch=add(alongX(RG(.42,.3,-.1,5.2,24)),'dark',1.4,2.2,0);for(const x of[1.9,3.1])add(alongX(RG(.72,.3,-.12,.12,32)),'steel',x+.2,2.2,0);
 add(BX(1.1,1.5,1.0),'red',4.5,2.2,0);add(CY(.28,1.2,16),'grey',4.5,3.4,0);add(new THREE.TorusGeometry(.55,.07,10,28),'yel',4.5,4.05,0).rotation.x=Math.PI/2;
 // ---- anular (Hydril GK): corpo, pistão, elemento de borracha e cabeçote
 add(RG(2.6,1.0,Y_AN,Y_AN+.45),'steel');add(RG(2.6,1.85,Y_AN+.45,Y_AN+3.4),'steel');add(RG(2.6,1.0,Y_AN+3.4,Y_AN+3.9),'steel');add(RG(1.5,1.0,Y_AN+3.9,Y_AN+4.7),'steel');add(RG(2.3,1.0,Y_AN+4.7,Y_AN+5.0),'red');
 add(LA([[2.6,Y_AN+3.4],[2.2,Y_AN+3.9],[1.5,Y_AN+3.9],[1.5,Y_AN+3.4],[2.6,Y_AN+3.4]]),'steel');
 const pist=add(RG(2.45,1.88,Y_AN+.45,Y_AN+1.0),'grey');
 const eGeo=f=>{const rin=lerp(1.0,.47,f),y0=Y_AN+1.1+.3*f,y1=Y_AN+3.15;return LA([[1.75,y0],[1.75,y1],[rin+.2,y1],[rin,y1-.3],[rin,y0+.3],[rin+.2,y0],[1.75,y0]],64)};
 const el=add(eGeo(0),'rub');
 // parafusos (instâncias)
 const bolts=[[2.35,Y_AN+.45],[2.35,Y_AN+3.4],[1.95,1.95],[1.95,2.45],[1.95,4.55],[1.95,5.05],[1.9,Y_AN+4.7]],bg2=CY(.1,.3,8),bi=new THREE.InstancedMesh(bg2,MT.grey,bolts.length*16),bm=new THREE.Matrix4();let bc=0;
 for(const[rb,y]of bolts)for(let i=0;i<16;i++){const a=i/16*Math.PI*2;bm.makeTranslation(Math.cos(a)*rb,y+.2,Math.sin(a)*rb);bi.setMatrixAt(bc++,bm)}root.add(bi);
 // linhas hidráulicas e pods atrás da pilha
 for(const s of[-1,1]){add(BX(1.3,2.2,1.1),'yel',s*3.6,4.2,-2.9);add(BX(1.2,.2,1.0),'dark',s*3.6,5.4,-2.9);
  for(const[x0,y0]of[[s*4.95,Y_PR+.9],[s*4.95,Y_SH+.9]]){const c=new THREE.CatmullRomCurve3([V(x0,y0+.4,-.2),V(s*5.3,y0+1.6,-1.4),V(s*4.2,3.8,-2.6),V(s*3.9,4.2,-2.8)]);add(new THREE.TubeGeometry(c,24,.06,8),'dark')}}
 // ---- gás (kick) e fluxo no choke
 const NG=90,gm=new THREE.InstancedMesh(new THREE.SphereGeometry(.075,10,8),new THREE.MeshBasicMaterial({color:0xff5a4a,clippingPlanes:[clip]}),NG),gd=[...Array(NG)].map(()=>({a:Math.random()*Math.PI,r:.52+Math.random()*.38,p:Math.random(),s:.5+Math.random()*.6}));root.add(gm);
 const NF=26,fmesh=new THREE.InstancedMesh(new THREE.SphereGeometry(.09,8,6),new THREE.MeshBasicMaterial({color:0xffb347,clippingPlanes:[clip]}),NF);fmesh.position.set(0,2.2,0);root.add(fmesh);
 // ---- rótulos projetados (HTML sobre o canvas)
 const lab=[...$('#kc').querySelectorAll('.kcl')],anc=[V(2.6,Y_AN+2.2,0),V(3.0,Y_PR+1.7,0),V(3.0,Y_SH+1.5,0),V(5.2,2.7,0),V(.7,Y_AN-1.2,0)];
 KC={r,sc,cam,pist,el,eGeo,rams:[shU,prU],gm,gd,fmesh,band,lab,anc,root,w:0,h:0,dm:new THREE.Object3D()};
 const kc=$('#kc');kc.addEventListener('pointerdown',e=>{kcDrag={x:e.clientX,y:e.clientY,id:e.pointerId};kc.setPointerCapture(e.pointerId);kc.classList.add('drag')});
 kc.addEventListener('pointermove',e=>{if(!kcDrag||e.pointerId!==kcDrag.id)return;kcAz=clamp(kcAz-(e.clientX-kcDrag.x)*.006,-1.15,1.15);kcEl=clamp(kcEl+(e.clientY-kcDrag.y)*.004,-.12,.75);kcDrag.x=e.clientX;kcDrag.y=e.clientY});
 const up=e=>{if(kcDrag&&e.pointerId===kcDrag.id){kcDrag=null;kc.classList.remove('drag')}};kc.addEventListener('pointerup',up);kc.addEventListener('pointercancel',up);
}
function kcFrame(t){if(!KC||ks.hidden||ks.classList.contains('min')||kcTab!=='3d')return;const K=KC,kc=$('#kc'),w=kc.clientWidth,h=kc.clientHeight;if(!w||!h)return;
 if(K.w!==w||K.h!==h){K.w=w;K.h=h;K.r.setSize(w,h,false);K.cam.aspect=w/h;K.cam.updateProjectionMatrix()}
 // anular fecha: elemento de borracha empurrado pelo pistão
 if(Math.abs(XK.ann-kcLastAnn)>.004){kcLastAnn=XK.ann;for(const m of K.el.userData.m){m.geometry.dispose();m.geometry=K.eGeo(XK.ann)}K.pist.position.y=.3*XK.ann}
 // gavetas de tubo (as de cisalhamento ficam abertas, de reserva)
 for(const u of K.rams[1]){const f=XK.ram,x=lerp(2.5,.8,f);u.blk.position.x=u.s*x;const ox=u.blk.position.x-u.s*.8,L=Math.abs(u.s*4.1-ox);u.rod.position.x=(u.s*4.1+ox)/2;u.rod.scale.x=L}
 for(const u of K.rams[0]){const x=2.5;u.blk.position.x=u.s*x;const ox=u.blk.position.x-u.s*.8,L=Math.abs(u.s*4.1-ox);u.rod.position.x=(u.s*4.1+ox)/2;u.rod.scale.x=L}
 // gás sobe pelo anular até onde o preventor fechado permite
 const top=XK.ram>.9?2.45:XK.ann>.9?5.9:11.4;K.gm.visible=XK.gas>.02;
 if(K.gm.visible){for(let i=0;i<K.gd.length;i++){const g=K.gd[i],y=-1.3+(((g.p+t*.09*g.s)%1)*(top+1.3));K.dm.position.set(Math.cos(g.a)*g.r,y,-Math.sin(g.a)*g.r);K.dm.scale.setScalar(.7+.5*Math.sin(t*3+i)*.3+.4);K.dm.updateMatrix();K.gm.setMatrixAt(i,K.dm.matrix)}K.gm.instanceMatrix.needsUpdate=true}
 const circ=XK.ph===4&&!XK.done;K.fmesh.visible=circ;if(circ){for(let i=0;i<26;i++){K.dm.position.set(1.2+(((i/26)+t*.35)%1)*5.0,0,0);K.dm.scale.setScalar(1);K.dm.updateMatrix();K.fmesh.setMatrixAt(i,K.dm.matrix)}K.fmesh.instanceMatrix.needsUpdate=true}
 K.band.position.y=kk()?7:11.4-((t*.45)%12.4);
 // câmera orbitando em torno da pilha; gira devagar quando ninguém arrasta
 const az=kcAz+(kcDrag?0:Math.sin(t*.18)*.22),d=23,cp=Math.cos(kcEl);K.cam.position.set(.9+Math.sin(az)*cp*d,.2+Math.sin(kcEl)*d,Math.cos(az)*cp*d);K.cam.lookAt(.9,.2,0);
 K.r.render(K.sc,K.cam);
 const it=K.lab.map((l,i)=>{const p=K.anc[i].clone();K.root.localToWorld(p);p.project(K.cam);return{l,i,y:(-p.y*.5+.5)*h}}),col=it.filter(o=>o.i!==4).sort((a,b)=>a.y-b.y);let ly=-1e9;for(const o of col){o.y=Math.max(o.y,ly+27);ly=o.y}
 const over=ly-(h-18);if(over>0)for(const o of col)o.y-=over;
 for(const o of it){const g=o.i===4;o.l.style.left=g?'10px':'auto';o.l.style.right=g?'auto':'10px';o.l.style.transform=`translateY(${(o.y-12).toFixed(0)}px)`;o.l.style.opacity=(g&&XK.gas<.05)?0:1}}
function kcSetTab(v){kcTab=v;$('#kc').hidden=v!=='3d';$('#ksSvg').hidden=v!=='2d';document.querySelectorAll('.kct button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===v));if(v==='3d'&&!KC)kcBuild()}
document.querySelectorAll('.kct button').forEach(b=>b.onclick=()=>kcSetTab(b.dataset.v));
function innov(t,dt,cy,bitY,now){
 kickStep(dt,t,bitY);
 if(XK.on){flowDown.p.material.opacity*=XK.pump;flowUp.p.material.opacity*=XK.pump}
 }
function renderIN(){const m=XT[L];for(const[id,k]of[['kick','kick']]){$('#'+id+'Lbl').textContent=m[k];const b=$('#'+id+'Btn');b.setAttribute('aria-label',m[k]);b.dataset.tip=m[k]}
 if(XK.on||!$('#kick').hidden)kickRender()}

$('#kickBtn').onclick=()=>XK.on||!$('#kick').hidden?kickStop():kickStart();$('#kClose').onclick=kickStop;$('#kAgain').onclick=kickStart;

const BOPM='assets/modelos/bop_hmh.glb',RISM='assets/modelos/riser_hmh.glb',REAL={gxp:'assets/modelos/annular.glb',gk:'assets/modelos/annular.glb',rams:'assets/modelos/bop_ram.glb',sentry:'assets/modelos/bop_ram.glb',wbsr:'assets/modelos/wbsr.glb',h4:BOPM,ebop:'assets/modelos/ebop.glb',pods:'assets/modelos/pods.glb',valves:'assets/modelos/valves.glb',riser:'assets/modelos/riser_qtr.glb',telescopic:'assets/modelos/telescopic.glb',
 topdrive:'assets/modelos/topdrive.glb',mudpumps:'assets/modelos/bomba_lama.glb',rotary:'assets/modelos/rotary.glb',diverter:'assets/modelos/diversor.glb',
 roughneck:'assets/modelos/roughneck.glb',drawworks:'assets/modelos/drawworks.glb',cranes:'assets/modelos/cranes.glb',structures:'assets/modelos/derrick.glb',motion:()=>makeTensioner(),tens:()=>makeTensioner(),mpd:()=>makeRiserJoint(14,{mpd:true})};
const HMHV={topdrive:'ge_YGQHCYDU',gxp:'DZ8fkK0ZY1A',gk:'DZ8fkK0ZY1A',sentry:'cvjERw0n1D4',rams:'cvjERw0n1D4',wbsr:'TTbdtZv8JHU'};
/* ---------- clima (clima.js): mar, vento, chuva, neblina, raios e limites operacionais ---------- */
const WX=createClima({scene,lang:()=>L,audio,reduced:RM,onChange:w=>{if(CIN)CIN.weather();const b=$('#wxBtn');if(b){b.setAttribute('aria-pressed',w.isOpen());b.querySelector('.i').outerHTML=w.icon();b.classList.toggle('alert',w.preset==='tempestade'||w.wow);b.querySelector('.lbl').textContent=w.label()}SCN&&SCN.weather()}});
// biruta no heliponto: mostra direção e força do vento
const sock=(()=>{const g=new THREE.Group();g.position.set(57.5,23.2,9.5);ship.add(g);add(g,G.cyl(.07,.07,3.4,8),M.white,[0,1.7,0]);const piv=new THREE.Group();piv.position.y=3.3;g.add(piv);
 const cg=new THREE.CylinderGeometry(.42,.18,2.4,16,4,true);cg.rotateZ(Math.PI/2);cg.translate(1.2,0,0);const cc=cg.attributes.position,col=new Float32Array(cc.count*3);for(let i=0;i<cc.count;i++){const band=Math.floor(cc.getX(i)/.48)%2;col.set(band?[.95,.95,.95]:[1,.33,.08],i*3)}cg.setAttribute('color',new THREE.BufferAttribute(col,3));
 const m=new THREE.Mesh(cg,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8,side:THREE.DoubleSide}));piv.add(m);return piv})();
// fumaça das chaminés: partículas calculadas na placa de vídeo (idade, subida, deriva pelo vento e crescimento por fórmula); a CPU só informa a posição das chaminés
const smoke=(()=>{const N=80,E=[V(-74,18.2,-3),V(-74,18.2,3)],pos=new Float32Array(N*2*3),sd=new Float32Array(N*2*2);
 for(let i=0;i<N*2;i++){sd[i*2]=Math.random();sd[i*2+1]=i<N?0:1}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('aS',new THREE.BufferAttribute(sd,2));
 const U={uT:{value:0},uE0:{value:V()},uE1:{value:V()},uW:{value:V(3,0,.6)},uS:{value:180},uMap:{value:dotTex},uDark:{value:0}};
 const m=new THREE.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,fog:false,
  vertexShader:`attribute vec2 aS;uniform float uT,uS;uniform vec3 uE0,uE1,uW;varying float vA;
   void main(){float age=fract(aS.x+uT*.11);vec3 e=aS.y<.5?uE0:uE1;float r=fract(sin(aS.x*91.7)*437.1);
    vec3 p=e+vec3(0.,1.,0.)*(age*9.+sin(age*6.+r*6.)*.6)+uW*age*age*5.+vec3(sin(r*40.+uT*.7),0.,cos(r*33.+uT*.6))*age*2.;
    vA=smoothstep(0.,.08,age)*(1.-age);vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=uS*(1.+age*4.)/-mv.z;gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`uniform sampler2D uMap;uniform float uDark;varying float vA;void main(){float a=texture2D(uMap,gl_PointCoord).a*vA*.26;gl_FragColor=vec4(vec3(mix(.6,.3,uDark)),a);}`});
 const pts=new THREE.Points(g,m);pts.frustumCulled=false;pts.renderOrder=4;scene.add(pts);const w=V();
 return t=>{U.uT.value=t;ship.localToWorld(U.uE0.value.copy(E[0]));ship.localToWorld(U.uE1.value.copy(E[1]));const k=WX.s.vento*.5144;U.uW.value.set(k*.9,0,k*.25);U.uS.value=innerHeight*2.4;U.uDark.value=nightK*.6+WX.s.cloud*.3}})();
// luzes de navegação (bombordo vermelha, boreste verde, mastro e popa brancas): materiais acima de 1 para o bloom fazer o brilho
{const lm=c=>new THREE.MeshBasicMaterial({color:new THREE.Color(c).multiplyScalar(3.2),toneMapped:false});
 for(const[x,y,z,c]of[[51,22.9,-11.6,0xff2a2a],[51,22.9,11.6,0x2aff5a],[46,31.2,0,0xffffff],[-81,12.4,0,0xffffff],[0,82.2,0,0xff3030]])add(ship,G.sph(.28,10),lm(c),[x,y,z])}
function windsock(t){const v=clamp(WX.s.vento/25);sock.rotation.set(0,-.35+Math.sin(t*1.7)*.12*v,-lerp(1.25,.06,v)+Math.sin(t*9)*.04*v)}
let SCN=null,CIN=null;
const OP=createOp({photos:id=>{const p=byId[id];return p&&p.fotos?p.fotos.map(fotoUrl):[]},real:id=>{const r=REAL[id];return typeof r==='function'?r():r||null},video:id=>{const p=byId[id];const v=HMHV[id]||(p&&p.yt)||(REAL[id]===BOPM?'DZ8fkK0ZY1A':null);return v?[v]:[]},lang:()=>L,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,anchor:()=>{const o=opItem&&A[opItem.id];if(!o)return null;const v=new THREE.Vector3();o.getWorldPosition(v);return toScreen(v)},sheet:()=>{if(!opItem)return;const p=opItem;OP.close();forcePanel=true;openPanel(p,null)}});
/* ---------- cenários internos (cenarios.js): a cena principal fica pausada enquanto um cenário está aberto ---------- */
SCN=createCenarios({renderer,env:()=>scene.environment,lang:()=>L,WX,reduced:RM,night:()=>nightK,nome:id=>byId[id]?T(byId[id]).n:id,
 sheet:id=>{const p=byId[id];if(p){forcePanel=true;openPanel(p,null)}},kick:()=>kickStart(),
 onOpen:()=>{if(OP.isOpen())OP.close();if(tourOn)setTour(false);if(overview)setOverview(false);if(XK.on||!$('#kick').hidden)kickStop();if(esgSheet.classList.contains('on'))closeEsgSheet();menu(false);audio.duck&&audio.duck(false)},
 onClose:()=>{renderer.shadowMap.needsUpdate=true;last=performance.now()/1000;$('#opsBtn')?.focus({preventScroll:true});if(entered)history.replaceState(null,'','#'+SECS[sec].id)}});
/* ---------- Modo Cinema (cinema.js): planos com câmera animada, transições e acabamento de imagem ---------- */
CIN=createCinema({camera,renderer,lang:()=>L,WX,setNight,getNight:()=>night,key,SEABED,reduced:RM,touch:TOUCH,remote:()=>REM.open(),
 onStart:()=>{if(OP.isOpen())OP.close();if(tourOn)setTour(false);if(overview)setOverview(false);if(XK.on||!$('#kick').hidden)kickStop();if(esgSheet.classList.contains('on'))closeEsgSheet();menu(false);
  oceanFront.visible=oceanFarFront.visible=skyDome.visible=true;sky.visible=false;ribbon.visible=false;document.documentElement.style.overflow='hidden';$('#cineBtn')?.setAttribute('aria-pressed',true)},
 onEnd:silent=>{oceanFront.visible=oceanFarFront.visible=skyDome.visible=false;sky.visible=true;ribbon.visible=true;document.documentElement.style.overflow='';$('#cineBtn')?.setAttribute('aria-pressed',false);renderer.shadowMap.needsUpdate=true;if(entered)history.replaceState(null,'','#'+SECS[sec].id);if(!silent)$('#cineBtn')?.focus({preventScroll:true})},
 openScenario:id=>SCN.open(id)});
composer.addPass(CIN.pass);
// câmera virtual pelo celular (remoto.js + controle.html, PeerJS)
const REM=createRemoto({lang:()=>L,onInput:(d,reply)=>CIN.input(d,reply)});
$('#cineBtn').onclick=()=>CIN.active()?CIN.stop():CIN.start();
$('#opsBtn').onclick=e=>SCN.menu(e.currentTarget);$('#wxBtn').onclick=()=>WX.toggle();
let last=performance.now()/1000;
const cRam=new THREE.Color(),glassDay=0,cOcean=new THREE.Color(0x0b3c52),cOceanN=new THREE.Color(0x02101a),cOceanS=new THREE.Color(0x24363d),STORMC=new THREE.Color().setRGB(.42,.46,.5);
const PH={td:0,dw:0,rn:0,kc:0};
let shKey='';
// quadros sob demanda: sem interação por 10 s (e fora do tour, do kick e dos cenários), a cena anima a 30 qps em vez de 60
let lastAct=performance.now();for(const ev of['pointermove','pointerdown','wheel','keydown','touchstart','scroll'])addEventListener(ev,()=>{lastAct=performance.now()},{passive:true,capture:true});
let idleSkip=false;
function frame(nowMs){requestAnimationFrame(frame);
 const idle=nowMs-lastAct>10000&&!tourOn&&!XK.on&&!(SCN&&SCN.isOpen())&&!(CIN&&CIN.active());idleSkip=idle&&!idleSkip;if(idleSkip)return;
 if(STATS)renderer.info.reset();const t=nowMs/1000,dt=Math.min(.05,t-last),rawDt=t-last;last=t;frameN++;OP.frame(dt,nowMs);
 if(SCN&&SCN.isOpen()){WX.frame(dt,t,{surf:1});nightK+=((night?1:0)-nightK)*(1-Math.exp(-dt*2.2));SCN.frame(dt,nowMs,!!fpState||cat.classList.contains('on'));return}
 if(CIN&&CIN.active()){const o=CIN.update(dt,t);skyDome.position.copy(camera.position);cur.cy=o.cy;cur.h=o.h;camT.copy(o.tgt);const half=180;Object.assign(key.shadow.camera,{left:-half,right:half,top:half,bottom:-half});key.shadow.camera.updateProjectionMatrix();key.target.position.copy(camT);key.position.copy(camT).add(SUN)}else placeCamera(dt);const cy=cur.cy;
 {const vh=cur.h*.5+34;for(const c of CULL){const v=cy+vh>c.a&&cy-vh<c.b;if(c.v!==v){c.v=v;for(const o of c.t)o.visible=v}}}
 const ns=clamp(Math.round(fScroll),0,SECS.length-1);if(ns!==sec)sec=ns;
 settled=!overview&&Math.abs(fScroll-Math.round(fScroll))<.06&&Math.abs(cur.cy-FR[sec])<4;
 // qualidade adaptativa (só mede com a aba visível e a cena em uso)
 if(entered&&!document.hidden&&rawDt<.25&&!fpState&&nowMs-lastAct<=10000){Q.frames++;Q.acc+=rawDt;if(Q.acc>2.5){const fps=Q.frames/Q.acc;Q.frames=0;Q.acc=0;Q.fps=fps;if(fps<52&&DRS.k>.75&&!Q.lock){DRS.k=Math.round((DRS.k-.1)*10)/10;setQuality(Q.level)}else if(fps>=58&&DRS.k<1&&!Q.lock){DRS.k=Math.min(1,Math.round((DRS.k+.1)*10)/10);setQuality(Q.level)}else if(fps<38&&Q.level>0&&!Q.lock){Q.good=0;DRS.k=1;setQuality(Q.level-1)}else if(fps>=57&&Q.level===2&&!Q.lock&&!Q.tried3&&!TOUCH&&++Q.good>=2){Q.tried3=true;setQuality(3)}else if(fps<57)Q.good=0}}
 // equipamentos em movimento
 const heave=wave(0,0,t)*.45;ship.position.y=heave;ship.rotation.z=(wave(40,0,t)-wave(-40,0,t))/80*.25;ship.rotation.x=(wave(0,14,t-.4)-wave(0,-14,t-.4))/28*.35;foam.position.y=heave*.6+.3;foamTex.offset.set(t*.004,t*.01);
 // clima: com o tempo acima dos limites a perfuração para (top drive desce e fica parado), o drawworks para e os guindastes vão para o descanso
 PH.td+=dt*.3*WX.k.drill;PH.dw+=dt*1.2*WX.k.drill;PH.rn+=dt*.5*WX.k.pipe;PH.kc+=dt*.25*WX.k.crane;
 const tdy=lerp(22,lerp(19,56,.5-.5*Math.cos(PH.td)),WX.k.drill);SU.td.position.set(0,tdy,0);SU.wires.forEach((w,i)=>{const a=V(i<2?-.6:.6,64,i%2?-.6:.6),b=V(a.x,tdy+7.2,a.z);w.position.copy(a).lerp(b,.5);w.scale.set(1,a.y-b.y,1)});
 SU.dpipe.position.set(0,(17.9+tdy-.3)/2,0);SU.dpipe.scale.set(1,Math.max(.1,tdy-.3-17.9),1);
 SU.dw.userData.drum.rotation.x=PH.dw;SU.rn.userData.arm.rotation.y=Math.sin(PH.rn)*.5*WX.k.pipe;SU.kc.forEach((c,i)=>c.userData.tur.rotation.y=Math.sin(PH.kc+i*2)*.6*WX.k.crane);SU.pc.forEach((c,i)=>c.t.rotation.y=c.a+Math.sin(PH.kc*.5+i)*.35*WX.k.crane);
 WX.frame(dt,t,{camT,viewH:cur.h,asp:innerWidth/innerHeight,above:cy>-30||overview,night:nightK,surf:1-audio.u});windsock(t);smoke(t);
 ship.updateMatrixWorld();
 for(const Tn of tens){const a=ship.localToWorld(Tn.hull.clone()),b=Tn.ring.clone().add(ring.position);Tn.t.position.copy(a);Tn.t.quaternion.setFromUnitVectors(UP,b.clone().sub(a).normalize());Tn.t.userData.rod.position.y=Tn.t.userData.base+(a.distanceTo(b)-Tn.t.userData.closed)}
 ring.position.x=bend(-26,t);updRiser(t);
 rovs[0].position.set(11+Math.cos(t*.15)*3,-100+Math.sin(t*.22)*5,9);rovs[0].lookAt(0,-104,0);
 rovs[1].position.set(19+Math.sin(t*.2)*2,SEABED+5+Math.sin(t*.4)*.8,13);rovs[1].lookAt(0,SEABED+10,0);
 rovs[2].position.set(-20+Math.sin(t*.18)*2,SEABED+6+Math.cos(t*.3),11);rovs[2].lookAt(0,SEABED+12,0);
 BU.leds.forEach((l,i)=>l.visible=Math.sin(t*3+i*1.6)>0);
 uTime.value=t;if(camera.position.y>-6||overview)updRibbon(t);if(oceanMat.normalMap)oceanMat.normalMap.offset.set(t*.004,t*.006);
 for(const m of bigNums)m.material.opacity=(CIN&&CIN.active()?0:1)*m.userData.base*(overview?1:clamp(1.25-Math.abs(cur.cy-m.userData.y)/48));
 const bgOn=(sec>=1&&!overview)?1:0;   // cenário de fundo (peixes, raios, bolhas) só nas seções de profundidade: na superfície o foco é a sonda
 rays.forEach(m=>m.material.opacity=(.05+.035*Math.sin(t*.5+m.userData.ph))*(1-nightK*.8)*bgOn);fishSchools.forEach(F=>F.im.count=bgOn?F.S.n:0);bub.g.setDrawRange(0,bgOn?140:0);
 if(snow.visible&&(cy>SEABED-60||overview)){for(let i=0;i<NS;i++){const s=snowS[i];let y=s[1]-t*(.3+s[3]*.6);const H=-SEABED-4;y=SEABED+(((y-SEABED)%H)+H)%H;snowA[i*3]=s[0]+Math.sin(t*.2+i)*.5;snowA[i*3+1]=y;snowA[i*3+2]=s[2]}snowG.attributes.position.needsUpdate=true}
 if(cy<-20||overview)updFish(t);
 if(jelly.group.visible&&(cy<-20||overview))jelly.update(t);
 for(let i=0;i<140;i++){const b=bubS[i];b.y+=b.s*dt;if(b.y>60)b.y=0;bub.a[i*3]=b.x+Math.sin(t*2+i)*.3;bub.a[i*3+1]=SEABED+BU.top-2+b.y;bub.a[i*3+2]=b.z}bub.g.attributes.position.needsUpdate=true;
 // perfuração acompanha a rolagem entre as seções 5 e 6
 const drill=overview?1:smooth((fScroll-3.6)/1.3),bitY=lerp(BIT0,BIT1,drill);bit.position.set(0,bitY,0);bit.rotation.y=t*3;bit.userData.cones.forEach(c=>c.rotation.y=t*6);
 openHole.position.y=(SEABED-82+bitY+3)/2;openHole.scale.y=Math.max(.1,(SEABED-82)-(bitY+3));dstring.position.y=(SEABED+bitY+4.5)/2;dstring.scale.y=SEABED-bitY-4.5;M.pipe.map.offset.x=-t*.6;
 bitRing.position.set(0,bitY+2.3,1.6);
 {const c=LENS,dir=V(c.x,c.y-(bitY+2.3),0).normalize(),pp=V(-dir.y,dir.x,0),p=beamGeo.attributes.position;p.setXYZ(0,0,bitY+2.3,1.8);const a=c.clone().addScaledVector(pp,LR*.96).addScaledVector(dir,-LR*.25),b=c.clone().addScaledVector(pp,-LR*.96).addScaledVector(dir,-LR*.25);p.setXYZ(1,a.x,a.y,a.z);p.setXYZ(2,b.x,b.y,b.z);p.needsUpdate=true;beamGeo.computeBoundingSphere()}
 const lensOn=(cy<SEABED-30&&cy>SEABED-105)||overview;lens.visible=lensBeam.visible=bitRing.visible=lensOn;
 if(lensOn&&frameN%2===0){lensBit.rotation.y=t*2.5;lensBit.userData.cones.forEach(c=>c.rotation.y=t*5);for(let i=0;i<120;i++){const c=chipS[i];c.l=(c.l+dt*2*c.s*.5)%1;chipA[i*3]=Math.cos(c.a+t)*(2.6+c.l*.8);chipA[i*3+1]=.5+c.l*9;chipA[i*3+2]=Math.abs(Math.sin(c.a+t))*2+.5}chipG.attributes.position.needsUpdate=true;renderer.setRenderTarget(lensRT);renderer.render(lensScene,lensCam);renderer.setRenderTarget(null)}
 const flow=overview?0:smooth((drill-.92)/.08);oil.p.material.opacity=flow*.9;if(flow>0){for(let i=0;i<220;i++){const o=oilS[i];o.y=(o.y+dt*o.s*.07)%1;oil.a[i*3]=o.x;oil.a[i*3+1]=lerp(bitY,SEABED,o.y);oil.a[i*3+2]=1}oil.g.attributes.position.needsUpdate=true}
 // "Como funciona": fluxo, foco e gavetas do BOP em destaque
 const tk=(tourOn||XK.on)?1:0;flowDown.k=(flowDown.k||0)+(tk-(flowDown.k||0))*(1-Math.exp(-dt*3));updFlow(t,dt,bitY,flowDown.k);
 const bopOn=(tourOn&&TOUR[tourI].bop?(.5+.5*Math.sin(t*5))*.7:0)+kickGlow;M.ramBody.emissive.setRGB(bopOn,bopOn*.12,bopOn*.08);M.ramBon.emissive.setRGB(bopOn,bopOn*.1,bopOn*.06);
 if(tourOn&&tourPlay&&settled&&!fpState){tourT+=dt;if(tourT>8)showStep(tourI+1)}
 // modo noite
 nightK+=((night?1:0)-nightK)*(1-Math.exp(-dt*2.2));uNight.value=nightK;
 const wc=WX.s.cloud,wf=WXU.flash.value;scene.fog.color.copy(HAZE).lerp(STORMC,Math.max(wc*.85,WX.s.nevoa*.8)).lerp(HAZE_N,nightK);scene.fog.near=WX.s.fogk;key.intensity=2.6*(1-nightK*.85)*(1-wc*.72);hemi.intensity=.5*(1-nightK*.6)*(1-wc*.25)+wf*2.2;rim.intensity=.7*(1-nightK*.5)*(1-wc*.5);scene.environmentIntensity=lerp(.62,.16,nightK)*(1-wc*.4)+wf*.5;
 M.glass.emissiveIntensity=nightK*.9;M.windows.emissiveIntensity=nightK*1.15;M.lampN.color.setRGB(lerp(.54,1,nightK),lerp(.56,.9,nightK),lerp(.58,.7,nightK));flood.forEach(s=>s.intensity=nightK*900);
 oceanMat.color.copy(cOcean).lerp(cOceanS,wc*.8).lerp(cOceanN,nightK);oceanMat.roughness=lerp(.12,.3,wc);if(oceanMat.normalMap)oceanMat.normalScale.setScalar(lerp(.55,1.1,clamp(SEA.chop)));foam.material.opacity=lerp(.55,.85,clamp(SEA.chop));uSea.value.set(SEA.amp,SEA.chop);oceanMat.envMapIntensity=oceanFar.envMapIntensity=1-nightK*.75;
 bloom.threshold=lerp(.9,.72,nightK);bloom.strength=lerp(lerp(.3,.5,smooth(-cy/150)),.75,nightK);
 // som, navbar adaptativa, HUD e medidor
 const u=smooth((-1-cy)/8),gnd=smooth((SEABED-10-cy)/24);audio.mix(u,gnd,gnd*(1-flow*.5));audio.update(dt);
 nav.classList.toggle('dark',!overview&&(cy<-8||nightK>.5));
 const depth=depthOf(cy);setTxt(hud.d,fmt(depth)+' m');setTxt(hud.p,fmt(1+depth/10)+' bar');setTxt(hud.t,Math.round(cy>=0?27:cy>SEABED?lerp(27,4,smooth(-cy/150)):lerp(4,95,clamp((SEABED-cy)/(GH*.75))))+' °C');
 const zone=overview?U('visaoZona'):T(SECS[sec]).zona;if(zone!==lastZone){hud.z.textContent=zone;lastZone=zone}
 const pr=fScroll/(SECS.length-1);mFill.style.height=(pr*100).toFixed(2)+'%';mMark.style.top=(pr*100).toFixed(2)+'%';
 if(!hintDone&&fScroll>.4){hintDone=true;$('#hint').classList.add('off')}
 // texto, navegação e link da seção
 if(!overview&&entered&&!tourOn)setCopy(sec);
 if(sec!==lastSec){lastSec=sec;SECS.forEach((s,i)=>{const on=i===sec;s.tabEl.classList.toggle('on',on);s.menuEl.classList.toggle('on',on);s.tick.classList.toggle('on',on);for(const b of[s.tabEl,s.menuEl,s.tick.firstChild])on?b.setAttribute('aria-current','step'):b.removeAttribute('aria-current')});moveInd(sec);
  ct.textContent=`${pad(sec+1)} / ${pad(SECS.length)}`;$('#bUp').disabled=sec===0;$('#bDn').disabled=sec===SECS.length-1}
 if(entered&&settled&&!fpState&&location.hash.slice(1)!==SECS[sec].id&&!history.state?.panel)history.replaceState(null,'','#'+SECS[sec].id);
 innov(t,Math.min(.5,rawDt),cy,bitY,nowMs);
 updHots();
 if(overview)SECS.forEach((s,i)=>{const sc=toScreen(V(-HALFW-4,FR[i]-(i===0?-10:0),FRONT));s.ob.style.left=Math.max(12,sc.x-200)+'px';s.ob.style.top=(sc.y-21)+'px'});
 TAGS.forEach(g=>{const sc=toScreen(g.p);const on=!overview&&settled&&(g.big?sec===5:sec>=4)&&sc.on;g.e.style.opacity=on?1:0;g.e.style.transform=`translate3d(${sc.x.toFixed(0)}px,${sc.y.toFixed(0)}px,0) translate(-50%,-50%)`});
 // com painel ou catálogo aberto a cena fica atrás do desfoque: renderiza 1 a cada 3 quadros
 if((fpState||cat.classList.contains('on')||OP.isOpen())&&frameN%3)return;
 if(ssao.enabled)ssao.band.set(camera.position.distanceTo(camT)-50,camera.position.distanceTo(camT)+170);
 {const kp=camT.x.toFixed(1)+'|'+camT.y.toFixed(1)+'|'+camT.z.toFixed(1)+'|'+cur.h;if(kp!==shKey||frameN%10===0){shKey=kp;renderer.shadowMap.needsUpdate=true}}
 composer.render(dt);
 if(STATS&&frameN%120===0)console.log('[stats] sec',sec,'draw calls',renderer.info.render.calls,'triangles',renderer.info.render.triangles,'geometries',renderer.info.memory.geometries,'textures',renderer.info.memory.textures)}

/* =====================================================================
   Entrada
   ===================================================================== */
const introT=$('#introT');{const tx=introT.textContent;introT.innerHTML=[...tx].map(ch=>`<span>${ch===' '?'&nbsp;':ch}</span>`).join('');if(!RM)[...introT.children].forEach((s,k)=>s.animate([{transform:'translateY(110%)',opacity:0},{transform:'none',opacity:1}],{duration:900,delay:150+k*45,easing:EASE,fill:'both'}))}
if(TOUCH)$('#hintIco').className='finger';
const goBtn=$('#goBtn');let ready=false;
$$('#snaps .estatico').forEach(e=>e.inert=true);cChips.addEventListener('scroll',chipsMore,{passive:true});
applyLang();window.__ready=true;mark('montado');
if(/[?&]debug/.test(location.search))window.__dbg={get CIN(){return CIN},renderer,scene,camera,Q,DRS,frameCount:()=>frameN,setQuality,go,ssao,detLevel,setZoom,fxaa,smaa,composer,bloom,DET2,DET3,jelly,sb};
(async()=>{
 await Promise.race([Promise.all([loadTextures(),loadGeology()]),new Promise(r=>setTimeout(r,15000))]);
 mark('texturas');
 // compila os shaders em paralelo (KHR_parallel_shader_compile) enquanto a abertura segue animada, em vez de travar o primeiro quadro
 nTotal++;progT.textContent=U('preparando');
 // os programas dependem do alvo de render (tela x composer x lente: tonemapping e espaço de cor mudam), então compila para os alvos reais
 try{renderer.setRenderTarget(composer.readBuffer);await renderer.compileAsync(scene,camera);renderer.setRenderTarget(lensRT);await renderer.compileAsync(lensScene,lensCam)}catch(e){}
 renderer.setRenderTarget(null);
 try{composer.render(0)}catch(e){}   // aquece bloom, AO e saída enquanto a abertura ainda cobre a tela
 mark('compilado');nDone++;prog();
 requestAnimationFrame(frame);loadDetail();
 ready=true;goBtn.removeAttribute('data-i');goBtn.disabled=false;goBtn.textContent=U('iniciar')+'  🔊';
 if(!RM)goBtn.animate([{transform:'scale(.9)',opacity:0},{transform:'none',opacity:1}],{duration:600,easing:'cubic-bezier(.34,1.4,.64,1)'})
})();
function enter(withSound){if(withSound)audio.start();$('#intro').classList.add('out');setTimeout(()=>$('#intro')?.remove(),1200);
 const h=parseHash();if(h.si>=0){go(h.si,true);cur.cy=FR[h.si]}
 setTimeout(()=>(window.requestIdleCallback||setTimeout)(loadHD,{timeout:9000}),4000);
 setTimeout(()=>{nav.classList.add('in');if(!tourOn)copy.classList.remove('hide');entered=true;setCopy(sec,true);$('#hint').classList.toggle('off',hintDone);if(h.item)setTimeout(()=>openItem(h.item,true),700);if(h.scn)setTimeout(()=>SCN.open(h.scn),500);if(h.cine)setTimeout(()=>CIN.start(),500)},350)}
goBtn.onclick=()=>enter(true);$('#muteBtn').onclick=()=>enter(false);

// refinamentos de UI: dicas nos botões só de ícone e painel de texto recolhível
{const syncT=()=>document.querySelectorAll('.nb[aria-label]').forEach(b=>{b.title=b.getAttribute('aria-label')});syncT();new MutationObserver(syncT).observe(nav,{subtree:true,attributes:true,attributeFilter:['aria-label']});
 const cb=document.createElement('button');cb.className='cpMin';cb.type='button';cb.textContent='–';cb.setAttribute('aria-label',L==='pt'?'Recolher painel':'Collapse panel');cb.title=cb.getAttribute('aria-label');
 cb.onclick=()=>{const m=copy.classList.toggle('min');cb.textContent=m?'+':'–';const l=m?(L==='pt'?'Expandir painel':'Expand panel'):(L==='pt'?'Recolher painel':'Collapse panel');cb.setAttribute('aria-label',l);cb.title=l;cb.setAttribute('aria-expanded',!m);hotRects=null};copy.appendChild(cb)}
if(STATS)window.__hmh={renderer,scene,go:n=>go(n),CULL,get sec(){return sec}};
