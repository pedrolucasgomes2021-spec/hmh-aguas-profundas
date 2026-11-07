// Cartão de operação: simulação 3D do funcionamento interno do equipamento + resumo + vídeo 3D,
// ligado ao equipamento por uma linha. Usa um renderer próprio e cenas procedurais com corte (plano de recorte + "tampa" por face de trás).
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const PI=Math.PI,V=(x,y,z)=>new THREE.Vector3(x,y,z),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t,sm=x=>x<=0?0:x>=1?1:x*x*(3-2*x);
const NS='http://www.w3.org/2000/svg';
const LA=(p,s=56)=>new THREE.LatheGeometry(p.map(q=>new THREE.Vector2(q[0],q[1])),s),RG=(ro,ri,y0,y1,s=56)=>LA([[ro,y0],[ro,y1],[ri,y1],[ri,y0],[ro,y0]],s);
const CY=(r,h,s=32)=>new THREE.CylinderGeometry(r,r,h,s),BX=(w,h,d)=>new THREE.BoxGeometry(w,h,d),aX=g=>{g.rotateZ(-PI/2);return g},aZ=g=>{g.rotateX(PI/2);return g};
const plate=(w,d,hr,h)=>{const s=new THREE.Shape();s.moveTo(-w/2,-d/2);s.lineTo(w/2,-d/2);s.lineTo(w/2,d/2);s.lineTo(-w/2,d/2);s.closePath();const hl=new THREE.Path();hl.absarc(0,0,hr,0,PI*2,true);s.holes.push(hl);const g=new THREE.ExtrudeGeometry(s,{depth:h,bevelEnabled:false,curveSegments:40});g.rotateX(-PI/2);return g};
const blade=kind=>{const sh=new THREE.Shape();sh.moveTo(-.8,-1);sh.lineTo(.8,-1);if(kind==='pipe'){sh.lineTo(.8,-.5);sh.absarc(.8,0,.5,-PI/2,PI/2,true);sh.lineTo(.8,1)}else{sh.lineTo(.8,-.3);sh.lineTo(.25,0);sh.lineTo(.8,.3);sh.lineTo(.8,1)}sh.lineTo(-.8,1);sh.closePath();const g=new THREE.ExtrudeGeometry(sh,{depth:.95,bevelEnabled:true,bevelSize:.04,bevelThickness:.04,bevelSegments:2,curveSegments:24});g.rotateX(-PI/2);return g};

const TX={pt:{sim:'Simulação 3D',real:'Modelo HMH',pho:'Fotos oficiais',credit:'Fotos: hmhw.com',vid:'Vídeo HMH',sum:'Resumo da operação',sheet:'Ficha do produto',yt:'Abrir no YouTube',ar:'QR para AR',arHelp:'Este equipamento ainda não tem modelo para AR.',arQr:'Aponte a câmera do celular para o QR code. Abre o modelo em tamanho real no seu espaço.',arQrAlt:'QR code para ver em AR',cut:'Corte',ext:'Externo',play:'Pausar',playB:'Reproduzir',min:'Minimizar',big:'Ampliar',small:'Reduzir',exp:'Expandir',close:'Fechar',drag:'Arraste para girar',illus:'Simulação ilustrativa, não reproduz o equipamento HMH ao detalhe',illusM:'Modelo 3D interpretado a partir das fotos HMH, não é CAD oficial',cisalhante:'A gaveta cisalhante é ilustrativa e não está em escala legal.',vh:'Vídeo oficial HMH no YouTube'},
 en:{sim:'3D simulation',real:'HMH model',pho:'Official photos',credit:'Photos: hmhw.com',vid:'HMH video',sum:'Operation summary',sheet:'Product sheet',yt:'Open on YouTube',ar:'AR QR',arHelp:'This equipment has no AR model yet.',arQr:'Point your phone camera at the QR code. It opens the model at real size in your space.',arQrAlt:'QR code to view in AR',cut:'Cutaway',ext:'Outside',play:'Pause',playB:'Play',min:'Minimise',big:'Enlarge',small:'Shrink',exp:'Expand',close:'Close',drag:'Drag to rotate',illus:'Illustrative simulation, not an exact copy of the HMH equipment',illusM:'3D model interpreted from HMH photos, not official CAD',cisalhante:'The shear ram is illustrative and is not to legal scale.',vh:'Official HMH video on YouTube'}};

const AR_IDS=new Set(['cranes','diverter','drawworks','ebop','gk','gxp','h4','mudpumps','pods','rams','riser','rotary','roughneck','sentry','structures','telescopic','topdrive','valves','wbsr']);
export function createOp({lang,anchor,sheet,photos=()=>[],real=()=>null,video=()=>[],reduced=false}){
 let hidCopy=false,bound=false,S=null,cur=null,rl=null,pk=0,rz=40,T=0,play=true,speed=1,cut=true,tab='sim',az=.3,el=.15,drag=null,key=null,pid=null,side='r',lastSide=0,w0=0,h0=0,open=false;
 const L=()=>lang(),X=k=>TX[L()][k];
 const card=document.createElement('aside');card.className='opc mcard glass dw';card.hidden=true;card.setAttribute('role','dialog');card.setAttribute('aria-labelledby','opN');
 card.innerHTML=`<header><span class="opd" aria-hidden="true"></span><div class="opt"><small id="opC"></small><b id="opN"></b></div><button class="mn" id="opEx"></button><button class="mn" id="opMn"></button><button class="x2" id="opX"></button></header>
 <div class="mbody"><div class="opTabs"><button data-t="sim" aria-pressed="true" id="opTs"></button><button data-t="real" aria-pressed="false" id="opTr"></button><button data-t="pho" aria-pressed="false" id="opTp"></button><button data-t="vid" aria-pressed="false" id="opTv"></button></div>
  <div class="opv" id="opV"><canvas id="opCv"></canvas><div class="opLabs" id="opLabs"></div><div class="opLoad" id="opLoad" hidden></div><small class="opHint" id="opHint"></small>
   <div class="opBar"><button id="opPlay" class="opb"></button><div class="opTl" id="opTl" role="slider" aria-valuemin="0" aria-valuemax="100"><i id="opFill"></i><span id="opTicks"></span></div><button id="opSp" class="opb">1×</button><button id="opCut" class="opb" aria-pressed="true"></button></div></div>
  <div class="opPho" id="opPho" hidden></div><div class="opVid" id="opVid" hidden></div>
  <h4 id="opSumT"></h4><p class="opSum" id="opSum"></p><ol class="opSteps" id="opSteps"></ol><small class="opNote" id="opNote"></small><small class="opNote" id="opArMsg" role="status"></small>
  <footer><button id="opAr" class="opb"></button><button id="opSheet" class="opb pri"></button><a id="opYt" class="opb" target="_blank" rel="noopener"></a></footer></div>`;
 document.body.appendChild(card);
 const svg=document.createElementNS(NS,'svg');svg.setAttribute('class','opLine');svg.setAttribute('aria-hidden','true');svg.innerHTML='<defs><linearGradient id="opg" x1="0" x2="1"><stop offset="0" stop-color="#59d0ff"/><stop offset="1" stop-color="#fff"/></linearGradient></defs><path id="opP" fill="none" stroke="#8fe0ff" stroke-width="2" stroke-linecap="round"/><circle id="opD" r="4.5" fill="#fff"/><circle id="opR" r="9" fill="none" stroke="#59d0ff" stroke-width="1.5"/>';
 svg.style.display='none';document.body.appendChild(svg);
 const $=s=>card.querySelector(s),P=svg.querySelector('#opP'),D=svg.querySelector('#opD'),RR=svg.querySelector('#opR');

 // ---------- motor 3D
 function sim(){if(S)return S;const old=$('#opCv'),cv=document.createElement('canvas');cv.id='opCv';old.replaceWith(cv);const r=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true});r.setPixelRatio(Math.min(devicePixelRatio||1,1.75));r.localClippingEnabled=true;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.1;r.outputColorSpace=THREE.SRGBColorSpace;
  const sc=new THREE.Scene(),pm=new THREE.PMREMGenerator(r);sc.environment=pm.fromScene(new RoomEnvironment(),.04).texture;pm.dispose();
  const cam=new THREE.PerspectiveCamera(32,1.6,.1,200);sc.add(new THREE.HemisphereLight(0xcfe8ff,0x1b2a38,.6));const dl=new THREE.DirectionalLight(0xffffff,2.4);dl.position.set(5,9,10);sc.add(dl);
  const clip=new THREE.Plane(V(0,0,-1),0);
  const fm=(c,rg,m)=>new THREE.MeshStandardMaterial({color:c,roughness:rg,metalness:m,clippingPlanes:[clip]}),cm=c=>new THREE.MeshBasicMaterial({color:c,side:THREE.BackSide,clippingPlanes:[clip]});
  const MT={steel:fm(0x1f6aa0,.38,.55),red:fm(0xc42630,.4,.4),pipe:fm(0xb9c7d2,.3,.8),rub:fm(0xd8602d,.7,0),grey:fm(0x7b8a97,.45,.7),yel:fm(0xf0b020,.5,.3),dark:fm(0x2a2f35,.6,.4),wh:fm(0xe8eef2,.5,.2),aqua:fm(0x8fd6df,.36,.4),blue:fm(0x1e7ac4,.36,.3),orange:fm(0xff8a1c,.5,.1),chrome:fm(0xf2f5f7,.12,1),black:fm(0x15171a,.5,.4),wire:fm(0x3a3f45,.5,.6)};
  const CP={steel:cm(0x4aa0e0),red:cm(0xf06060),pipe:cm(0xeaf0f4),rub:cm(0xff9a62),grey:cm(0xbcc8d2),yel:cm(0xffd060),dark:cm(0x5a6068),wh:cm(0xffffff),aqua:cm(0xc6f0f5),blue:cm(0x5fb0ee),orange:cm(0xffb060),chrome:cm(0xffffff),black:cm(0x444a50),wire:cm(0x6a7078)};
  const root=new THREE.Group();sc.add(root);
  const add=(geo,k,x=0,y=0,z=0,par=root)=>{const g=new THREE.Group();g.position.set(x,y,z);const a=new THREE.Mesh(geo,MT[k]),b=new THREE.Mesh(geo,CP[k]);g.add(a,b);g.userData.m=[a,b];par.add(g);return g};
  const unit=CY(.1,1,10);
  const link=(g,a,b)=>{const d=b.clone().sub(a),Ln=d.length();g.position.copy(a).addScaledVector(d,.5);g.scale.set(1,Ln,1);g.quaternion.setFromUnitVectors(V(0,1,0),d.normalize())};
  const flow=(par,pts,n,col,spd,rad=.06)=>{const crv=new THREE.CatmullRomCurve3(pts),m=new THREE.InstancedMesh(new THREE.SphereGeometry(rad,8,6),new THREE.MeshBasicMaterial({color:col,clippingPlanes:[clip]}),n),o=new THREE.Object3D();par.add(m);
   return{m,upd:(t,on=1)=>{m.visible=on>.02;if(!m.visible)return;for(let i=0;i<n;i++){const u=(((i/n)+t*spd)%1+1)%1;crv.getPointAt(u,o.position);o.scale.setScalar(.7+.3*Math.sin(i*1.7));o.updateMatrix();m.setMatrixAt(i,o.matrix)}m.instanceMatrix.needsUpdate=true}}};
  const pipeAt=(x=0,y0=-1.5,y1=12,rad=.45,par=root)=>add(CY(rad,y1-y0,32),'pipe',x,(y0+y1)/2,0,par);
  const realG=new THREE.Group();realG.visible=false;sc.add(realG);S={r,sc,cam,clip,root,realG,MT,CP,add,unit,link,flow,pipeAt,cv};
  if(!bound){bound=true;const hk=$('#opV');hk.addEventListener('pointerdown',e=>{if(e.target.closest('.opBar'))return;drag={x:e.clientX,y:e.clientY,id:e.pointerId};hk.setPointerCapture(e.pointerId);hk.classList.add('drag')});
  hk.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;az=clamp(az-(e.clientX-drag.x)*.006,-1.15,1.15);el=clamp(el+(e.clientY-drag.y)*.004,-.12,.75);drag.x=e.clientX;drag.y=e.clientY});
  const up=e=>{if(drag&&e.pointerId===drag.id){drag=null;hk.classList.remove('drag')}};hk.addEventListener('pointerup',up);hk.addEventListener('pointercancel',up);}
  return S}

 // ---------- peças reutilizadas
 function annB(par,y0){const{add}=S;add(RG(2.6,1.0,y0,y0+.45),'steel',0,0,0,par);add(RG(2.6,1.85,y0+.45,y0+3.4),'steel',0,0,0,par);add(RG(2.6,1.0,y0+3.4,y0+3.9),'steel',0,0,0,par);add(RG(1.5,1.0,y0+3.9,y0+4.7),'steel',0,0,0,par);add(RG(2.3,1.0,y0+4.7,y0+5.0),'red',0,0,0,par);bolts(par,2.45,y0+.45,28,.13,.3);bolts(par,2.45,y0+3.4,28,.13,.3);bolts(par,2.1,y0+5.0,24,.1,.2);add(RG(2.62,2.5,y0+1.4,y0+1.55),'grey',0,0,0,par);add(RG(2.62,2.5,y0+2.4,y0+2.55),'grey',0,0,0,par);
  const pist=add(RG(2.45,1.88,y0+.45,y0+1.0),'grey',0,0,0,par),eG=f=>{const rin=lerp(1.0,.47,f),a=y0+1.1+.3*f,b=y0+3.15;return LA([[1.75,a],[1.75,b],[rin+.2,b],[rin,b-.3],[rin,a+.3],[rin+.2,a],[1.75,a]],64)};
  const elm=add(eG(0),'rub',0,0,0,par);let last=-1;return{set(f){pist.position.y=.3*f;if(Math.abs(f-last)>.004){last=f;for(const m of elm.userData.m){m.geometry.dispose();m.geometry=eG(f)}}}}}
 function ramB(par,y0,kind){const{add}=S,bl=[];add(plate(5.6,3.4,1.0,.35),'steel',0,y0,0,par);add(plate(5.6,3.4,1.0,.35),'steel',0,y0+1.45,0,par);add(BX(5.6,1.1,.3),'steel',0,y0+.9,-1.55,par);add(BX(5.6,1.1,.3),'steel',0,y0+.9,1.55,par);
  for(const s of[-1,1]){for(let i=0;i<10;i++){const a=i/10*PI*2;add(aX(CY(.09,.3,8)),'chrome',s*4.0,y0+.9+Math.cos(a)*.95,Math.sin(a)*.95,par)}add(aX(RG(.95,.58,-.65,.65,40)),'steel',s*3.45,y0+.9,0,par);add(aX(RG(1.12,.4,-.12,.12,40)),'red',s*4.2,y0+.9,0,par);add(aX(CY(.72,1.2,36)),'red',s*4.95,y0+.9,0,par);
   const b=add(blade(kind),kind==='pipe'?'wh':'grey',s*2.5,y0+.45,0,par);b.scale.x=-s;const rod=add(aX(CY(.2,1,16)),'pipe',s*3.3,y0+.9,0,par);bl.push({b,rod,s})}
  {const gm=new THREE.InstancedMesh(new THREE.CylinderGeometry(.07,.07,.12,8),S.MT.chrome,2*15),o=new THREE.Object3D();let n=0;for(const sz of[-1,1])for(let ix=0;ix<5;ix++)for(let iz=0;iz<3;iz++){o.position.set(-2+ix*1,y0+.3+iz*.6,sz*1.72);o.rotation.set(PI/2,0,0);o.updateMatrix();gm.setMatrixAt(n++,o.matrix)}par.add(gm);
   const tr=new THREE.InstancedMesh(new THREE.CylinderGeometry(.05,.05,1.5,8),S.MT.black,2*8),o2=new THREE.Object3D();n=0;for(const sx of[-1,1])for(let i=0;i<8;i++){const a=i/8*PI*2;o2.position.set(sx*4.55,y0+.9+Math.cos(a)*.88,Math.sin(a)*.88);o2.rotation.set(0,0,PI/2);o2.updateMatrix();tr.setMatrixAt(n++,o2.matrix)}par.add(tr);
   const st=new THREE.InstancedMesh(new THREE.CylinderGeometry(.05,.05,.6,8),S.MT.chrome,18);n=0;for(let i=0;i<18;i++){const a=i/18*PI*2;o2.position.set(Math.cos(a)*1.25,y0+1.85+.3,Math.sin(a)*1.25);o2.rotation.set(0,0,0);o2.updateMatrix();st.setMatrixAt(n++,o2.matrix)}par.add(st)}
  return{set(f,closeX=.8){for(const u of bl){const x=lerp(2.5,closeX,f);u.b.position.x=u.s*x;const ox=u.b.position.x-u.s*.8,Ln=Math.abs(u.s*4.1-ox);u.rod.position.x=(u.s*4.1+ox)/2;u.rod.scale.x=Ln}}}}
 function bolts(par,rad,y,n,k=.11,h=.22){const m=new THREE.InstancedMesh(new THREE.CylinderGeometry(k,k,h,8),S.MT.chrome,n),o=new THREE.Object3D();for(let i=0;i<n;i++){const a=i/n*PI*2;o.position.set(Math.cos(a)*rad,y,Math.sin(a)*rad);o.rotation.y=a;o.updateMatrix();m.setMatrixAt(i,o.matrix)}par.add(m)}
 const cyc=(t,a,b,c,d)=>t<a?0:t<b?sm((t-a)/(b-a)):t<c?1:t<d?1-sm((t-c)/(d-c)):0;

 // ---------- cenas

 // ---------- modelos do Blender (GLB) com corte e fluido em shader
 const GLB={};const loadGLB=u=>GLB[u]||(GLB[u]=new Promise((res,rej)=>new GLTFLoader().load(u,g=>res(g.scene),undefined,rej)));
 function clipModel(src){const root=src.clone(true),ms=[];root.traverse(o=>{if(o.isMesh)ms.push(o)});ms.forEach(o=>{const m=o.material.clone();m.clippingPlanes=[S.clip];m.side=THREE.FrontSide;o.material=m;o.castShadow=false;
   const cap=new THREE.Mesh(o.geometry,new THREE.MeshBasicMaterial({color:m.color.clone().lerp(new THREE.Color(1,1,1),.22),side:THREE.BackSide,clippingPlanes:[S.clip]}));o.add(cap)});return root}
 const FL_VS='varying vec3 vN;varying vec3 vV;varying vec2 vUv;varying vec3 vW;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vec4 mv=viewMatrix*w;vN=normalize(mat3(modelMatrix)*normal);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}';
 const FL_FS=`uniform float uT,uK,uDir,uLen,uCut;uniform vec3 uA,uB;varying vec3 vN;varying vec3 vV;varying vec2 vUv;varying vec3 vW;
 float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
 float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p=p*2.07+vec2(3.1,1.7);a*=.5;}return v;}
 void main(){if(vW.z>uCut)discard;float s=vUv.y*uLen;vec2 q=vec2(vUv.x*6.2831*.9,s*.35-uT*uDir*1.8);float f=fbm(q*vec2(1.4,1.)+vec2(0.,fbm(q*2.+uT*.2)*1.5));float st=smoothstep(.3,.85,f);
  vec3 N=normalize(vN),V=normalize(vV);if(!gl_FrontFacing)N=-N;float fr=pow(1.-abs(dot(N,V)),2.2);vec3 L=normalize(vec3(.4,.8,.5));float sp=pow(max(dot(reflect(-L,N),V),0.),40.);
  vec3 col=mix(uA,uB,st)*(.55+.5*max(dot(N,L),0.))+vec3(.9,.95,1.)*sp*.8+uB*fr*.7;float bub=smoothstep(.94,.975,n(q*8.+vec2(5.,uT*uDir*3.)));col+=bub*.4;
  gl_FragColor=vec4(col,(.5+.3*st+fr*.3)*uK);}`;
 function fluid(par,r,y0,y1,A,B,dir){const g=new THREE.CylinderGeometry(r,r,y1-y0,40,1,true);const m=new THREE.ShaderMaterial({vertexShader:FL_VS,fragmentShader:FL_FS,transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{uT:{value:0},uK:{value:.85},uDir:{value:dir},uLen:{value:y1-y0},uCut:{value:0},uA:{value:new THREE.Color(A)},uB:{value:new THREE.Color(B)}}});const o=new THREE.Mesh(g,m);o.position.y=(y0+y1)/2;o.renderOrder=5;par.add(o);return o}
 function fitScene(){S.root.updateMatrixWorld(true);const bb=new THREE.Box3().setFromObject(cur.g),c=bb.getCenter(V(0,0,0)),sz=bb.getSize(V(0,0,0)),t=Math.tan(16*PI/180);S.root.position.set(-c.x,-c.y,-c.z);cur.dist=Math.max(sz.y*.5/t,Math.hypot(sz.x,sz.z)*.5/(t*1.6))*1.05}
 const nodes=g=>{const N={};g.traverse(o=>{if(o.name)N[o.name]=o});return N};
 const SC={};

 SC.bopstack={D:16,cam:{d:30,y:7,x:.4},lab:[[V(1.4,8.6,0),'Anular','Annular'],[V(2.4,5.85,0),'Gaveta de tubo','Pipe ram'],[V(2.4,1.65,0),'Gaveta cisalhante','Shear ram'],[V(.45,10.6,0),'Coluna','Drill pipe'],[V(1.0,-1.0,0),'Gás e óleo (influxo)','Gas and oil influx']],
  steps:[[0,'Poço sob controle: todos os preventores abertos.','Well under control: all preventers open.'],[1,'Kick: gás e óleo entram no poço e sobem pelo anular.','Kick: gas and oil enter the well and rise up the annulus.'],[2.5,'O anular fecha primeiro e segura o influxo.','The annular closes first and holds the influx.'],[5,'A gaveta de tubo fecha e trava, em seguida.','The pipe ram closes and locks next.'],[8,'Se preciso, a cisalhante corta a coluna: o trecho de cima sobe livre e o poço fica vedado.','If needed, the shear ram cuts the string: the upper part lifts free and the well is sealed.'],[12,'Poço controlado: os preventores reabrem.','Well controlled: the preventers reopen.']],
  sum:['A pilha de BOP reúne preventores anulares e de gaveta em série. Cada um é uma barreira independente, acionada por fluido hidráulico vindo dos pods. Num kick, o gás e o óleo que sobem do poço são contidos pela primeira barreira fechada.','The BOP stack combines annular and ram preventers in series. Each is an independent barrier, driven by hydraulic fluid from the pods. In a kick, the gas and oil rising from the well are held by the first closed barrier.'],
  build(){const g=new THREE.Group(),st={g,async:true,ready:false};S.root.add(g);
   loadGLB('assets/modelos/bop_sim.glb').then(src=>{if(cur!==st)return;const m=clipModel(src);g.add(m);const N=nodes(m);st.N=N;st.b={};for(const k in N)if(k.startsWith('mov_'))st.b[k]=N[k].position.clone();
    st.mud=fluid(g,.59,-1.6,10.6,0x9a5a28,0xe3963c,1);st.inner=fluid(g,.33,-1.6,12.4,0x2a6a9a,0x66d4ff,-1);
    // poço aberto abaixo da pilha (contexto do influxo)
    const hole=new THREE.Mesh(new THREE.CylinderGeometry(1.25,1.25,3.8,40,1,true),new THREE.MeshBasicMaterial({color:0x3a5266,transparent:true,opacity:.42,side:THREE.DoubleSide,depthWrite:false,clippingPlanes:[S.clip]}));hole.position.y=-1.4;g.add(hole);st.hole=hole;
    // partículas de gás (claras) e óleo (escuras)
    const mk=(n,col,op)=>{const im=new THREE.InstancedMesh(new THREE.SphereGeometry(1,10,8),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:op,clippingPlanes:[S.clip],depthWrite:false}),n);im.frustumCulled=false;im.renderOrder=7;g.add(im);return im};
    const NG=150,NO=100;st.NG=NG;st.pg=mk(NG,0xfff2a8,.92);st.po=mk(NO,0x3a1a08,.95);
    const rd=(a)=>{let x=Math.sin(a*127.1)*43758.5453;return x-Math.floor(x)};
    st.P=[...Array(NG+NO)].map((_,i)=>({g:i<NG,ph:rd(i+1),an:PI*1.02+rd(i+9)*PI*.96,r0:rd(i+17),v:i<NG?.16+rd(i+3)*.1:.1+rd(i+5)*.07,s:i<NG?.05+rd(i+7)*.05:.06+rd(i+11)*.06,w:rd(i+13)*6}));
    fitScene();st.ready=true});
   st.dum=new THREE.Object3D();
   st.upd=t=>{if(!st.ready)return;const N=st.N,bk=st.b,sh=cyc(t,8,9.6,11,12.5),pr=cyc(t,5,6.5,12,14),an=cyc(t,2,3.5,12,14);
    for(const i of[0,1,2]){const f=i===0?sh:pr;for(const[sd,sg]of[['L',-1],['R',1]]){const n=N['mov_blade'+sd+'_'+i];if(n)n.position.x=bk['mov_blade'+sd+'_'+i].x-sg*.75*f}}
    if(N.mov_elem){const k=lerp(1,.76,an);N.mov_elem.scale.set(k,1,k)}if(N.mov_pist)N.mov_pist.position.y=bk.mov_pist.y+.3*an;
    // trecho cortado: sobe reto pelo furo (sem deslocar para o lado, para não atravessar o corpo do BOP)
    const k2=sm((t-9.6)/1.2)*(t<11.8?1:1-sm((t-11.8)/.7));if(N.mov_pipeup)N.mov_pipeup.position.set(bk.mov_pipeup.x,bk.mov_pipeup.y+k2*1.8,bk.mov_pipeup.z);
    // influxo: sobe até a primeira barreira fechada
    const ks=sm((t-.8)/1.2)*(t<13?1:1-sm((t-13)/2));let cap=12;if(sh>.5)cap=1.15;else if(pr>.5)cap=3.15;else if(an>.5)cap=7.6;st.cap=lerp(st.cap===undefined?12:st.cap,cap,.12);
    const d=st.dum;st.P.forEach((q,i)=>{const u=((t*q.v+q.ph)%1),y0=-3.0,span=15.6;let y=y0+u*span;const top=st.cap-.12-(i%7)*.09;const stuck=y>top;if(stuck)y=top;
     const f=sm((y+.5)/1.1),R=lerp(.55+q.r0*.55,.51+q.r0*.07,f),a=q.an+Math.sin(t*1.3+q.w)*.22,sc=q.s*ks*lerp(2.7,1.1,f)*(stuck?1.25:1);
     d.position.set(Math.cos(a)*R,y,Math.sin(a)*R);d.scale.setScalar(Math.max(.0001,sc));d.updateMatrix();(q.g?st.pg:st.po).setMatrixAt(q.g?i:i-st.NG,d.matrix)});
    st.pg.instanceMatrix.needsUpdate=st.po.instanceMatrix.needsUpdate=true;
    const kv=ks*(1-.75*sm(an*3));for(const[m,k]of[[st.mud,.9*(1-.6*sm(kv*3))],[st.inner,.9]]){m.material.uniforms.uT.value=t;m.material.uniforms.uCut.value=cut?0:1e4;m.material.uniforms.uK.value=k;m.visible=k>.02}};
   st.upd0=st.upd;return st}};
 SC.riser={D:10,cam:{d:36,y:0,x:0},lab:[[V(1.5,4,0),'Barril externo','Outer barrel'],[V(1.1,1.2,0),'Barril interno (desliza)','Inner barrel (slides)'],[V(1.8,-7.2,0),'Junta flexível','Flex joint'],[V(2.0,0,.0),'Linhas auxiliares','Auxiliary lines']],
  steps:[[0,'O navio sobe: o barril interno entra no externo.','The vessel rises: the inner barrel slides into the outer one.'],[2.5,'As vedações seguram a lama, que sobe pelo riser.','Seals hold the mud, which rises up the riser.'],[5,'O navio desce: o barril interno sai.','The vessel drops: the inner barrel slides out.'],[7.5,'A junta flexível acompanha o desvio do navio.','The flex joint follows the vessel offset.']],
  sum:['A junta telescópica compensa o movimento vertical do navio sobre o riser; as vedações mantêm a lama dentro. A junta flexível absorve a inclinação perto do BOP.','The telescopic joint compensates vertical vessel motion over the riser while seals keep the mud in. The flex joint absorbs angular offset near the BOP.'],
  build(){const g=new THREE.Group(),st={g,async:true,ready:false};S.root.add(g);
   loadGLB('assets/modelos/riser_sim.glb').then(src=>{if(cur!==st)return;const m=clipModel(src);g.add(m);st.N=nodes(m);st.b=st.N.mov_inner.position.clone();
    st.mud=fluid(g,.84,-10,8,0x6a4220,0xc4803a,1);st.up=fluid(g,1.1,-10,8,0x4a3320,0x9a6a38,1);st.up.visible=false;fitScene();st.ready=true});
   st.upd=t=>{if(!st.ready)return;const h=Math.sin(t*2*PI/5)*1.4;st.N.mov_inner.position.y=st.b.y+h;const u=st.mud.material.uniforms;u.uT.value=t;u.uCut.value=cut?0:1e4;st.g.rotation.z=Math.sin(t*2*PI/10)*.015};
   return st}};

 
 // famílias por id do equipamento
 const MAP={h4:'bopstack',riser:'riser'};   // simulação 3D: só o BOP (e o kick) e o riser
 const VID={annular:['Z23KGzQHrAk','PviysC26s5A'],ram:['IMLgXaUBahE','5vvUZ_9aKGM'],shear:['-qMk9vvZTBE','iaUpcyiGyvQ'],bopstack:['q0pJrLmrJUw','ahaANaR4lBw'],mudpump:['UzOiSTCrzds','M9Vt-GpK3_Q'],topdrive:['01f1Ixa3mP0','wxElb2U3H8Y'],hoist:['ci_HIPe-4R0','wgUV5ov2jC0'],rotary:['cbuYwBSzCnI','YoUGs6w7MoE'],roughneck:['bNNf88Jm3e8','UbSYyFUk1WU'],heave:['7SpISYikSxk','j5DTVK4-EUk'],riser:['37qkypNILmM','4iGP2568NpY'],mpd:['GultWYfIR_0','o6MU_EN_QUc'],diverter:['vghxOcWJInA','a9dkaFU53Go'],cranes:['-RChaZJ2uKE','7k9pIfxX97Y'],shaker:['_f3iOeJ78zk','pNzeTLBpq0k']};
 const VIDK={valves:['sKdRv2hF8qY','FpnTdqBZfzI'],pods:['9hEl3HP-AhU','q0pJrLmrJUw'],structures:['ci_HIPe-4R0','a2pud3kD1e8'],tens:['4iGP2568NpY','a9dkaFU53Go']};

 function buildScene(k){if(cur){S.root.remove(cur.g);cur.g.traverse(o=>{if(o.geometry)o.geometry.dispose()})}const def=SC[k];S.root.position.set(0,0,0);cur=def.build();cur.def=def;cur.dist=cur.dist||30;if(!cur.async)fitScene()}
 function setTab(t){tab=t;const sm_=t==='sim'||t==='real';$('#opPho').hidden=t!=='pho';if(S){S.root.visible=t!=='real';S.realG.visible=t==='real'}$('#opV').classList.toggle('real',t==='real');if(t==='real')mountReal();if(t==='pho')galery();card.querySelectorAll('.opTabs button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===t));$('#opV').hidden=!sm_;$('#opVid').hidden=t!=='vid';const vd=$('#opVid');
  if(t==='vid'){const ids=video(pid);const id=ids[0];vd.innerHTML=id?`<iframe src="https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&hl=${L()==='pt'?'pt-BR':'en'}" title="${$('#opN').textContent}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe><small>${X('vh')}</small>`:'';}else vd.innerHTML=''}
 function mountReal(){const g=S.realG;for(const c of[...g.children]){g.remove(c);c.traverse(o=>{if(o.geometry)o.geometry.dispose()})}rl=null;let o=null;try{o=real(pid)}catch(e){}
  if(!o){tab='sim';setTab('sim');return}
  const put=obj=>{if(!S||tab!=='real')return;g.add(obj);const bb=new THREE.Box3().setFromObject(obj),c=bb.getCenter(V(0,0,0)),sz=bb.getSize(V(0,0,0));obj.position.sub(c);rl={r:Math.max(sz.x,sz.y,sz.z)*.5};rz=rl.r*4.1};
  if(typeof o==='string'){const ld=$('#opLoad');ld.textContent=L()==='pt'?'Carregando modelo 3D…':'Loading 3D model…';ld.hidden=false;loadGLB(o).then(src=>{ld.hidden=true;put(src.clone(true))}).catch(()=>{ld.textContent=L()==='pt'?'Não foi possível carregar o modelo.':'Could not load the model.'})}else put(o)}
 function galery(){const ph=photos(pid),b=$('#opPho');if(!ph.length){b.innerHTML='<small>'+(L()==='pt'?'Sem fotos oficiais para este item.':'No official photos for this item.')+'</small>';return}pk=Math.min(pk,ph.length-1);
  b.innerHTML=`<div class="opImg"><img alt="${$('#opN').textContent}" src="${ph[pk]}"><span>${X('credit')}</span></div>`+(ph.length>1?`<div class="opTh">${ph.map((u,i)=>`<button class="${i===pk?'on':''}" data-i="${i}"><img alt="" loading="lazy" src="${u}"></button>`).join('')}</div>`:'');b.querySelectorAll('.opTh button').forEach(x=>x.onclick=()=>{pk=+x.dataset.i;galery()})}
 function free(){if(!S)return;if(cur)cur.g.traverse(o=>{if(o.geometry)o.geometry.dispose()});cur=null;S.realG.traverse(o=>{if(o.geometry)o.geometry.dispose()});S.realG.clear();rl=null}   // mantém o renderer: criar/destruir contexto WebGL a cada abertura causava o piscar
 function arQrBlock(){const m=$('#opArMsg');if(!m)return;m.innerHTML=AR_IDS.has(pid)?`<span class="arqr-line"><img class="arqr" alt="${X('arQrAlt')}" src="assets/ar/qr/${pid}.png" width="104" height="104"><span>${X('arQr')}</span></span>`:''}
function texts(){arQrBlock();$('#opTr').textContent=X('real');$('#opTp').textContent=X('pho');const d=cur&&cur.def,i=L()==='pt'?0:1;$('#opTs').textContent=X('sim');$('#opTv').textContent=X('vid');$('#opSumT').textContent=X('sum');$('#opSheet').textContent=X('sheet');$('#opAr').textContent='▣ '+X('ar');$('#opYt').textContent=X('yt')+' ↗';$('#opCut').textContent=cut?X('cut'):X('ext');$('#opHint').textContent=X('drag');$('#opNote').textContent=X('illus')+(key==='bopstack'?' '+X('cisalhante'):'');
  $('#opMn').setAttribute('aria-label',X('min'));$('#opX').setAttribute('aria-label',X('close'));$('#opPlay').textContent=play?'⏸':'▶';$('#opPlay').setAttribute('aria-label',play?X('play'):X('playB'));
  if(d){$('#opSum').textContent=d.sum[i];$('#opSteps').innerHTML=d.steps.map((s,n)=>`<li data-n="${n}"><span>${n+1}</span>${s[1+i]}</li>`).join('');$('#opTicks').innerHTML=d.steps.map(s=>`<b style="left:${(s[0]/d.D*100).toFixed(1)}%"></b>`).join('');
   $('#opLabs').innerHTML=d.lab.map(l=>`<span class="opl">${l[1+i]}</span>`).join('')}}
 const labs=()=>[...card.querySelectorAll('.opl')];
 function place(){const a=anchor();const wr=innerWidth;let s='r';if(a&&a.on&&a.x>wr*.5)s='l';if(performance.now()-lastSide>800||!card.dataset.side){side=s;lastSide=performance.now();card.dataset.side=s}else s=side;card.classList.toggle('l',side==='l')}

 function api(){return{
  show(k,info){key=k;pid=info.id;if(!SC[k])return false;free();sim();card.dataset.mode='sim';$('#opTs').hidden=false;buildScene(k);T=0;play=true;speed=1;cut=true;S.clip.constant=0;az=.3;el=.15;w0=0;
   $('#opN').textContent=info.name;$('#opC').textContent=info.cat||'';$('#opSp').textContent='1×';$('#opCut').setAttribute('aria-pressed','true');texts();setTab('sim');
   const ids=video(pid);const yt=$('#opYt');yt.href=ids[0]?'https://www.youtube.com/watch?v='+ids[0]:'https://www.youtube.com/results?search_query='+encodeURIComponent('HMH '+info.name);yt.hidden=false;$('#opTv').hidden=!ids[0];$('#opTp').hidden=!photos(pid).length;$('#opTr').hidden=!real(pid);pk=0;
   card._rf=document.activeElement;{const cp=document.getElementById('copy');if(cp&&!cp.classList.contains('hide')){cp.classList.add('hide');hidCopy=true}}card.hidden=false;card.classList.remove('min');card.dataset.side='';place();open=true;svg.style.display='block';card.classList.remove('in');void card.offsetWidth;card.classList.add('in');{const h=$('#opN');h.tabIndex=-1;try{h.focus({preventScroll:true})}catch(e){}}return true},
  showModel(info){key=null;pid=info.id;free();sim();cur=null;T=0;az=.3;el=.15;w0=0;card.dataset.mode='model';
   $('#opN').textContent=info.name;$('#opC').textContent=info.cat||'';texts();$('#opSum').textContent=info.desc||'';$('#opSteps').innerHTML='';$('#opTs').hidden=true;$('#opSumT').textContent=L()==='pt'?'Sobre o equipamento':'About the equipment';$('#opNote').textContent=X('illusM');
   const ids=video(pid);const yt=$('#opYt');yt.href=ids[0]?'https://www.youtube.com/watch?v='+ids[0]:'https://www.youtube.com/results?search_query='+encodeURIComponent('HMH '+info.name);yt.hidden=false;$('#opTv').hidden=!ids[0];$('#opTp').hidden=!photos(pid).length;$('#opTr').hidden=false;pk=0;
   card._rf=document.activeElement;{const cp=document.getElementById('copy');if(cp&&!cp.classList.contains('hide')){cp.classList.add('hide');hidCopy=true}}card.hidden=false;card.classList.remove('min');card.dataset.side='';place();open=true;svg.style.display='block';card.classList.remove('in');void card.offsetWidth;card.classList.add('in');{const h=$('#opN');h.tabIndex=-1;try{h.focus({preventScroll:true})}catch(e){}}setTab('real');return true},
  hasModel:id=>!!real(id),
  has:id=>!!SC[MAP[id]],key:id=>MAP[id],close(){const rf=card._rf;if(hidCopy){document.getElementById('copy')?.classList.remove('hide');hidCopy=false}card.hidden=true;if(rf&&rf.focus&&document.contains(rf))try{rf.focus({preventScroll:true})}catch(e){};svg.style.display='none';open=false;$('#opVid').innerHTML=''},
  isOpen:()=>open,retext:texts,
  frame(dt,now){if(!open||!S)return;place();const min=card.classList.contains('min');if(document.hidden)return;
   const d=cur&&cur.def;if(play&&tab==='sim'&&d)T=(T+dt*speed)%d.D;
   if(tab==='real'&&!min&&rl){const cv=S.cv,vw=$('#opV').clientWidth;if(vw&&vw!==w0){w0=vw;h0=Math.round(vw*10/16);S.r.setSize(vw,h0,false);cv.style.height=h0+'px';S.cam.aspect=vw/h0;S.cam.updateProjectionMatrix()}const a2=az+(drag||reduced?0:now*.0003),cp=Math.cos(el+.1);S.cam.position.set(Math.sin(a2)*cp*rz,Math.sin(el+.1)*rz,Math.cos(a2)*cp*rz);S.cam.lookAt(0,0,0);S.r.render(S.sc,S.cam)}
   if(tab==='sim'&&!min&&cur&&d){const cv=S.cv,vw=$('#opV').clientWidth;if(vw&&(vw!==w0)){w0=vw;h0=Math.round(vw*10/16);S.r.setSize(vw,h0,false);cv.style.height=h0+'px';S.cam.aspect=vw/h0;S.cam.updateProjectionMatrix()}
    cur.upd(T);const a2=az+(drag||reduced?0:Math.sin(now*.00018)*.18),cp=Math.cos(el),dd=cur.dist;S.cam.position.set(Math.sin(a2)*cp*dd,Math.sin(el)*dd,Math.cos(a2)*cp*dd);S.cam.lookAt(0,0,0);S.r.render(S.sc,S.cam);
    const lb=labs();d.lab.forEach((l,i)=>{const p=l[0].clone();S.root.localToWorld(p);p.project(S.cam);const e=lb[i];if(e){e.style.transform=`translate(${((p.x*.5+.5)*w0).toFixed(0)}px,${((-p.y*.5+.5)*h0).toFixed(0)}px) translate(10px,-50%)`;e.style.opacity=p.z<1?1:0}});
    const f=T/d.D;$('#opFill').style.width=(f*100).toFixed(1)+'%';let sn=0;d.steps.forEach((s,n)=>{if(T>=s[0])sn=n});card.querySelectorAll('.opSteps li').forEach((li,n)=>li.classList.toggle('on',n===sn)); card.querySelectorAll('.opSteps li').forEach((li,n)=>li.classList.toggle('ok',n<sn))}
   // linha ligada ao equipamento
   const a=anchor(),cr=card.getBoundingClientRect();if(!a||!a.on||card.hidden){svg.style.opacity=0;return}svg.style.opacity=1;
   const left=a.x<cr.left,right=a.x>cr.right;let ex,ey;if(left){ex=cr.left;ey=clamp(a.y,cr.top+34,cr.bottom-34)}else if(right){ex=cr.right;ey=clamp(a.y,cr.top+34,cr.bottom-34)}else{ex=clamp(a.x,cr.left+30,cr.right-30);ey=a.y<cr.top?cr.top:cr.bottom}
   const mx=left||right?(a.x+ex)/2:a.x;P.setAttribute('d',left||right?`M${a.x.toFixed(1)} ${a.y.toFixed(1)} L${mx.toFixed(1)} ${a.y.toFixed(1)} L${ex.toFixed(1)} ${ey.toFixed(1)}`:`M${a.x.toFixed(1)} ${a.y.toFixed(1)} L${a.x.toFixed(1)} ${((a.y+ey)/2).toFixed(1)} L${ex.toFixed(1)} ${ey.toFixed(1)}`);
   D.setAttribute('cx',a.x);D.setAttribute('cy',a.y);RR.setAttribute('cx',a.x);RR.setAttribute('cy',a.y)}}}
 const o=api();
 // controles
 $('#opEx').textContent='⤢';$('#opEx').setAttribute('aria-label',X('big'));$('#opEx').title=X('big');$('#opEx').onclick=()=>{const b=card.classList.toggle('big');$('#opEx').textContent=b?'⤡':'⤢';const t=X(b?'small':'big');$('#opEx').setAttribute('aria-label',t);$('#opEx').title=t};$('#opAr').onclick=()=>{$('#opArMsg').scrollIntoView({block:'nearest',behavior:'smooth'})};
 $('#opX').onclick=()=>o.close();$('#opMn').onclick=()=>{const m=card.classList.toggle('min');$('#opMn').textContent=m?'+':'–';$('#opMn').setAttribute('aria-label',m?X('exp'):X('min'))};$('#opMn').textContent='–';$('#opX').textContent='×';
 $('#opPlay').onclick=()=>{play=!play;texts()};$('#opSp').onclick=()=>{speed=speed===1?2:speed===2?.5:1;$('#opSp').textContent=(speed===.5?'.5':speed)+'×'};
 $('#opCut').onclick=()=>{cut=!cut;S.clip.constant=cut?0:1e5;$('#opCut').setAttribute('aria-pressed',cut);$('#opCut').textContent=cut?X('cut'):X('ext')};
 $('#opTl').addEventListener('pointerdown',e=>{const r=e.currentTarget.getBoundingClientRect();T=clamp((e.clientX-r.left)/r.width,0,.999)*cur.def.D});
 card.querySelectorAll('.opTabs button').forEach(b=>b.onclick=()=>setTab(b.dataset.t));$('#opSheet').onclick=()=>sheet(pid);
 addEventListener('keydown',e=>{if(e.key==='Escape'&&open&&!card.hidden){o.close()}});
 return o}
