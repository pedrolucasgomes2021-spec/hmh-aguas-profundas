import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {SEABED,GBOT,GH,FRONT,BACK,HALFW,SLOT,clamp,lerp,smooth,V,UP,rnd,wave,TEXS,ctex,dotTex,rayTex,shadowTex,foamTex,M,PAINTED,G,add,bake,instancify,pbr} from './kit.js';
import {makeShip,makeBOP,makeTensioner,makeRiserJoint,makeROV,makeBit,makeTopDrive,makeRoughneck,makeDrawworks,makeRotary,makeMudPump,makeCrane,makeDerrick,makeAnnular,makeRam,makeH4,makePod,makeGateValve,fishGeometry,fishMat,fishTime} from './modelos.js';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches,TOUCH=matchMedia('(hover: none)').matches;
const BASE='https://hmhw.com',EASE='cubic-bezier(.2,.8,.2,1)',f1=n=>n.toFixed(1),pad=n=>String(n).padStart(2,'0');
const store={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}}};

/* =====================================================================
   Conteúdo (content/conteudo.json, PT e EN)
   ===================================================================== */
const C=await (await fetch('content/conteudo.json')).json();
const SECS=C.secoes,P=C.produtos,ESG=C.esg.map(e=>Object.assign(e,{esg:1})),TOUR=C.tour,ALL=[...P,...ESG];
const byId=Object.fromEntries(ALL.map(p=>[p.id,p]));
let L=store.get('hmh-lang')==='en'?'en':'pt';
const T=o=>o[L]||o.pt,U=k=>C.ui[L][k]??C.ui.pt[k];
const fotoUrl=n=>'assets/fotos/'+n.replace(/\.\w+$/,'')+'.webp';
let MODELS={};try{const r=await fetch('assets/models/modelos.json');if(r.ok)MODELS=await r.json()}catch(e){}

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
 float haze=(1.0-uw)*(1.0-exp(-vFogDepth*0.00012));
 gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,clamp(haze,0.0,0.97));
#endif`;

/* =====================================================================
   Renderizador, qualidade adaptativa, luz e sombras
   ===================================================================== */
const canvas=$('#gl');let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'})}catch(e){window.__fail(U('noWebgl'));throw e}
const Q={level:TOUCH?1:2,frames:0,acc:0,lastCheck:0};
const dprFor=l=>Math.min(devicePixelRatio,[1,1.35,1.75][l]);
renderer.setPixelRatio(dprFor(Q.level));renderer.setSize(innerWidth,innerHeight);
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.localClippingEnabled=true;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const ANISO=renderer.capabilities.getMaxAnisotropy();TEXS.forEach(t=>t.anisotropy=ANISO);
const scene=new THREE.Scene();scene.fog=new THREE.Fog(0xffffff,1,2);const HAZE=new THREE.Color().setRGB(.74,.82,.89),HAZE_N=new THREE.Color().setRGB(.03,.05,.09);scene.fog.color.copy(HAZE);
const pmrem=new THREE.PMREMGenerator(renderer);
const studio=pmrem.fromScene(new RoomEnvironment(),.04).texture;scene.environment=studio;scene.environmentIntensity=.62;
const camera=new THREE.PerspectiveCamera(22,innerWidth/innerHeight,10,30000);scene.add(camera);
const SUN=V(330,520,560).normalize().multiplyScalar(700);
const key=new THREE.DirectionalLight(0xfff0dc,2.6);key.castShadow=true;const SM=TOUCH?1024:2048;key.shadow.mapSize.set(SM,SM);
Object.assign(key.shadow.camera,{left:-85,right:85,top:85,bottom:-85,near:100,far:1500});key.shadow.bias=-.0004;key.shadow.normalBias=.5;scene.add(key,key.target);
const rim=new THREE.DirectionalLight(0xbfe3ff,.7);rim.position.set(-400,250,-300);scene.add(rim);
const hemi=new THREE.HemisphereLight(0xe2efff,0x2b3138,.5);scene.add(hemi);
function setQuality(l){Q.level=l;renderer.setPixelRatio(dprFor(l));renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);key.castShadow=l>0;bloom.enabled=l>0;
 fishSchools.forEach(F=>F.im.count=l>0?F.S.n:Math.ceil(F.S.n/2));snow.visible=l>0}

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
const sky=new THREE.Mesh(new THREE.PlaneGeometry(140000,60000),new THREE.ShaderMaterial({depthWrite:false,fog:false,vertexShader:worldVS,uniforms:{n:uNight},
 fragmentShader:`varying vec3 w;uniform float n;void main(){vec3 c;float y=w.y;
  if(y>0.){float k=clamp(y/5200.,0.,1.);c=mix(vec3(.74,.82,.89),vec3(.20,.42,.70),pow(k,.5));
   vec2 sp=vec2(16000.,3600.);float s=length(w.xy-sp);c+=vec3(1.,.9,.72)*exp(-s/2600.)*.28;
   float nn=sin(w.x*.00055+sin(w.y*.002)*2.)*sin(w.y*.0016+w.x*.0002)+.5*sin(w.x*.0013+w.y*.003);c=mix(c,vec3(.93,.95,.97),smoothstep(.7,1.4,nn)*.45*smoothstep(500.,2600.,y)*(1.-smoothstep(5000.,9000.,y)));
   vec3 cn=mix(vec3(.03,.05,.09),vec3(.0,.008,.03),pow(k,.4));vec2 g=floor(w.xy/38.);float st=step(.9975,fract(sin(dot(g,vec2(12.9898,78.233)))*43758.5453))*smoothstep(150.,900.,y);cn+=st*.9;
   c=mix(c,cn,n);}
  else{float k=clamp(-y/700.,0.,1.);c=mix(vec3(.05,.14,.2),vec3(.015,.03,.05),k)*(1.-n*.6);}
  gl_FragColor=vec4(c,1.);}`}));sky.position.z=-20000;scene.add(sky);
const oceanMat=new THREE.MeshPhysicalMaterial({color:0x0b3c52,roughness:.12,metalness:0,envMapIntensity:1,clearcoat:.5,clearcoatRoughness:.06});
oceanMat.onBeforeCompile=s=>{s.uniforms.uTime=uTime;s.vertexShader='uniform float uTime;\nfloat wv(vec2 p){return .5*sin(p.x*.045+uTime*.8)+.35*sin(p.y*.06+uTime*1.05+1.3)+.18*sin((p.x+p.y)*.11+uTime*1.6);}\n'+s.vertexShader
 .replace('#include <beginnormal_vertex>','vec2 pp=position.xz;float ee=.6;vec3 objectNormal=normalize(vec3(-(wv(pp+vec2(ee,0.))-wv(pp-vec2(ee,0.)))/(2.*ee),1.,-(wv(pp+vec2(0.,ee))-wv(pp-vec2(0.,ee)))/(2.*ee)));\n#ifdef USE_TANGENT\nvec3 objectTangent=vec3(tangent.xyz);\n#endif')
 .replace('#include <begin_vertex>','vec3 transformed=vec3(position.x,position.y+wv(position.xz),position.z);\n#ifdef USE_ALPHAHASH\nvPosition=vec3(position);\n#endif')};
const oceanFar=oceanMat.clone();oceanFar.onBeforeCompile=()=>{};
const ocean=new THREE.Mesh(new THREE.PlaneGeometry(1800,520,240,96).rotateX(-Math.PI/2).translate(0,0,FRONT-260),oceanMat);ocean.receiveShadow=true;scene.add(ocean);
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
const SW=TOUCH?2048:2560,SHH=Math.round(SW*GH/(HALFW*2));
const strataCanvas=document.createElement('canvas');strataCanvas.width=SW;strataCanvas.height=SHH;
const glossCanvas=document.createElement('canvas');glossCanvas.width=1024;glossCanvas.height=Math.round(1024*SHH/SW);
const strataTex=new THREE.CanvasTexture(strataCanvas);strataTex.colorSpace=THREE.SRGBColorSpace;strataTex.anisotropy=ANISO;
const glossTex=new THREE.CanvasTexture(glossCanvas);
function drawStrata(imgs){const g=strataCanvas.getContext('2d'),W=SW,H=SHH;g.clearRect(0,0,W,H);
 for(let i=0;i<LAY.length;i++){const p=new Path2D();p.moveTo(0,layerTop(i,0)*H);for(let x=0;x<=W;x+=12)p.lineTo(x,layerTop(i,x/W)*H);for(let x=W;x>=0;x-=12)p.lineTo(x,layerTop(i+1,x/W)*H);p.closePath();
  g.save();g.clip(p);const im=imgs&&imgs[LAY[i][2]];
  if(im){const pat=g.createPattern(im,'repeat');const s=W/2560*.68;pat.setTransform(new DOMMatrix([s,0,0,s,(i*331)%400,(i*173)%300]));g.fillStyle=pat;g.fillRect(0,0,W,H);
   g.globalCompositeOperation='soft-light';g.globalAlpha=.4;g.fillStyle=LAY[i][1];g.fillRect(0,0,W,H);g.globalCompositeOperation='source-over';g.globalAlpha=1}
  else{g.fillStyle=LAY[i][1];g.fillRect(0,0,W,H)}
  g.restore();if(i>0){g.strokeStyle='rgba(0,0,0,.5)';g.lineWidth=3;g.beginPath();for(let x=0;x<=W;x+=12)g.lineTo(x,layerTop(i,x/W)*H);g.stroke();g.strokeStyle='rgba(255,240,220,.12)';g.lineWidth=1.5;g.beginPath();for(let x=0;x<=W;x+=12)g.lineTo(x,layerTop(i,x/W)*H+3);g.stroke()}}
 const cx=W/2,rt=layerTop(6,.5)*H;g.save();g.beginPath();for(let x=0;x<=W;x+=12)g.lineTo(x,layerTop(6,x/W)*H);g.lineTo(W,H);g.lineTo(0,H);g.closePath();g.clip();
 g.globalCompositeOperation='multiply';for(let b=0;b<9;b++){const bx=cx+(b-4)*W*.035+(rnd()-.5)*W*.02,by=rt+H*(.065+rnd()*.03),br=W*(.07+rnd()*.05);const r=g.createRadialGradient(bx,by,4,bx,by,br);r.addColorStop(0,'rgba(40,24,10,.85)');r.addColorStop(.6,'rgba(60,38,18,.55)');r.addColorStop(1,'rgba(90,60,30,0)');g.save();g.translate(bx,by);g.scale(1,.32);g.translate(-bx,-by);g.fillStyle=r;g.fillRect(0,0,W,H);g.restore()}
 g.globalCompositeOperation='source-over';const r=g.createRadialGradient(cx,rt+H*.018,10,cx,rt+H*.018,W*.11);r.addColorStop(0,'rgba(240,226,170,.7)');r.addColorStop(1,'rgba(240,226,170,0)');g.save();g.translate(cx,rt+H*.018);g.scale(1,.16);g.translate(-cx,-(rt+H*.018));g.fillStyle=r;g.fillRect(0,0,W,H);g.restore();g.restore();
 const sh=g.createLinearGradient(0,0,0,H);sh.addColorStop(0,'rgba(0,0,0,0)');sh.addColorStop(1,'rgba(0,0,0,.35)');g.fillStyle=sh;g.fillRect(0,0,W,H);
 const q=glossCanvas.getContext('2d'),QW=glossCanvas.width,QH=glossCanvas.height;q.fillStyle='#fff';q.fillRect(0,0,QW,QH);const qx=QW/2,qy=layerTop(6,.5)*QH+QH*.07;const qr=q.createRadialGradient(qx,qy,4,qx,qy,QW*.18);qr.addColorStop(0,'#181818');qr.addColorStop(.75,'#3a3a3a');qr.addColorStop(1,'#ffffff');q.save();q.translate(qx,qy);q.scale(1,.24);q.translate(-qx,-qy);q.fillStyle=qr;q.fillRect(0,0,QW,QH);q.restore();
 strataTex.needsUpdate=true;glossTex.needsUpdate=true}
drawStrata(null);
const strataMat=new THREE.MeshPhysicalMaterial({map:strataTex,roughnessMap:glossTex,roughness:.95,bumpMap:strataTex,bumpScale:2});
const strataBack=strataMat.clone();strataBack.side=THREE.BackSide;
function uvWorld(g,mode){const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
 if(mode!=='curve'&&Math.abs(n.getY(i))>.5){uv.setXY(i,x/24,z/24);continue}let u=(x+HALFW)/(HALFW*2);if(mode==='curve'||Math.abs(n.getX(i))>.5)u+=(z-FRONT)/(HALFW*2)*.3;uv.setXY(i,u,(y-GBOT)/GH)}uv.needsUpdate=true}
function blockBox(x0,x1,z0,z1){const g=new THREE.BoxGeometry(x1-x0,GH,z1-z0);g.translate((x0+x1)/2,(SEABED+GBOT)/2,(z0+z1)/2);uvWorld(g);const m=new THREE.Mesh(g,[strataMat,strataMat,M.seabed,strataMat,strataMat,strataMat]);m.receiveShadow=true;return m}
scene.add(blockBox(-HALFW,-SLOT,BACK,FRONT),blockBox(SLOT,HALFW,BACK,FRONT),blockBox(-SLOT,SLOT,BACK,-SLOT));
{const g=new THREE.CylinderGeometry(SLOT,SLOT,GH,40,1,true,Math.PI/2,Math.PI);g.translate(0,(SEABED+GBOT)/2,0);uvWorld(g,'curve');scene.add(new THREE.Mesh(g,strataBack))}
{const rocks=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,1),M.rock,70),d=new THREE.Object3D();for(let i=0;i<70;i++){let x,z;do{x=(rnd()*2-1)*190;z=BACK+rnd()*(FRONT-BACK-4)}while(Math.abs(x)<28&&z>-34);const s=.4+rnd()*1.6;d.position.set(x,SEABED+s*.25,z);d.scale.set(s,s*.55,s*(.7+rnd()*.5));d.rotation.set(rnd(),rnd()*6,rnd());d.updateMatrix();rocks.setMatrixAt(i,d.matrix)}rocks.castShadow=rocks.receiveShadow=true;scene.add(rocks)}

/* =====================================================================
   Montagem dos equipamentos (peças fixas mescladas por material)
   ===================================================================== */
const A={};const anchor=(id,parent,x,y,z)=>{const o=new THREE.Object3D();o.position.set(x,y,z);parent.add(o);A[id]=o;return o};
const ship=makeShip();scene.add(ship);const SU=ship.userData;
anchor('topdrive',SU.td,0,4.5,1.6);anchor('structures',ship,5.5,42,4);anchor('rotary',ship,0,18.4,2.2);anchor('roughneck',SU.rn,0,3.2,0);anchor('drawworks',ship,-5,20.4,6.5);
anchor('mudpumps',ship,-24,12,12.8);anchor('mudsys',ship,-16,10.4,3.5);anchor('cranes',SU.kc[0],0,6.4,0);anchor('motion',ship,0,68.5,0);anchor('diverter',ship,0,14.6,1.8);
anchor('deal',ship,6.5,19.6,-5);anchor('beaware',ship,51,22,15);anchor('gk',SU.disp,0,4.4,0);anchor('sentry',SU.disp,2.4,1.2,1.4);
anchor('esg_dls',ship,-6,34,6);anchor('esg_hsse',ship,46,31.5,0);anchor('esg_digital',ship,6.5,21.6,-5);anchor('esg_supply',ship,-34,13.5,-4);
add(ship,G.cyl(1.9,1.9,15,40),M.grey,[0,-14.5,0]);add(ship,G.cyl(2.1,2.1,.8,40),M.dark,[0,-7.4,0]);add(ship,G.cyl(2.1,2.1,.8,40),M.dark,[0,-21.6,0]);anchor('telescopic',ship,0,-15,2.1);
const flood=[[V(0,63,7),V(0,8,0)],[V(44,31,0),V(8,8,0)]].map(([p,t])=>{const s=new THREE.SpotLight(0xffe2b0,0,180,.85,.6,1.1);s.position.copy(p);const o=new THREE.Object3D();o.position.copy(t);ship.add(s,o);s.target=o;return s});
bake(ship,[SU.td,...SU.wires,SU.dpipe,SU.rn.userData.arm,SU.dw.userData.drum,...SU.kc.map(c=>c.userData.tur),...SU.pc.map(c=>c.t)]);
add(scene,G.cyl(1.3,1.3,16,40),M.chrome,[0,-20,0]);
const ring=new THREE.Group();ring.position.y=-26;scene.add(ring);add(ring,G.tor(2.7,.55,48),M.dark,[0,0,0],[Math.PI/2,0,0]);
const ATT=[[13,5],[-13,5],[13,-5],[-13,-5]];for(const[x,z]of ATT)add(ring,G.rbox(1.2,1.2,1.2,.15),M.dark,[Math.sign(x)*3,0,Math.sign(z)*1.6]);
const tens=ATT.map(([x,z])=>{const t=makeTensioner(20);scene.add(t);bake(t,[t.userData.rod]);return{t,hull:V(x,-7.2,z),ring:V(Math.sign(x)*3,0,Math.sign(z)*1.6)}});anchor('tens',tens[0].t,0,8,1.2);
const mpd=makeRiserJoint(14,{mpd:true});mpd.position.y=-34;scene.add(mpd);bake(mpd);anchor('mpd',mpd,0,1.4,2.2);anchor('esg_mpd',mpd,-3.2,3.6,1.5);
const bop=makeBOP({rams:3,anns:1,body:M.ramBody,bonnet:M.ramBon});bop.position.set(0,SEABED,0);scene.add(bop);const BU=bop.userData;
const RTOP=-41,RBOT=SEABED+BU.top,NJ=5,JL=(RTOP-RBOT)/NJ;
const riserI=instancify(makeRiserJoint(JL),NJ,scene);const rdm=new THREE.Object3D();
const bend=(y,t)=>.6*Math.sin(Math.PI*clamp((y-RBOT)/(RTOP-RBOT)))*Math.sin(t*.25);
function updRiser(t){for(let i=0;i<NJ;i++){const y=RTOP-JL*(i+.5);rdm.position.set(bend(y,t),y,0);rdm.rotation.set(0,i*.6,0);rdm.updateMatrix();riserI.set(i,rdm.matrix)}riserI.done();mpd.position.x=bend(-34,t)}
anchor('riser',scene,0,-96,2.6);
anchor('gxp',bop,0,BU.annYs[0],4.7);anchor('rams',bop,6,BU.ramYs[1],3.3);anchor('wbsr',bop,6,BU.ramYs[0],3.3);anchor('h4',bop,0,9.6,4.1);
anchor('pods',BU.pods[0],0,3,1.4);anchor('valves',BU.valves[1],0,1.2,.8);anchor('esg_bop',bop,-4.6,BU.annYs[0]+1.5,3.6);
bake(bop,BU.leds);
const eb=makeBOP({rams:2,anns:1,electric:true,body:pbr(0x5c6c78,.5,.4),bonnet:pbr(0x3a4a56,.5,.45),annCol:pbr(0x5c6c78,.5,.4)});eb.scale.setScalar(.7);eb.position.set(36,SEABED,-34);eb.rotation.y=-.35;scene.add(eb);
anchor('ebop',eb,0,eb.userData.top*.7,0);anchor('esg_ebop',eb,-5,eb.userData.top*.92,2);bake(eb,eb.userData.leds);
const k20=makeBOP({rams:4,anns:1,bonnet:pbr(0xc8452c,.25,.5,{clearcoat:.3})});k20.scale.setScalar(.7);k20.position.set(-34,SEABED,-60);k20.rotation.y=.45;scene.add(k20);anchor('k20',k20,0,k20.userData.top*.75,0);bake(k20,k20.userData.leds);
const coneMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,fog:false,
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;void main(){gl_FragColor=vec4(.8,.95,1.,pow(vUv.y,2.4)*.14);}'});
function rovWithLights(){const r=makeROV();scene.add(r);const cone=new THREE.ConeGeometry(5,16,32,1,true);cone.translate(0,-8,0);
 for(const x of[-2.2,2.2]){const s=new THREE.SpotLight(0xdff6ff,600,90,.5,.55,1.3);s.position.set(x,.1,2.5);r.add(s);const tg=new THREE.Object3D();tg.position.set(x*2,-8,14);r.add(tg);s.target=tg;
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
const lensRT=new THREE.WebGLRenderTarget(640,640,{samples:4});const lensScene=new THREE.Scene();lensScene.environment=studio;lensScene.environmentIntensity=.9;lensScene.background=new THREE.Color(0x1d1915);
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
function updFlow(t,dt,bitY,k){flowDown.p.material.opacity=flowUp.p.material.opacity=k*.95;if(k<.01)return;const LB=SEABED-bitY,TD=LD+LB,TU=LU+LB,sp=38;
 for(let i=0;i<260;i++){const u=(fS[i]+t*sp/TD)%1,s=u*TD;if(s<LD){downC.getPointAt(s/LD,tmpv)}else tmpv.set(0,SEABED-(s-LD),0);flowDown.a.set([tmpv.x,tmpv.y,tmpv.z],i*3);
  const v=(fS[i]*1.7+t*sp/TU)%1,s2=v*TU;if(s2<LB)tmpv.set(1.3,bitY+s2,.4);else upC.getPointAt((s2-LB)/LU,tmpv);flowUp.a.set([tmpv.x,tmpv.y,tmpv.z],i*3)}
 flowDown.g.attributes.position.needsUpdate=flowUp.g.attributes.position.needsUpdate=true}

/* ---------- números gigantes em profundidade (tipografia em camadas) ---------- */
const FR=[30,-22,-96,-172,-262,-322],bigNums=[];
document.fonts.ready.then(()=>FR.forEach((y,i)=>{const t=ctex(1024,560,g=>{g.font='600 520px Oswald, Arial Narrow, sans-serif';g.textAlign='center';g.textBaseline='middle';g.lineWidth=7;g.strokeStyle=i===0?'rgba(14,42,74,1)':'rgba(255,255,255,1)';g.strokeText(pad(i+1),512,300)},{wrap:false});
 const m=new THREE.Mesh(new THREE.PlaneGeometry(96,52.5),new THREE.MeshBasicMaterial({map:t,transparent:true,opacity:i===0?.1:.07,depthWrite:false,fog:false}));m.position.set(64,y+14,i<4?BACK+6:FRONT+.6);m.renderOrder=i<4?3:2;m.userData={base:m.material.opacity,y:FR[i]};scene.add(m);bigNums.push(m)}));

// sombras: tudo projeta e recebe, menos efeitos e transparências
scene.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&o.material&&!o.material.transparent&&!o.material.isShaderMaterial&&!Array.isArray(o.material)){o.castShadow=true;o.receiveShadow=true}});
ocean.castShadow=false;

/* =====================================================================
   Texturas reais (locais, WebP), HDRI e modelos oficiais opcionais (GLB)
   ===================================================================== */
async function loadTextures(){
 const[pN,pR,dd,dn,dr,cd,cn,wn]=await Promise.all([tex('blue_metal_plate_nor_gl.webp',{srgb:false,rep:[2,2]}),tex('blue_metal_plate_rough.webp',{srgb:false,rep:[2,2]}),tex('metal_plate_diff.webp'),tex('metal_plate_nor_gl.webp',{srgb:false}),tex('metal_plate_rough.webp',{srgb:false}),
  tex('corrugated_iron_diff.webp',{rep:[3,1]}),tex('corrugated_iron_nor_gl.webp',{srgb:false,rep:[3,1]}),tex('waternormals.webp',{srgb:false,rep:[18,6]})]);
 for(const m of PAINTED){if(pN){m.normalMap=pN;m.normalScale=new THREE.Vector2(.35,.35)}if(pR){m.roughnessMap=pR;m.roughness=Math.min(1,m.roughness*1.25)}m.needsUpdate=true}
 if(dd){Object.assign(M.deck,{map:dd,normalMap:dn,roughnessMap:dr,roughness:1});M.deck.color.set(0xb9bcbb);M.deck.needsUpdate=true}
 if(cd){Object.assign(M.wall,{map:cd,normalMap:cn});M.wall.needsUpdate=true}
 if(wn){for(const m of[oceanMat,oceanFar]){m.normalMap=wn;m.normalScale=new THREE.Vector2(.55,.55);m.needsUpdate=true}}
 await new Promise(res=>{nTotal++;new RGBELoader().load('assets/hdri/ceu.hdr',t=>{const env=pmrem.fromEquirectangular(t).texture;t.dispose();scene.environment=env;oceanMat.envMap=oceanFar.envMap=env;oceanMat.needsUpdate=oceanFar.needsUpdate=true;nDone++;prog();res()},undefined,()=>{nDone++;prog();res()})})}
async function loadGeology(){
 const ids=[...new Set(LAY.map(l=>l[2]))],ims=await Promise.all(ids.map(id=>img(id+'_diff.webp'))),map={};ids.forEach((id,i)=>map[id]=ims[i]);drawStrata(map);
 const[sd,sn,cc,rk,r6]=await Promise.all([tex('damp_beach_sand_diff.webp',{rep:[1,1]}),tex('damp_beach_sand_nor_gl.webp',{srgb:false}),tex('granular_concrete_diff.webp',{rep:[2,4]}),tex('dark_rock_diff.webp',{rep:[.5,.5]}),tex('rock_06_diff.webp',{rep:[2,3]})]);
 if(sd){Object.assign(M.seabed,{map:sd,normalMap:sn});M.seabed.color.set(0xc9bfa9);M.seabed.needsUpdate=true}
 if(rk){M.rock.map=rk;M.rock.color.set(0x9a9088);M.rock.needsUpdate=true}
 if(r6){lensWallMat.map=r6;lensWallMat.color.set(0xd2c2a6);lensWallMat.needsUpdate=true}
 if(cc)for(const m of[cementM,M.cement]){m.map=cc;m.needsUpdate=true}}
const gltf=new GLTFLoader();
const glbFor=k=>MODELS[k]?new Promise(res=>gltf.load('assets/models/'+MODELS[k],g=>res(g.scene),undefined,()=>res(null))):Promise.resolve(null);
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
function placeCamera(dt){const st=scrollState();fScroll=st.f;const Tg=overview?OV:{cy:st.cy,h:viewH(),tl:TILT},k=RM?1:1-Math.exp(-dt*3.4);
 cur.cy+=(Tg.cy-cur.cy)*k;cur.h=Math.exp(lerp(Math.log(cur.h),Math.log(Tg.h),k));cur.tl+=(Tg.tl-cur.tl)*k;
 const asp=innerWidth/innerHeight,wide=isWide(),vh0=viewH(),ovk=clamp((cur.h-vh0)/(OV.h-vh0)),d=(cur.h/2)/Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
 const shift=wide?cur.h*asp*.16*(1-ovk):0,yoff=wide?0:cur.h*.2*(1-ovk),tx=-shift,ty=cur.cy-yoff;camera.position.set(tx,ty+d*cur.tl,FRONT+d);camera.lookAt(tx,ty,0);camT.set(tx,ty,0);
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
for(const p of ALL){if(!A[p.id])continue;const b=document.createElement('button');b.className='hp off'+(p.esg?' esg':p.ctx?' ctx':'');b.tabIndex=-1;b.innerHTML=`<i>${p.esg?leaf:''}</i><span>${p.fotos?`<img alt="" data-src="${fotoUrl(p.fotos[0])}">`:''}<em></em></span>`;
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
function updHots(){const cr=copy.classList.contains('hide')?null:copy.getBoundingClientRect(),tr=tourOn?$('#tour').getBoundingClientRect():null,nr=nav.getBoundingClientRect(),shownPts=[];
 for(const p of ALL){if(!p.el)continue;A[p.id].getWorldPosition(tmp);const s=toScreen(tmp);
  let on=s.on&&(p.esg?esgMode:!esgMode)&&(overview?p.esg:(p.s===sec&&settled));
  for(const r of[cr,tr])if(on&&r&&s.x>r.left-12&&s.x<r.right+12&&s.y>r.top-12&&s.y<r.bottom+12)on=false;
  if(on&&s.y<nr.bottom+10)on=false;
  if(on&&shownPts.some(q=>Math.hypot(q.x-s.x,q.y-s.y)<34))on=false;if(on)shownPts.push(s);
  p.el.classList.toggle('off',!on);p.el.tabIndex=on?0:-1;if(on)p.el.style.transform=`translate3d(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px,0)`}}

// visão geral
function setOverview(v){overview=v;$('#ovBtn').setAttribute('aria-pressed',v);copy.classList.toggle('hide',v||tourOn);$('#meter').style.visibility=v?'hidden':'';
 SECS.forEach((s,i)=>{s.ob.classList.toggle('on',v);s.ob.style.transitionDelay=v?(120+i*70)+'ms':'0ms'})}
$('#ovBtn').onclick=()=>{if(tourOn)setTour(false);setOverview(!overview)};
// só a rolagem do usuário sai da visão geral (não a rolagem suave disparada pelo próprio site)
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
const catG=$('#catG'),catF=$('#catF'),catQ=$('#catQ');let catFilter='*',lastFocus=null;
const catItems=()=>P.filter(p=>!p.ctx);
function renderCatFilters(){const cats=[...new Set(catItems().map(p=>T(p).c))];catF.innerHTML=[['*',U('todos')],...cats.map(c=>[c,c])].map(([k,l])=>`<button data-k="${k}" aria-pressed="${k===catFilter}">${l}</button>`).join('');
 catF.querySelectorAll('button').forEach(b=>b.onclick=()=>{catFilter=b.dataset.k;renderCatFilters();renderCat()})}
function renderCat(){const q=catQ.value.trim().toLowerCase(),items=catItems().filter(p=>{const t=T(p);return(catFilter==='*'||t.c===catFilter)&&(!q||(t.n+' '+t.d+' '+t.c).toLowerCase().includes(q))});
 catG.innerHTML=items.length?items.map(p=>`<button class="card" data-id="${p.id}"><div class="ph">${p.fotos?`<img loading="lazy" alt="" src="${fotoUrl(p.fotos[0])}">`:''}</div><div class="in"><b>${T(p).n}</b><small><span>${T(p).c}</span><span>${pad(p.s+1)} · ${T(SECS[p.s]).tab}</span></small></div></button>`).join(''):`<p class="empty">${U('nenhum')}</p>`;
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
 $$('[data-i]').forEach(e=>e.textContent=U(e.dataset.i));$$('[data-i-label]').forEach(e=>{e.setAttribute('aria-label',U(e.dataset.iLabel));if(e.title)e.title=U(e.dataset.iLabel)});$$('[data-i-ph]').forEach(e=>e.placeholder=U(e.dataset.iPh));
 for(const b of[$('#langBtn'),$('#introLang')].filter(Boolean)){b.textContent=U('lang');b.setAttribute('aria-label',U('langNome'))}
 $('#hintTxt').textContent=TOUCH?U('deslizar'):U('rolar');if(ready)goBtn.textContent=U('iniciar')+'  🔊';prog();
 SECS.forEach((s,i)=>{const t=T(s);s.tabEl.innerHTML=`<b>${pad(i+1)}</b> <span>${t.tab}</span>`;s.tabEl.setAttribute('aria-label',`${pad(i+1)} ${t.tab}`);s.menuEl.innerHTML=`<b>${pad(i+1)}</b>${t.t}`;s.tick.firstChild.innerHTML=`<b>${pad(i+1)}</b><span>${t.tab}</span>`;s.tick.firstChild.setAttribute('aria-label',t.t);s.ob.innerHTML=`<b>${pad(i+1)}</b>${t.tab}`});
 for(const p of ALL)if(p.el){p.el.querySelector('em').textContent=T(p).n;p.el.setAttribute('aria-label',T(p).n)}
 TAGS.forEach(g=>g.e.textContent=C.camadas[L][g.k]);renderEsg();if(cat.classList.contains('on')){renderCatFilters();renderCat()}
 if(tourOn)showStep(tourI);if(entered&&!overview&&!tourOn)setCopy(sec,true);if(fpState&&!fpState.closing)rerenderPanel();moveInd(sec)}
function toggleLang(){L=L==='pt'?'en':'pt';store.set('hmh-lang',L);applyLang()}
$('#langBtn').onclick=toggleLang;$('#introLang').onclick=toggleLang;

// teclado: atalhos, Esc e foco preso nos diálogos
addEventListener('keydown',e=>{if(e.target.closest&&e.target.closest('input,textarea')&&e.key!=='Escape'&&e.key!=='Tab')return;
 if(e.key==='Tab'){const box=fpState?fp:cat.classList.contains('on')?cat:null;if(!box)return;const f=[...box.querySelectorAll('button,a[href],input,iframe')].filter(x=>x.offsetParent!==null);if(!f.length)return;
  if(!box.contains(document.activeElement)){e.preventDefault();f[0].focus();return}if(e.shiftKey&&document.activeElement===f[0]){e.preventDefault();f[f.length-1].focus()}else if(!e.shiftKey&&document.activeElement===f[f.length-1]){e.preventDefault();f[0].focus()}return}
 if(fpState){if(e.key==='Escape')closePanel();if(e.key==='ArrowRight')stepPanel(1);if(e.key==='ArrowLeft')stepPanel(-1);return}
 if(e.key==='Escape'){if(cat.classList.contains('on'))setCat(false);else if(tourOn)setTour(false);else if(esgSheet.classList.contains('on'))closeEsgSheet();else if(overview)setOverview(false);menu(false);return}
 if(cat.classList.contains('on'))return;const k=e.key.toLowerCase();if(k==='v')setOverview(!overview);if(k==='e')setEsg(!esgMode);if(k==='c')setCat(true);if(k==='n')setNight(!night)});

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
const slugOf=p=>(p.s>=0?SECS[p.s].id:'esg')+'/'+p.id;
// abas: equipamentos HMH mostram foto real (e vídeo, quando existe); só os itens de contexto, sem foto da HMH, ficam com o modelo 3D
function tabDefs(p){const t=[];if(p.esg)t.push(['stat',U('destaque')]);if(!p.esg&&p.yt)t.push(['video',U('video')]);if(p.fotos)t.push(['photo',p.fotos.length>1?U('fotos'):U('foto')]);else if(!p.esg)t.push(['3d',U('modelo')]);return t}
function panelHTML(p){const list=listFor(p),i=list.indexOf(p),W=fpState?fpState.W:0,t=T(p);
 const tag=p.esg?'<span class="tag esg">ESG Point</span>':`<span class="tag ${p.ctx?'ctx':''}">${p.ctx?U('contexto'):U('produto')}</span>`;
 const td=tabDefs(p),tabs=td.length>1?`<div class="tabs2" role="tablist">${td.map(([k,l])=>`<button data-t="${k}" role="tab">${l}</button>`).join('')}</div>`:'';
 const facts=p.esg?[[U('categoria'),t.cat],[U('destaque'),t.st+' '+t.sl],[U('fonte'),'hmhw.com']]:[[U('linha'),lineOf(p)],[U('categoria'),t.c],[U('secao'),T(SECS[p.s]).tab],[U('profundidade'),T(SECS[p.s]).prof]];
 const links=p.esg?`<a class="grn" href="${BASE+p.u}" target="_blank" rel="noopener">${U('verFonte')}</a>`:`${p.u?`<a class="pri" href="${BASE+p.u}" target="_blank" rel="noopener">${U('verHmh')}</a>`:''}${p.yt?`<a href="https://www.youtube.com/watch?v=${p.yt}" target="_blank" rel="noopener">${U('abrirYt')}</a>`:(p.ctx?'':`<a href="https://www.youtube.com/results?search_query=${encodeURIComponent('HMH '+t.n)}" target="_blank" rel="noopener">${U('buscarYt')}</a>`)}`;
 const prev=list[(i-1+list.length)%list.length],next=list[(i+1)%list.length];
 return `<div class="fp-in"${W?` style="width:${W}px"`:''}><div class="fp-h"><i class="${p.esg?'esg':p.ctx?'ctx':''}"></i><b id="fpT">${[...t.n].map(ch=>`<span class="c">${ch===' '?'&nbsp;':ch}</span>`).join('')}</b>${tag}<button class="x" aria-label="${U('fechar')}">×</button></div>
  <div class="fp-l">${tabs}<div class="stage"><span class="cap"></span></div><div class="thumbs"></div></div>
  <div class="side"><p>${t.d}</p><div class="facts">${facts.map(([a,b])=>`<div><span>${a}</span><b>${b}</b></div>`).join('')}</div><div class="links">${links}</div></div>
  ${list.length>1?`<div class="fp-n"><button data-s="-1" aria-label="${U('anterior')}">‹ <span>${T(prev).n}</span></button><span class="pg">${pad(i+1)} / ${pad(list.length)}</span><button data-s="1" aria-label="${U('proximo')}"><span>${T(next).n}</span> ›</button></div>`:''}</div>`}
function clearStage(stage){for(const s of['canvas','iframe','.play','.stat','.photo'])stage.querySelector(s)?.remove();const th=fp.querySelector('.thumbs');if(th)th.innerHTML=''}
function stageVideo(stage,p){if(!isHttp){stage.insertAdjacentHTML('beforeend',`<a class="play" href="https://www.youtube.com/watch?v=${p.yt}" target="_blank" rel="noopener" style="background-image:url(https://i.ytimg.com/vi/${p.yt}/hqdefault.jpg)"><span>▶</span><div class="note">${U('arquivoLocal')}</div></a>`);return}
 stage.insertAdjacentHTML('beforeend',`<iframe src="https://www.youtube-nocookie.com/embed/${p.yt}?autoplay=1&rel=0&modestbranding=1&playsinline=1&hl=${L==='pt'?'pt-BR':'en'}&cc_lang_pref=${L}&origin=${encodeURIComponent(location.origin)}" title="${T(p).n}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`);audio.duck(true)}
function stageStat(stage,p){stage.insertAdjacentHTML('beforeend',`<div class="stat"><b>${T(p).st}</b><span>${T(p).sl}</span></div>`);countUp(stage.querySelector('.stat b'),T(p).st)}
function stagePhoto(stage,p,k=0){const list=p.fotos;stage.querySelector('.photo')?.remove();const d=document.createElement('div');d.className='photo';d.innerHTML=`<img alt="${T(p).n}" src="${fotoUrl(list[k])}"><span class="credit">${U('credito')}</span>`;stage.appendChild(d);
 const im=d.querySelector('img');im.onload=()=>setTimeout(fitPanel,30);im.onerror=()=>{d.innerHTML=`<span class="credit">${U('fotoIndisp')}</span>`};if(!RM)im.animate([{opacity:0,transform:'scale(1.06)',filter:'blur(8px)'},{opacity:1,transform:'none',filter:'blur(0)'}],{duration:700,easing:EASE});
 const th=fp.querySelector('.thumbs');if(th){th.innerHTML=list.length>1?list.map((n,i)=>`<button class="${i===k?'on':''}" aria-label="${U('foto')} ${i+1}/${list.length}"><img alt="" src="${fotoUrl(n)}"></button>`).join(''):'';th.querySelectorAll('button').forEach((b,i)=>b.onclick=()=>stagePhoto(stage,p,i))}}
function fitPanel(){if(!fpState||fpState.closing||fpState.stepping)return;if(fp.getAnimations().some(a=>a.playState==='running')){setTimeout(fitPanel,200);return}
 const inner=fp.firstElementChild;if(!inner)return;const Tt=fpState.to,nh=Math.min(inner.scrollHeight+2,innerHeight-24);if(Math.abs(nh-Tt.h)<3)return;
 const top=clamp((innerHeight-nh)/2+10,12,innerHeight-nh-12);pinPanel(Tt);fp.style.height=nh+'px';fp.style.top=top+'px';if(!RM)fp.animate([{height:Tt.h+'px',top:Tt.t+'px'},{height:nh+'px',top:top+'px'}],{duration:380,easing:EASE});fpState.to={...Tt,t:top,h:nh}}
function setTab(tab){const st=fpState;if(!st)return;st.tab=tab;fp.querySelectorAll('.tabs2 button').forEach(b=>b.setAttribute('aria-selected',b.dataset.t===tab));const stage=fp.querySelector('.stage');if(!stage)return;clearStage(stage);audio.duck(false);
 if(tab==='video')stageVideo(stage,st.p);else if(tab==='stat')stageStat(stage,st.p);else if(tab==='photo')stagePhoto(stage,st.p,0);else showModel(st.p.m,stage);stage.querySelector('.cap').textContent=tab==='3d'?U('arraste'):'';setTimeout(fitPanel,60)}
function wirePanel(p,tab){const inner=fp.firstElementChild;inner.querySelector('.x').onclick=()=>closePanel();inner.querySelectorAll('.tabs2 button').forEach(b=>b.onclick=()=>setTab(b.dataset.t));inner.querySelectorAll('.fp-n button').forEach(b=>b.onclick=()=>stepPanel(+b.dataset.s));
 if(!RM)inner.querySelectorAll('.fp-h b .c').forEach((c,k)=>c.animate([{opacity:0,transform:'translateY(60%)'},{opacity:1,transform:'none'}],{duration:500,delay:120+k*14,easing:EASE,fill:'both'}));
 setTimeout(()=>{if(fpState&&fpState.p===p)setTab(tab||tabDefs(p)[0][0])},260)}
function pinPanel(Tt){fp.getAnimations().forEach(a=>a.cancel());Object.assign(fp.style,{left:Tt.l+'px',top:Tt.t+'px',width:Tt.w+'px',height:Tt.h+'px',borderRadius:'22px',opacity:'1'})}
function openPanel(p,originEl,fromPop){if(fpState)return;if(cat.classList.contains('on'))setCat(false);audio.whoosh(true);const W=Math.min(900,innerWidth-24);fpState={p,W,origin:originEl};lastFocus=document.activeElement;
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
addEventListener('popstate',()=>{const h=parseHash();if(fpState&&!fpState.closing&&!h.item)closePanel(true);else if(!fpState&&h.item)openItem(h.item,true)});
function parseHash(){const h=decodeURIComponent(location.hash.slice(1));if(!h)return{};const[a,b]=h.split('/'),si=SECS.findIndex(s=>s.id===a);return{si,item:byId[b]||(si<0?byId[a]:null)||null}}
addEventListener('resize',()=>{if(fpState&&!fpState.closing){const W=Math.min(900,innerWidth-24);fpState.W=W;pinPanel(fpState.to);fp.firstElementChild.style.width=W+'px';fp.style.width=W+'px';fp.style.height='auto';const H=Math.min(fp.offsetHeight,innerHeight-24);const Tt={l:(innerWidth-W)/2,t:clamp((innerHeight-H)/2,12,innerHeight-H-12),w:W,h:H};pinPanel(Tt);fpState.to=Tt}});

/* =====================================================================
   Loop
   ===================================================================== */
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.35,.5,.9);composer.addPass(bloom);composer.addPass(new OutputPass());
function resize(){const w=innerWidth,h=innerHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);composer.setSize(w,h);moveInd(sec)}
addEventListener('resize',resize);resize();setQuality(Q.level);
const hud={d:$('#hDepth'),p:$('#hPres'),t:$('#hTemp'),z:$('#hZone')},mFill=$('#mFill'),mMark=$('#mMark'),ct=$('#ct');let lastZone='',hintDone=false,lastSec=-1,frameN=0;
const fmt=n=>Math.round(n).toLocaleString(L==='pt'?'pt-BR':'en-US');
const depthOf=y=>y>=0?0:y>SEABED?-y/-SEABED*1500:Math.min(5000,1500+(SEABED-y)/(GH*.75)*3000);
let last=performance.now()/1000;
const cRam=new THREE.Color(),glassDay=0,cOcean=new THREE.Color(0x0b3c52),cOceanN=new THREE.Color(0x02101a);
function frame(nowMs){requestAnimationFrame(frame);const t=nowMs/1000,dt=Math.min(.05,t-last),rawDt=t-last;last=t;frameN++;
 placeCamera(dt);const cy=cur.cy;
 const ns=clamp(Math.round(fScroll),0,SECS.length-1);if(ns!==sec)sec=ns;
 settled=!overview&&Math.abs(fScroll-Math.round(fScroll))<.06&&Math.abs(cur.cy-FR[sec])<4;
 // qualidade adaptativa (só mede com a aba visível e a cena em uso)
 if(entered&&!document.hidden&&rawDt<.25&&!fpState){Q.frames++;Q.acc+=rawDt;if(Q.acc>2.5){const fps=Q.frames/Q.acc;Q.frames=0;Q.acc=0;if(fps<38&&Q.level>0)setQuality(Q.level-1)}}
 // equipamentos em movimento
 const heave=wave(0,0,t)*.45;ship.position.y=heave;ship.rotation.z=(wave(40,0,t)-wave(-40,0,t))/80*.25;foam.position.y=heave*.6+.3;foamTex.offset.set(t*.004,t*.01);
 const tdy=lerp(19,56,.5-.5*Math.cos(t*.3));SU.td.position.set(0,tdy,0);SU.wires.forEach((w,i)=>{const a=V(i<2?-.6:.6,64,i%2?-.6:.6),b=V(a.x,tdy+7.2,a.z);w.position.copy(a).lerp(b,.5);w.scale.set(1,a.y-b.y,1)});
 SU.dpipe.position.set(0,(17.9+tdy-.3)/2,0);SU.dpipe.scale.set(1,Math.max(.1,tdy-.3-17.9),1);
 SU.dw.userData.drum.rotation.x=t*1.2;SU.rn.userData.arm.rotation.y=Math.sin(t*.5)*.5;SU.kc.forEach((c,i)=>c.userData.tur.rotation.y=Math.sin(t*.25+i*2)*.6);SU.pc.forEach((c,i)=>c.t.rotation.y=c.a+Math.sin(t*.12+i)*.35);
 ship.updateMatrixWorld();
 for(const Tn of tens){const a=ship.localToWorld(Tn.hull.clone()),b=Tn.ring.clone().add(ring.position);Tn.t.position.copy(a);Tn.t.quaternion.setFromUnitVectors(UP,b.clone().sub(a).normalize());Tn.t.userData.rod.position.y=Tn.t.userData.base+(a.distanceTo(b)-Tn.t.userData.closed)}
 ring.position.x=bend(-26,t);updRiser(t);
 rovs[0].position.set(11+Math.cos(t*.15)*3,-100+Math.sin(t*.22)*5,9);rovs[0].lookAt(0,-104,0);
 rovs[1].position.set(19+Math.sin(t*.2)*2,SEABED+5+Math.sin(t*.4)*.8,13);rovs[1].lookAt(0,SEABED+10,0);
 rovs[2].position.set(-20+Math.sin(t*.18)*2,SEABED+6+Math.cos(t*.3),11);rovs[2].lookAt(0,SEABED+12,0);
 BU.leds.forEach((l,i)=>l.visible=Math.sin(t*3+i*1.6)>0);
 uTime.value=t;if(camera.position.y>-6||overview)updRibbon(t);if(oceanMat.normalMap)oceanMat.normalMap.offset.set(t*.004,t*.006);
 for(const m of bigNums)m.material.opacity=m.userData.base*(overview?1:clamp(1.25-Math.abs(cur.cy-m.userData.y)/48));
 rays.forEach(m=>m.material.opacity=(.05+.035*Math.sin(t*.5+m.userData.ph))*(1-nightK*.8));
 if(snow.visible&&(cy>SEABED-60||overview)){for(let i=0;i<NS;i++){const s=snowS[i];let y=s[1]-t*(.3+s[3]*.6);const H=-SEABED-4;y=SEABED+(((y-SEABED)%H)+H)%H;snowA[i*3]=s[0]+Math.sin(t*.2+i)*.5;snowA[i*3+1]=y;snowA[i*3+2]=s[2]}snowG.attributes.position.needsUpdate=true}
 if(cy<-20||overview)updFish(t);
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
 const tk=tourOn?1:0;flowDown.k=(flowDown.k||0)+(tk-(flowDown.k||0))*(1-Math.exp(-dt*3));updFlow(t,dt,bitY,flowDown.k);
 const bopOn=tourOn&&TOUR[tourI].bop?(.5+.5*Math.sin(t*5))*.7:0;M.ramBody.emissive.setRGB(bopOn,bopOn*.12,bopOn*.08);M.ramBon.emissive.setRGB(bopOn,bopOn*.1,bopOn*.06);
 if(tourOn&&tourPlay&&settled&&!fpState){tourT+=dt;if(tourT>8)showStep(tourI+1)}
 // modo noite
 nightK+=((night?1:0)-nightK)*(1-Math.exp(-dt*2.2));uNight.value=nightK;
 scene.fog.color.copy(HAZE).lerp(HAZE_N,nightK);key.intensity=2.6*(1-nightK*.85);hemi.intensity=.5*(1-nightK*.6);rim.intensity=.7*(1-nightK*.5);scene.environmentIntensity=lerp(.62,.16,nightK);
 M.glass.emissiveIntensity=nightK*.9;M.lampN.color.setRGB(lerp(.54,1,nightK),lerp(.56,.9,nightK),lerp(.58,.7,nightK));flood.forEach(s=>s.intensity=nightK*900);
 oceanMat.color.copy(cOcean).lerp(cOceanN,nightK);oceanMat.envMapIntensity=oceanFar.envMapIntensity=1-nightK*.75;
 bloom.threshold=lerp(.9,.72,nightK);bloom.strength=lerp(lerp(.3,.5,smooth(-cy/150)),.75,nightK);
 // som, navbar adaptativa, HUD e medidor
 const u=smooth((-1-cy)/8),gnd=smooth((SEABED-10-cy)/24);audio.mix(u,gnd,gnd*(1-flow*.5));audio.update(dt);
 nav.classList.toggle('dark',!overview&&(cy<-8||nightK>.5));
 const depth=depthOf(cy);hud.d.textContent=fmt(depth)+' m';hud.p.textContent=fmt(1+depth/10)+' bar';hud.t.textContent=Math.round(cy>=0?27:cy>SEABED?lerp(27,4,smooth(-cy/150)):lerp(4,95,clamp((SEABED-cy)/(GH*.75))))+' °C';
 const zone=overview?U('visaoZona'):T(SECS[sec]).zona;if(zone!==lastZone){hud.z.textContent=zone;lastZone=zone}
 const pr=fScroll/(SECS.length-1);mFill.style.height=(pr*100).toFixed(2)+'%';mMark.style.top=(pr*100).toFixed(2)+'%';
 if(!hintDone&&fScroll>.4){hintDone=true;$('#hint').classList.add('off')}
 // texto, navegação e link da seção
 if(!overview&&entered&&!tourOn)setCopy(sec);
 if(sec!==lastSec){lastSec=sec;SECS.forEach((s,i)=>{const on=i===sec;s.tabEl.classList.toggle('on',on);s.menuEl.classList.toggle('on',on);s.tick.classList.toggle('on',on);for(const b of[s.tabEl,s.menuEl,s.tick.firstChild])on?b.setAttribute('aria-current','step'):b.removeAttribute('aria-current')});moveInd(sec);
  ct.textContent=`${pad(sec+1)} / ${pad(SECS.length)}`;$('#bUp').disabled=sec===0;$('#bDn').disabled=sec===SECS.length-1}
 if(entered&&settled&&!fpState&&location.hash.slice(1)!==SECS[sec].id&&!history.state?.panel)history.replaceState(null,'','#'+SECS[sec].id);
 updHots();
 if(overview)SECS.forEach((s,i)=>{const sc=toScreen(V(-HALFW-4,FR[i]-(i===0?-10:0),FRONT));s.ob.style.left=Math.max(12,sc.x-200)+'px';s.ob.style.top=(sc.y-21)+'px'});
 TAGS.forEach(g=>{const sc=toScreen(g.p);const on=!overview&&settled&&(g.big?sec===5:sec>=4)&&sc.on;g.e.style.opacity=on?1:0;g.e.style.transform=`translate3d(${sc.x.toFixed(0)}px,${sc.y.toFixed(0)}px,0) translate(-50%,-50%)`});
 // com painel ou catálogo aberto a cena fica atrás do desfoque: renderiza 1 a cada 3 quadros
 if((fpState||cat.classList.contains('on'))&&frameN%3)return;
 composer.render(dt)}

/* =====================================================================
   Entrada
   ===================================================================== */
const introT=$('#introT');{const tx=introT.textContent;introT.innerHTML=[...tx].map(ch=>`<span>${ch===' '?'&nbsp;':ch}</span>`).join('');if(!RM)[...introT.children].forEach((s,k)=>s.animate([{transform:'translateY(110%)',opacity:0},{transform:'none',opacity:1}],{duration:900,delay:150+k*45,easing:EASE,fill:'both'}))}
if(TOUCH)$('#hintIco').className='finger';
const goBtn=$('#goBtn');let ready=false;
$$('#snaps .estatico').forEach(e=>e.inert=true);cChips.addEventListener('scroll',chipsMore,{passive:true});
applyLang();requestAnimationFrame(frame);window.__ready=true;
Promise.race([loadTextures(),new Promise(r=>setTimeout(r,9000))]).then(()=>{ready=true;goBtn.removeAttribute('data-i');goBtn.disabled=false;goBtn.textContent=U('iniciar')+'  🔊';if(!RM)goBtn.animate([{transform:'scale(.9)',opacity:0},{transform:'none',opacity:1}],{duration:600,easing:'cubic-bezier(.34,1.4,.64,1)'})});
loadGeology();
function enter(withSound){if(withSound)audio.start();$('#intro').classList.add('out');setTimeout(()=>$('#intro')?.remove(),1200);
 const h=parseHash();if(h.si>=0){go(h.si,true);cur.cy=FR[h.si]}
 setTimeout(()=>{nav.classList.add('in');if(!tourOn)copy.classList.remove('hide');entered=true;setCopy(sec,true);$('#hint').classList.toggle('off',hintDone);if(h.item)setTimeout(()=>openItem(h.item,true),700)},350)}
goBtn.onclick=()=>enter(true);$('#muteBtn').onclick=()=>enter(false);
