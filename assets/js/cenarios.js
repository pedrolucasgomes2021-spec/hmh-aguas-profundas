// Cenários internos: a câmera "entra" no equipamento e mostra a operação completa em 3D, com etapas,
// dados ao vivo, equipamentos envolvidos e a resposta ao clima (clima.js).
// Leve de propósito: usa o renderer da cena principal (a cena principal fica pausada enquanto o cenário está aberto),
// cada cenário é montado só na primeira abertura, sem sombras e sem pós-processamento.
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';   // modelos comprimidos (EXT_meshopt_compression)
import {M,G,add,clamp,lerp,smooth,V,UP,wave,SEA,tubeG,beamG,mergeMesh,ZR,dotTex} from './kit.js';
import {makeTopDrive,makeRoughneck,makeDrawworks,makeRotary,makeMudPump,makeDerrick,makeTensioner,makeRiserJoint,makeDiverter,makeGateValve} from './modelos.js';
import {WXU,makeRain,wxIcon} from './clima.js';

const PI=Math.PI,ph=(T,a,b)=>smooth((T-a)/(b-a)),win=(T,a,b)=>T>=a&&T<b,nz=t=>Math.sin(t*1.7)*.6+Math.sin(t*4.3)*.3+Math.sin(t*9.1)*.1;
const UI={
 pt:{voltar:'Voltar à sonda',etapas:'Etapas',dados:'Dados ao vivo',clima:'Clima',equip:'Equipamentos nesta operação',auto:'Câmera automática',livre:'Câmera livre',mov:'Movimento do navio',
  play:'Pausar',playB:'Reproduzir',vel:'Velocidade',prep:'Preparando o cenário…',dica:'Arraste para girar · role para aproximar',ilus:'Simulação ilustrativa: valores e tempos típicos, não são dados de um equipamento real.',
  ok:'Operando normalmente',warn:'Operação restrita pelo clima',stop:'Operação suspensa pelo clima',cen:'Cenário interno',menu:'Operações',menuSub:'Entre no equipamento e veja a operação por dentro',kick:'Controle de poço (kick)',kickD:'Kick detectado, BOP fecha o poço e o influxo é circulado.',ver:'Ver',info:'Abrir ficha'},
 en:{voltar:'Back to the rig',etapas:'Steps',dados:'Live data',clima:'Weather',equip:'Equipment in this operation',auto:'Auto camera',livre:'Free camera',mov:'Vessel motion',
  play:'Pause',playB:'Play',vel:'Speed',prep:'Preparing the scene…',dica:'Drag to rotate · scroll to zoom',ilus:'Illustrative simulation: typical values and timings, not data from a real unit.',
  ok:'Operating normally',warn:'Operation restricted by weather',stop:'Operation suspended by weather',cen:'Inside view',menu:'Operations',menuSub:'Step inside the equipment and see the operation',kick:'Well control (kick)',kickD:'Kick detected, the BOP shuts the well and the influx is circulated out.',ver:'Open',info:'Open sheet'}};

/* ---------- modelos fiéis às fotos (os mesmos GLB da aba "Modelo HMH" e do AR, versão leve) ----------
   Cada cenário monta primeiro as peças procedurais e troca pelo modelo real quando ele carrega; se falhar, fica o procedural. */
const GLL=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),GLC={};
const glbUrl=n=>n.includes('/')?n:'assets/ar/modelos/'+n+'.glb';
function loadGLB(n){const u=glbUrl(n);return GLC[u]??=GLL.loadAsync(u).then(g=>g.scene)}
// clona, gira, escala pela medida pedida (h altura, l maior lado horizontal, w largura em x) e apoia a base em y=0, centrado em x e z
async function real(n,o){const m=(await loadGLB(n)).clone(true);const w=new THREE.Group();m.rotation.y=o.ry||0;w.add(m);m.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(m),sz=b.getSize(V());
 const s=o.h?o.h/sz.y:o.l?o.l/Math.max(sz.x,sz.z):o.w/sz.x;m.scale.multiplyScalar(s);m.updateMatrixWorld(true);b.setFromObject(m);m.position.set(-(b.min.x+b.max.x)/2,-b.min.y,-(b.min.z+b.max.z)/2);
 m.traverse(c=>{if(c.isMesh&&c.material&&o.emis){c.material=c.material.clone();o.emis.push(c.material)}});w.userData.size=b.getSize(V());return w}
// troca as peças procedurais de um grupo pelo modelo real
function swap(group,w,y=0){group.children.forEach(c=>c.visible=false);w.position.y=y;group.add(w);return w}
const settle=(arr,ms=15000)=>Promise.race([Promise.allSettled(arr),new Promise(r=>setTimeout(r,ms))]);

/* ---------- materiais e peças próprias dos cenários ---------- */
const stripes=(()=>{const c=document.createElement('canvas');c.width=64;c.height=4;const g=c.getContext('2d');g.fillStyle='#b9c1c7';g.fillRect(0,0,64,4);g.fillStyle='#59626a';g.fillRect(0,0,9,4);g.fillStyle='#e3e8eb';g.fillRect(30,0,4,4);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(3,1);return t})();
const MP={pipe:new THREE.MeshStandardMaterial({map:stripes,metalness:.82,roughness:.32}),glow:new THREE.MeshBasicMaterial({color:0x59d0ff,transparent:true,opacity:.55,depthWrite:false}),
 floor:new THREE.MeshStandardMaterial({color:0x6a716f,roughness:.8,metalness:.4}),wall:new THREE.MeshStandardMaterial({color:0xd9dee1,roughness:.75,metalness:.2}),
 hullR:new THREE.MeshStandardMaterial({color:0x8a2023,roughness:.6,metalness:.25}),hullB:new THREE.MeshStandardMaterial({color:0x1b2e4f,roughness:.55,metalness:.25}),
 lamp:new THREE.MeshBasicMaterial({color:0xfff4d6}),dial:new THREE.MeshStandardMaterial({color:0xf4f6f7,roughness:.4}),needle:new THREE.MeshBasicMaterial({color:0xd8202a}),
 green:new THREE.MeshStandardMaterial({color:0x2c7a4b,roughness:.7}),ghost:new THREE.MeshPhysicalMaterial({color:0x9fd8ff,transparent:true,opacity:.16,roughness:.1,depthWrite:false,side:THREE.DoubleSide})};
function pipeSet(parent,r=.24,JS=8.733,mat=MP.pipe){const pipe=add(parent,G.cyl(r,r,1,18),mat);const tj=new THREE.InstancedMesh(G.cyl(r*1.4,r*1.4,.55,18),M.steel,8);parent.add(tj);const d=new THREE.Object3D();
 return {pipe,set(top,bot,rot=0){const h=Math.max(.05,top-bot);pipe.position.y=(top+bot)/2;pipe.scale.y=h;pipe.rotation.y=rot;pipe.visible=top>bot+.05;let n=0;for(let k=0;k<8;k++){const y=top-k*JS;if(y<bot)break;d.position.set(pipe.position.x,y-.15,pipe.position.z);d.updateMatrix();tj.setMatrixAt(n++,d.matrix)}tj.count=n;tj.instanceMatrix.needsUpdate=true},
  at(x,z){pipe.position.x=x;pipe.position.z=z}}}
// segmento cilíndrico entre dois pontos, reposicionável a cada quadro
function rod(parent,r,mat,seg=10){const m=add(parent,G.cyl(r,r,1,seg),mat);const a=new THREE.Vector3();return {m,set(p,q){a.subVectors(q,p);const L=a.length();m.position.copy(p).addScaledVector(a,.5);m.scale.set(1,Math.max(.001,L),1);m.quaternion.setFromUnitVectors(UP,a.normalize())}}}
// partículas de fluxo ao longo de curvas (cor por trilha)
function flow(parent,paths){let n=0;paths.forEach(p=>n+=p.n);const pos=new Float32Array(n*3),col=new Float32Array(n*3),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));
 const m=new THREE.PointsMaterial({size:.7,map:dotTex,vertexColors:true,transparent:true,depthWrite:false,sizeAttenuation:true,opacity:.95});const pts=new THREE.Points(g,m);pts.frustumCulled=false;pts.renderOrder=5;parent.add(pts);
 const S=[];let i0=0;paths.forEach(p=>{const c=new THREE.Color(p.c);for(let i=0;i<p.n;i++){S.push({p,u:i/p.n,j:(Math.random()-.5)*(p.j||0),k:(Math.random()-.5)*(p.j||0)});col.set([c.r,c.g,c.b],(i0+i)*3)}i0+=p.n});
 const v=new THREE.Vector3();
 return {pts,update(dt){S.forEach((s,i)=>{const p=s.p;s.u=(s.u+dt*p.v/p.len)%1;if(p.on<=.01){pos[i*3+1]=-999;return}p.curve.getPointAt(s.u,v);pos[i*3]=v.x+s.j;pos[i*3+1]=v.y;pos[i*3+2]=v.z+s.k;
   if(p.on<1&&((i*7919)%100)/100>p.on)pos[i*3+1]=-999});g.attributes.position.needsUpdate=true}}}
const path=(pts,c,n,v,j)=>{const curve=new THREE.CatmullRomCurve3(pts.map(p=>V(...p)),false,'centripetal');return {curve,len:curve.getLength(),c,n,v,on:1,j}};
// mostrador de pressão 3D (ponteiro gira com o valor)
function gauge(parent,pos,ry=0){const g=new THREE.Group();g.position.set(...pos);g.rotation.y=ry;parent.add(g);add(g,G.cyl(.5,.5,.18,28),M.dark,[0,0,0],[PI/2,0,0]);add(g,G.cyl(.44,.44,.2,28),MP.dial,[0,0,.02],[PI/2,0,0]);
 const n=new THREE.Group();n.position.z=.14;g.add(n);add(n,G.box(.05,.36,.03),MP.needle,[0,.16,0]);return {g,set:k=>{n.rotation.z=lerp(2.3,-2.3,clamp(k))}}}

/* =====================================================================
   Cenário 1: operações de top drive (conexão de seção e perfuração)
   ===================================================================== */
function sceneTopDrive(){
 const rig=new THREE.Group();
 add(rig,G.box(70,1.2,34),MP.floor,[0,8,0]);
 {const sub=[];for(const[x,z]of[[9,9],[9,-9],[-9,-9],[-9,9]])sub.push(beamG(V(x,8,z),V(x,16,z),.5,8));for(const[a,b]of[[[9,9],[9,-9]],[[-9,9],[-9,-9]],[[9,-9],[-9,-9]],[[9,9],[-9,9]]])sub.push(beamG(V(a[0],8.4,a[1]),V(b[0],15.6,b[1]),.25,6),beamG(V(a[0],15.6,a[1]),V(b[0],8.4,b[1]),.25,6));rig.add(mergeMesh(sub,M.grey))}
 add(rig,G.rbox(22,1,22,.15),MP.floor,[0,16.5,0]);
 for(const[x,z,w,d]of[[0,-10.6,21,.3],[-10.6,0,.3,21]])add(rig,G.box(w,6,d),M.wall,[x,20,z]);
 add(rig,G.cyl(1.6,1.6,10,40),M.red,[0,11,0]);   // diverter e riser abaixo da mesa
 const der=makeDerrick();der.position.y=17;rig.add(der);
 const rot=makeRotary();rot.position.set(0,17,0);rig.add(rot);
 const dw=makeDrawworks();dw.position.set(-5,17,6.5);rig.add(dw);
 const rn=makeRoughneck();rn.rotation.y=PI*.75;rig.add(rn);
 // cabine do sondador
 add(rig,G.rbox(5,3.6,4,.25),M.white,[6.5,18.8,-7]);add(rig,G.box(4.6,1.3,.06),M.glass,[6.5,19.4,-4.98]);
 // compensador na coroa (CMC): bloco de coroa móvel
 const crown=new THREE.Group();crown.position.y=64;rig.add(crown);add(crown,G.rbox(4.2,1.2,2.2,.2),M.yellow,[0,-.2,0]);for(const x of[-1.3,1.3])add(crown,G.cyl(.32,.32,3.2,16),M.chrome,[x,1.4,0]);
 const td=makeTopDrive();rig.add(td);
 const wires=[0,1,2,3].map(()=>rod(rig,.06,M.black,6));
 const str=pipeSet(rig);const stand=pipeSet(rig);
 // seções no estaleiro (setback) e racker
 {const n=10,im=new THREE.InstancedMesh(G.cyl(.24,.24,26,12),MP.pipe,n),d=new THREE.Object3D();for(let i=0;i<n;i++){d.position.set(-6.6+(i%5)*.62,17.3+13,-3.2-Math.floor(i/5)*.7);d.updateMatrix();im.setMatrixAt(i,d.matrix)}rig.add(im);
  add(rig,G.box(5,.3,3.2),M.yellow,[-5.4,40,-3.6]);for(let i=0;i<6;i++)add(rig,G.box(.12,.32,3),M.dark,[-7.6+i*.62,40.2,-3.6])}
 const col=add(rig,G.rbox(1,30,1,.12),M.yellow,[-8.8,32,-.6]);const arms=[rod(rig,.22,M.yellow),rod(rig,.22,M.yellow)];
 // cunhas (slips)
 const slips=new THREE.Group();slips.position.y=18.3;rig.add(slips);for(let i=0;i<3;i++){const a=i*PI*2/3;add(slips,G.rbox(.5,.9,.32,.06),M.dark,[Math.cos(a)*.48,0,Math.sin(a)*.48],[0,-a,0])}
 // mangueira de lama (kelly hose) em segmentos
 const hose=Array.from({length:10},()=>rod(rig,.16,M.rubber,8));add(rig,G.cyl(.2,.2,23,10),M.red,[-6.2,28.5,6.2]);
 const lamps=[];for(const[x,y,z]of[[6,30,6],[-6,30,-6],[6,44,-5],[-5,22,6]]){lamps.push(add(rig,G.sph(.32,10),MP.lamp,[x,y,z]))}
 const at=(o,x,y,z)=>{const a=new THREE.Object3D();a.position.set(x,y,z);o.add(a);return a};
 const labs=[[at(td,0,5.5,1.2),'Top drive','Top drive'],[at(rn,1.6,3.6,0),'Iron roughneck','Iron roughneck'],[at(dw,0,3.6,0),'Drawworks','Drawworks'],[at(rig,0,18.6,1.6),'Mesa rotativa e cunhas','Rotary table and slips'],[at(crown,0,1.2,1.2),'Compensador (CMC)','Crown compensator (CMC)'],[at(col,0,8,0),'Racker de tubos','Pipe racker'],[at(rig,-5,46,-3.4),'Estaleiro de seções','Stand setback']];
 const JS=26.2/3,STL=26,STICK=20.7,PARK=V(5.9,17,5.9),WORK=V(3.18,17,3.18),SB=V(-5.2,17.3,-4.6);let TDH=8,HOSE=8.6,SLY=18.3;
 const ready=settle([
  real('topdrive',{h:11.5,ry:PI/2}).then(w=>{swap(td,w,-.3);TDH=w.userData.size.y-.3;HOSE=TDH*.5}),
  real('roughneck',{w:3.6}).then(w=>{swap(rn,w,1.6);add(rn,G.rbox(2.6,1.6,2.2,.12),M.dark,[0,.8,-.4]);rn.rotation.y=-.75*PI;PARK.set(5.4,17,5.4);WORK.set(1.2,17,1.2)}),
  real('drawworks',{l:7.2,ry:PI/2}).then(w=>{swap(dw,w);dw.position.set(-6.4,17,7.2)}),
  real('rotary',{l:5.2}).then(w=>{swap(rot,w,-.05);w.position.z=-1.55;SLY=18.45})]);
 const S={c:40.7,tdc:41,sx:SB.x,sz:SB.z,sb:SB.y,rot:0,srot:0,slip:0,crown:0,rn:0,arm:0};
 let rot0=0,srot0=0;
 return {rig,labs,ready,dbg:{rn,td,dw,rot},dist:34,tgt:V(0,30,0),cams:[[V(30,27,13),V(0,26,0)],[V(6.2,23,-5.6),V(1.2,19.8,1.2)],[V(19,58,5),V(0,47,0)],[V(4,30,24),V(-4,30,-3)]],
  update(T,c){const{dt,heave,mode}=c,o=c.out;let cx,tdc,sx=SB.x,sz=SB.z,sb=SB.y,slip=0,rnk=0,arm=0,rpm=0,spin=0,torque=1+Math.abs(nz(c.t))*.6,pump=0,att=1,hook=46,wob=0,joined=false;
   if(mode==='stop'){   // aguardando o tempo: broca fora do fundo, coluna pendurada com compensador ativo
    cx=lerp(30,32,ph(T,0,6));tdc=cx;pump=lerp(1,.35,ph(T,0,5));rpm=lerp(40,0,ph(T,0,4));hook=lerp(185,198,ph(T,0,6));
   }else{
    if(T<14){cx=lerp(40.7,STICK,T/14);rpm=120;pump=1;wob=15;hook=185}
    else if(T<19){cx=STICK+.5*ph(T,14,15.5)-.5*ph(T,17,19);pump=1-ph(T,14,15.5);slip=ph(T,17,19);hook=lerp(185,46,ph(T,17,19))}
    else if(T<44){cx=STICK;slip=1;att=0;hook=46}
    else if(T<50){cx=46.7+.5*ph(T,47,48);slip=1-ph(T,46,47);pump=ph(T,47,50);joined=true;hook=lerp(46,190,ph(T,46,47))}
    else{cx=lerp(46.7,40.7,(T-50)/10)+.5*(1-ph(T,50,51));rpm=120*ph(T,50,51);pump=1;wob=15*ph(T,50,51);hook=lerp(190,185,ph(T,50,51));joined=true}
    if(T>=42)joined=true;
    // top drive
    if(T<19)tdc=cx;else if(T<27)tdc=lerp(STICK,47.6,ph(T,21,27))+.3*ph(T,19,21);else if(T<35)tdc=lerp(47.6,46.7,ph(T,33,35));else tdc=cx>46?cx:46.7;
    if(T>=50)tdc=cx;
    // seção nova: do estaleiro até o poço
    if(T>=26&&T<35){const k1=ph(T,27,28.5),k2=ph(T,28.5,32.5),k3=ph(T,32.5,34);sb=lerp(SB.y,21.6,k1)-.9*k3;sx=lerp(SB.x,0,k2);sz=lerp(SB.z,0,k2);arm=ph(T,26,27)}
    else if(T>=35&&T<44){sx=0;sz=0;sb=STICK;arm=1-ph(T,35,36)}
    rnk=ph(T,35,37)-ph(T,42,44);
    if(win(T,19,21))rpm=-12;if(win(T,37,40)){spin=60}if(win(T,40,42)){torque=lerp(10,52,ph(T,40,41.4))}if(win(T,44,46)){rpm=30;torque=lerp(8,48,ph(T,44,45.6))}
    if(rpm>100)torque=26+nz(c.t*1.3)*2.4;
    if(T>=33&&T<44)hook=47;
    if(mode==='warn'){rpm*=rpm>100?.85:1;wob*=.8}
   }
   // compensação de heave: com a coluna presa ao top drive, o conjunto fica parado em relação ao fundo (o navio sobe e desce em volta)
   const comp=att&&slip<.5?-heave:0;S.crown+=(comp-S.crown)*(1-Math.exp(-dt*6));
   const k=1-Math.exp(-dt*10);S.c+=(cx-S.c)*k;S.tdc+=(tdc-S.tdc)*k;S.sx+=(sx-S.sx)*k;S.sz+=(sz-S.sz)*k;S.sb+=(sb-S.sb)*k;S.slip+=(slip-S.slip)*k;S.rn+=(rnk-S.rn)*k;S.arm+=(arm-S.arm)*k;
   rot0+=dt*rpm/60*PI*2;srot0+=dt*spin/60*PI*2;
   const off=S.crown;td.position.set(0,S.tdc+.3+off,0);crown.position.y=64+off*.5;
   const topS=joined?S.tdc+off:S.c+(slip<.5?off:0);str.set(topS,16.6,rot0);
   stand.at(S.sx,S.sz);const sv=!joined&&mode!=='stop';if(sv)stand.set(S.sb+STL,S.sb,srot0);else stand.set(0,1);
   slips.visible=S.slip>.02;slips.position.y=SLY+(1-S.slip)*1.4;slips.scale.setScalar(.6+.4*S.slip);
   rn.position.lerpVectors(PARK,WORK,S.rn);
   wires.forEach((w,i)=>w.set(V(i<2?-.6:.6,64+off*.5,i%2?-.6:.6),V(i<2?-.6:.6,S.tdc+TDH+off,i%2?-.6:.6)));
   dw.userData.drum.rotation.x=-(S.tdc+off)*.7;
   // racker: braços até a seção quando ela está em movimento
   [3.7,22.7].forEach((h,i)=>{const y=Math.min(45,S.sb+h);arms[i].set(V(-8.8,y,-.6),V(lerp(-7.9,S.sx,S.arm),y,lerp(-1.2,S.sz,S.arm)))});
   // mangueira: catenária entre o tubo bengala e o pescoço de ganso do top drive
   {const A=V(-6.2,40,6.2),B=V(0,S.tdc+off+HOSE,1.6),sag=Math.max(2,12-A.distanceTo(B)*.3);let pv=A.clone();for(let i=0;i<10;i++){const u=(i+1)/10,q=A.clone().lerp(B,u);q.y-=Math.sin(u*PI)*sag;q.z+=Math.sin(u*PI)*1.5;hose[i].set(pv,q);pv=q}}
   lamps.forEach(l=>l.visible=c.night>.3||c.wc>.5);
   // dados
   const sp=pump*(235+nz(c.t*.7)*3);
   Object.assign(o,{rpm:Math.max(0,rpm)+(rpm>0?nz(c.t*2)*1.5:0),torque,hook:hook+(att&&slip<.5?heave*1.2*(mode==='stop'?.4:.15):0)+nz(c.t)*.6,wob:Math.max(0,wob+heave*(mode==='warn'?1.6:.4)+(wob?nz(c.t*1.1)*.5:0)),spp:sp,bloco:S.tdc+off-17,comp:-off});
  }}}

/* =====================================================================
   Cenário 2: MPD (perfuração com pressão gerenciada)
   ===================================================================== */
function sceneMPD(){
 const rig=new THREE.Group();const clip=new THREE.Plane(V(0,0,-1),0);
 for(const x of[-1,1])add(rig,G.box(30,1,30),MP.floor,[x*21,8.6,0]);
 add(rig,G.box(12,1,12),MP.floor,[0,8.6,-21]);
 add(rig,G.rbox(22,1,22,.15),MP.floor,[0,16.6,0]);for(const[x,z]of[[9,9],[9,-9],[-9,-9],[-9,9]])add(rig,G.cyl(.5,.5,8,12),M.grey,[x,12.6,z]);
 // coluna de riser em corte: diverter, junta MPD (RCD + flow spool), barril
 const colG=new THREE.Group();rig.add(colG);
 const dv=makeDiverter();dv.position.y=12.9;colG.add(dv);
 const mj=makeRiserJoint(14,{mpd:true});mj.position.y=5.6;mj.rotation.y=0;colG.add(mj);
 add(colG,G.cyl(1.3,1.3,30,40),M.white,[0,-16.4,0]);add(colG,G.cyl(1.32,1.32,.6,40),M.dark,[0,-4,0]);
 colG.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.clippingPlanes=[clip];o.material.side=THREE.DoubleSide}});
 const pm=MP.pipe.clone();pm.clippingPlanes=[clip];pm.side=THREE.DoubleSide;const pipe=pipeSet(rig,.24,9.4,pm);
 // manifold MPD com chokes, medidor Coriolis, separador (MGS) e peneiras
 const mf=new THREE.Group();mf.position.set(12,9.1,0);rig.add(mf);add(mf,G.rbox(7,.4,4.4,.1),M.yellow,[0,.2,0]);{const fr=[];for(const[x,z]of[[-3.3,-2],[3.3,-2],[-3.3,2],[3.3,2]])fr.push(beamG(V(x,.4,z),V(x,4.6,z),.12,6));fr.push(beamG(V(-3.3,4.6,-2),V(3.3,4.6,-2),.12,6),beamG(V(-3.3,4.6,2),V(3.3,4.6,2),.12,6));mf.add(mergeMesh(fr,M.yellow))}
 add(mf,G.cyl(.3,.3,6.6,14),M.grey,[0,1.4,-.9],ZR);add(mf,G.cyl(.3,.3,6.6,14),M.grey,[0,1.4,.9],ZR);
 const chokeM=M.red.clone();const chokes=[],vals=[],emis=[];for(const x of[-1.9,0,1.9]){const v=makeGateValve(chokeM,.42);v.position.set(x,2.4,0);mf.add(v);vals.push(v);const a=add(mf,G.cyl(.12,.12,1.2,10),M.chrome,[x,3.9,0]);chokes.push(a)}
 const ready=settle([...vals.map((v,i)=>real('valves',{h:2.4,emis:i===1?emis:null}).then(w=>{const g=new THREE.Group();g.position.copy(v.position).setY(1.55);mf.add(g);g.add(w);v.visible=false;chokes[i].visible=false})),
  real('assets/modelos/diversor.glb',{w:8.4}).then(w=>{swap(dv,w,-.9)})]);
 const cor=new THREE.Group();cor.position.set(18.5,9.1,0);rig.add(cor);add(cor,G.rbox(2.2,.5,2.6,.1),M.dark,[0,.25,0]);add(cor,new THREE.TorusGeometry(1.1,.2,12,32,PI),M.steel,[0,2.4,0],[0,PI/2,0]);for(const z of[-1.1,1.1])add(cor,G.cyl(.2,.2,1.9,12),M.steel,[0,1.4,z]);add(cor,G.rbox(.9,.7,.5,.08),M.blue,[0,3.7,0]);
 const mgs=new THREE.Group();mgs.position.set(25,9.1,-5);rig.add(mgs);add(mgs,G.cyl(1.5,1.5,8,32),M.white,[0,4.5,0]);add(mgs,G.sph(1.5,24),M.white,[0,8.5,0]);add(mgs,G.cyl(.2,.2,22,10),M.grey,[0,20,0]);for(const[x,z]of[[1.1,1.1],[-1.1,1.1],[1.1,-1.1],[-1.1,-1.1]])add(mgs,G.cyl(.15,.15,1.2,8),M.dark,[x,.6,z]);
 const sh=new THREE.Group();sh.position.set(25,9.1,5);rig.add(sh);add(sh,G.rbox(4.6,1.6,3,.12),M.blue,[0,.8,0]);const scr=add(sh,G.box(4.2,.12,2.6),M.dark,[0,2,0],[0,0,-.12]);add(sh,G.box(4.6,.15,.15),M.blue,[0,2.3,1.4]);
 // linhas
 add(rig,tubeG([[4.8,7,0],[6.5,7.6,0],[8.5,10.5,0]],.3),M.rubber);add(rig,tubeG([[15.3,10.5,.9],[16.5,10.6,.9],[17.4,10.5,1.1]],.25),M.grey);add(rig,tubeG([[19.6,10.5,-1.1],[21,10.6,0],[22.4,11,3],[23.4,11.6,5]],.25),M.grey);add(rig,tubeG([[19.6,10.5,-1.1],[22,11,-3],[23.6,13,-5]],.22),M.grey);
 // trilhas do fluido: desce pela coluna, sobe pelo anular, sai pelo flow spool e passa pelo choke e pelo Coriolis
 const P={down:path([[0,17,0],[0,-30,0]],0x5ad1ff,70,9,.05),up:path([[.7,-30,-.45],[.75,7,-.5],[1.2,7,-.4]],0xffb347,80,7,.3),
  out:path([[1.2,7,0],[4.8,7,0],[6.5,7.6,0],[8.5,10.5,0],[10,10.5,-.9],[14,10.5,-.9],[15.3,10.5,.9],[17.4,10.5,1.1],[18.5,11.6,1.1],[18.5,12.6,0],[18.5,11.6,-1.1],[19.6,10.5,-1.1],[21,10.6,0],[22.4,11,3],[24,11.4,5]],0xffb347,90,7,.12),
  gas:path([[.6,-30,-.5],[.7,7,-.5],[4.8,7,0],[8.5,10.5,0],[14,10.5,-.9],[17.4,10.5,1.1],[18.5,12.6,0],[19.6,10.5,-1.1],[22,11,-3],[23.6,13,-5],[25,13.5,-5],[25,31,-5]],0xfff1b8,34,8,.3)};
 const F=flow(rig,Object.values(P));
 const at=(o,x,y,z)=>{const a=new THREE.Object3D();a.position.set(x,y,z);o.add(a);return a};
 const labs=[[at(rig,2.4,9.6,0),'RCD e flow spool','RCD and flow spool'],[at(rig,0,15.4,1.8),'Diverter','Diverter'],[at(mf,0,4.8,0),'Manifold de chokes MPD','MPD choke manifold'],[at(cor,0,4.3,0),'Medidor Coriolis','Coriolis flowmeter'],[at(mgs,0,9.6,0),'Separador de gás (MGS)','Mud-gas separator'],[at(sh,0,2.8,0),'Peneiras','Shakers'],[at(rig,0,-3,-.9),'Anular (retorno)','Annulus (returns)']];
 let r0=0;const S={sbp:10,ch:55,bhp:1.45};
 return {rig,labs,ready,dist:44,tgt:V(10,6,0),cams:[[V(10,14,44),V(10,6,0)],[V(3,9,13),V(1.5,6,0)],[V(26,18,22),V(16,9,0)],[V(-14,6,26),V(0,0,0)]],
  update(T,c){const{dt,heave,mode}=c,o=c.out;let qin=3000,qout=3000,sbp=10,ch=55,gas=0,dq=0,conv=1.45,rpm=120;
   if(mode==='stop'){qin=qout=1100;sbp=30;ch=22;rpm=0;conv=1.36}
   else{if(T<12){}
    else if(T<24){const k=ph(T,12,15.5)-ph(T,22.5,24);qin=qout=3000*(1-k);sbp=10+38*k;ch=55-43*k;conv=1.45-.13*k;rpm=120*(1-ph(T,12,13))}
    else if(T<30){const k=1-ph(T,24,27.5);qin=qout=3000*(1-k);sbp=10+38*k;ch=55-43*k;conv=1.45-.13*k;rpm=120*ph(T,27,28)}
    else if(T<36){dq=150*ph(T,30,33);qout=3000+dq}
    else if(T<48){dq=150*(1-ph(T,37,41));qout=3000+dq;sbp=10+12*ph(T,36,39);ch=55-18*ph(T,36,39);gas=ph(T,39,41)*(1-ph(T,46,48))}
    else{sbp=22-4*ph(T,48,52);ch=37+8*ph(T,48,52)}
    if(mode==='warn'){}}
   // heave: com a coluna nas cunhas, o navio sobe e desce e a coluna junto (pistoneio). O choke reage e corta a maior parte da oscilação
   const inSlips=mode==='stop'?0:win(T,13,27)?1:0,surge=heave*.012*(inSlips?1:.25);
   const bhp=1.45+surge*.3+(mode==='stop'?-.005:0)+(dq>0?dq/150*.004:0)+nz(c.t)*.0012;sbp-=surge*55;
   const k=1-Math.exp(-dt*4);S.sbp+=(sbp-S.sbp)*k;S.ch+=(ch-S.ch)*k;
   r0+=dt*rpm/60*PI*2;pipe.set(16.6,-30,r0);
   P.down.v=9*qin/3000;P.up.v=P.out.v=7*qout/3000;P.down.on=clamp(qin/3000*1.2);P.up.on=P.out.on=clamp(qout/3000*1.2);P.gas.on=gas;P.gas.v=8;F.update(dt*(c.play?1:0));
   chokes.forEach((a,i)=>a.position.y=3.6+(i===1?S.ch/100*.9:.45));{const e=Math.abs(sbp-S.sbp)>1||dq>10?.35:0;chokeM.emissive.setRGB(e,0,0);emis.forEach(m=>m.emissive&&m.emissive.setRGB(e,e*.15,0))}
   scr.position.y=2+(qout>200?Math.sin(c.t*40)*.03:0);
   Object.assign(o,{qin:qin+nz(c.t)*6*(qin>0),qout:qout+nz(c.t*1.2)*8*(qout>0),dq:qout-qin,sbp:Math.max(0,S.sbp),bhp:bhp,conv:conv+surge*1.2,ch:S.ch,gas})}}}

/* =====================================================================
   Cenário 3: bombas de lama (casa de bombas)
   ===================================================================== */
function scenePumps(){
 const rig=new THREE.Group();
 add(rig,G.box(40,.6,30),MP.floor,[0,-.3,0]);add(rig,G.box(40,14,.4),MP.wall,[0,7,-15]);add(rig,G.box(.4,14,30),MP.wall,[-20,7,0]);
 {const b=[];for(let i=0;i<6;i++)b.push(beamG(V(-20,12.6,-15+i*6),V(20,12.6,-15+i*6),.25,6));rig.add(mergeMesh(b,M.grey))}
 for(let i=0;i<4;i++)add(rig,G.box(3.2,.12,.6),MP.lamp,[-12+i*8,12.2,0]);
 // tanques de lama (sucção)
 for(let i=0;i<3;i++){add(rig,G.rbox(5,5,7,.2),M.blue,[-16,2.5,-9+i*8]);add(rig,G.box(5.2,.2,7.2),M.dark,[-16,5.05,-9+i*8])}
 const pumps=[],fly=[],damp=[],gs=[];
 for(let i=0;i<3;i++){const z=-8+i*8;const p=makeMudPump();p.position.set(0,0,z);rig.add(p);pumps.push(p);
  const f=new THREE.Group();f.position.set(-3.1,1.6,1.45);p.add(f);add(f,G.cyl(1.05,1.05,.18,32),M.dark,[0,0,0],[PI/2,0,0]);for(let k=0;k<4;k++)add(f,G.box(.16,1.9,.05),M.yellow,[0,0,.1],[0,0,k*PI/4]);add(f,G.cyl(.14,.14,.3,10),M.red,[0,.75,.15],[PI/2,0,0]);fly.push(f);
  damp.push(p.children.find(m=>m.geometry&&m.geometry.type==='SphereGeometry'&&Math.abs(m.position.y-4.9)<.01));
  gs.push(gauge(rig,[3.6,5.2,z+1.7],0));
  add(rig,tubeG([[2.3,3.7,z+1.7],[2.3,5.6,z+1.7],[3.4,6.6,z+1.7],[4.6,6.6,z+1.7]],.22),M.grey);
  add(rig,tubeG([[-13.5,.9,z-1],[-8,.6,z-2.2],[0,.6,z-2.4],[2.9,.85,z-1.9]],.3),M.blue)}
 const vib=[];const ready=settle(pumps.map((p,i)=>real('mudpump',{l:7.4,ry:PI}).then(w=>{swap(p,w);w.position.x=-.2;vib[i]=w;fly[i].visible=false;damp[i]=null})));
 add(rig,G.cyl(.38,.38,22,16),M.grey,[4.8,6.6,0],[PI/2,0,0]);add(rig,tubeG([[4.8,6.6,10.8],[4.8,9,11],[4.8,13.5,11]],.38),M.grey);
 const P=[0,1,2].map(i=>{const z=-8+i*8;return path([[2.3,3.7,z+1.7],[2.3,5.6,z+1.7],[3.4,6.6,z+1.7],[4.8,6.6,z+1.7],[4.8,6.6,10.8],[4.8,9,11],[4.8,14,11]],0x5ad1ff,40,6,.1)});
 const F=flow(rig,P);
 const at=(o,x,y,z)=>{const a=new THREE.Object3D();a.position.set(x,y,z);o.add(a);return a};
 const labs=[[at(pumps[0],-1,3.6,0),'Bomba 1','Pump 1'],[at(pumps[1],-1,3.6,0),'Bomba 2','Pump 2'],[at(pumps[2],-1,3.6,0),'Bomba 3','Pump 3'],[at(rig,4.8,7.4,4),'Coletor de descarga','Discharge manifold'],[at(rig,-16,5.6,-1),'Tanques de lama','Mud pits'],[at(rig,4.8,13.6,11),'Para o tubo bengala','To the standpipe']];
 const ang=[0,0,0],S=[0,0,0];
 return {rig,labs,ready,dist:30,tgt:V(0,3,0),cams:[[V(22,12,24),V(0,3,0)],[V(9,6,4),V(1,2.4,0)],[V(16,9,-14),V(2,3,0)]],
  update(T,c){const{dt,mode}=c,o=c.out;const spm=[0,0,0];
   if(mode==='stop'){spm[0]=60*ph(T,0,4)}
   else{for(let i=0;i<3;i++)spm[i]=110*ph(T,i*2,i*2+5)*(1-ph(T,40,46));
    if(win(T,22,34)){const d=ph(T,22,25)-ph(T,31,34);spm[1]*=1-d;spm[0]=lerp(spm[0],125,d);spm[2]=lerp(spm[2],125,d)}}
   const k=1-Math.exp(-dt*5);let q=0;for(let i=0;i<3;i++){S[i]+=(spm[i]-S[i])*k;ang[i]+=dt*S[i]/60*PI*2;fly[i].rotation.z=-ang[i];if(vib[i])vib[i].position.y=S[i]>5?Math.sin(ang[i]*6)*.006:0;if(damp[i])damp[i].scale.setScalar(1+Math.sin(ang[i]*3)*.03*clamp(S[i]/60));q+=S[i]*11.52;
    P[i].v=6*S[i]/110;P[i].on=clamp(S[i]/80)}
   const pr=340*Math.pow(q/3800,1.8)*(1+Math.sin(ang[0]*3+ang[1]*3)*.006);gs.forEach((g,i)=>g.set(pr/520));F.update(dt*(c.play?1:0));
   Object.assign(o,{b1:S[0],b2:S[1],b3:S[2],q,p:pr,kw:pr*q/600})}}}

/* =====================================================================
   Cenário 4: tensionadores do riser e compensação de heave
   ===================================================================== */
function sceneTens(){
 const rig=new THREE.Group(),world=new THREE.Group();
 // casco em corte em volta do moonpool (preso ao navio)
 for(const x of[-1,1]){add(rig,G.box(14,9,26),MP.hullB,[x*15,4.5,0]);add(rig,G.box(14,7,26),MP.hullR,[x*15,-3.5,0]);add(rig,G.box(14.2,.25,26.2),M.black,[x*15,.05,0])}
 add(rig,G.box(16,16,1),MP.hullB,[0,1,-13]);
 add(rig,G.rbox(22,1,22,.15),MP.floor,[0,16.6,0]);for(const[x,z]of[[9,9],[9,-9],[-9,-9],[-9,9]])add(rig,G.cyl(.5,.5,7,12),M.grey,[x,13,z]);
 const dv=makeDiverter();dv.position.y=12.9;rig.add(dv);
 add(rig,G.cyl(1.05,1.05,17,32),M.chrome,[0,4.1,0]);   // barril interno da junta telescópica (acompanha o navio)
 const ringT=V(0,1.4,0);
 // riser preso ao poço (não sobe e desce)
 add(world,G.cyl(1.5,1.5,22,40),M.white,[0,-9.2,0]);add(world,G.cyl(1.6,1.6,.8,40),M.dark,[0,1.6,0]);add(world,G.tor(2.7,.5,40),M.dark,[0,1.4,0],[PI/2,0,0]);
 for(let i=0;i<3;i++){const j=makeRiserJoint(24);j.position.y=-32-i*24;world.add(j)}
 const tens=[];for(let i=0;i<6;i++){const a=i/6*PI*2+PI/6;const t=makeTensioner(9.6);add(t.userData.rod,G.cyl(.4,.4,4,20),M.chrome,[0,-2,0]);world.add(t);tens.push({t,top:V(Math.cos(a)*7,14.6,Math.sin(a)*7),bot:V(Math.cos(a)*2.7,1.4,Math.sin(a)*2.7)})}
 tens.forEach(T=>{const p=T.top.clone();T.top0=p;const b=new THREE.Group();b.position.copy(p).setY(15.6);rig.add(b);add(b,G.rbox(1.6,1.4,1.6,.15),M.dark)});
 const at=(o,x,y,z)=>{const a=new THREE.Object3D();a.position.set(x,y,z);o.add(a);return a};
 const labs=[[at(world,6.2,9,5.2),'Tensionadores','Tensioners'],[at(world,2.9,1.4,1.6),'Anel de tensão','Tension ring'],[at(rig,1.1,8.4,1),'Barril interno (navio)','Inner barrel (vessel)'],[at(world,1.6,-6,1.2),'Barril externo (riser)','Outer barrel (riser)'],[at(rig,-14,0,13.2),'Linha d’água no casco','Hull waterline'],[at(world,0,-40,2.4),'Riser até o BOP','Riser down to the BOP']];
 const tmp=V(0,0,0),tmp2=V(0,0,0);let off=0;
 return {rig,world,labs,dist:44,camWorld:true,tgt:V(0,4,0),cams:[[V(4,8,40),V(0,3,0)],[V(10,4,15),V(2,2,0)],[V(-26,22,28),V(0,4,0)]],
  update(T,c){const{dt,heave,mode}=c,o=c.out;rig.updateMatrixWorld();let st=0,smin=99,smax=-99;
   tens.forEach(Tn=>{rig.localToWorld(tmp.copy(Tn.top0));const b=tmp2.copy(ringT).add(V(Tn.bot.x,0,Tn.bot.z));const d=tmp.distanceTo(b);Tn.t.position.copy(tmp);Tn.t.quaternion.setFromUnitVectors(UP,b.clone().sub(tmp).normalize());Tn.t.userData.rod.position.y=Tn.t.userData.base+(d-Tn.t.userData.closed);st+=d;smin=Math.min(smin,d);smax=Math.max(smax,d)});
   const s=st/6-13.88,w=c.W;off+=((w.vento*.045+w.hs*.25)-off)*(1-Math.exp(-dt*.3));
   Object.assign(o,{heave,stroke:s,tension:780*(1+s*.012)+nz(c.t*.5)*2,tj:clamp(Math.abs(heave)/3.8)*100,flex:.35+off*.38+Math.abs(Math.sin(c.t*.4))*.15*w.hs/6,offset:off*.45+Math.sin(c.t*.07)*.15})}}}

/* =====================================================================
   Definições: textos, etapas, dados e resposta ao clima
   ===================================================================== */
const DEF={
 topdrive:{build:sceneTopDrive,D:60,ac:[0,1,2,3,1,1,0],key:'drill',area:['Topside · piso de perfuração','Topside · drill floor'],nome:['Operações de top drive','Top drive operations'],
  sub:['Perfuração de uma seção e conexão de uma nova seção de tubos (stand), com compensação de heave.','Drilling down a stand and connecting a new one, with heave compensation.'],
  steps:[[0,'Perfurando','Drilling','O top drive gira a coluna a ~120 rpm e o drawworks desce o bloco. As bombas mandam lama pela coluna.','The top drive turns the string at ~120 rpm while the drawworks lowers the block. Pumps send mud down the string.'],
   [14,'Coluna nas cunhas','String in the slips','Bombas desligadas, a coluna sobe 0,5 m do fundo e as cunhas da mesa rotativa passam a segurar o peso.','Pumps off, the string is picked up 0.5 m off bottom and the rotary slips take its weight.'],
   [19,'Top drive desconecta e sobe','Top drive breaks out and rises','O top drive desenrosca do tubo e o drawworks sobe o bloco vazio até o topo.','The top drive backs out of the pipe and the drawworks hoists the empty block.'],
   [27,'Racker traz a nova seção','Racker brings the next stand','O racker tira uma seção de três tubos (~28 m) do estaleiro e a centraliza sobre o poço; o elevador do top drive a segura.','The racker takes a three-joint stand (~28 m) from the setback and centres it over the well; the top drive elevator latches it.'],
   [35,'Iron roughneck conecta','Iron roughneck makes up','O roughneck avança, gira a seção (spin) e aplica o torque de aperto na conexão de baixo (~50 kN·m).','The roughneck moves in, spins the stand and applies make-up torque on the lower connection (~50 kN·m).'],
   [44,'Top drive aperta e libera as cunhas','Top drive makes up, slips out','O top drive aperta a conexão de cima, as cunhas saem e as bombas voltam em rampa.','The top drive makes up the upper connection, the slips come out and the pumps ramp back up.'],
   [50,'Volta a perfurar','Back to drilling','Rotação e peso sobre a broca retomados. O compensador na coroa mantém o peso sobre a broca estável com o navio subindo e descendo.','Rotation and weight on bit resume. The crown compensator keeps weight on bit steady as the vessel heaves.']],
  wow:[[0,'Broca tirada do fundo','Bit off bottom','Rotação parada e vazão reduzida.','Rotation stopped and flow reduced.'],[6,'Coluna pendurada (hang-off)','String hung off','A coluna fica pendurada no top drive, longe do fundo do poço.','The string hangs from the top drive, clear of the bottom of the well.'],[12,'Compensador ativo','Compensator active','O compensador na coroa absorve o heave: a coluna fica parada em relação ao fundo enquanto o navio se move.','The crown compensator absorbs heave: the string stays still relative to the seabed while the vessel moves.'],[18,'Aguardando o tempo (WOW)','Waiting on weather (WOW)','A operação volta quando o mar e o vento baixarem dos limites.','Operations resume when sea and wind drop below the limits.']],
  eq:['topdrive','roughneck','drawworks','rotary','structures','motion','deal'],
  kpi:[['rpm','Rotação','Rotation','rpm',0,0,160],['torque','Torque','Torque','kN·m',0,0,60],['hook','Peso no gancho','Hookload','t',0,0,240],['wob','Peso sobre a broca','Weight on bit','t',1,0,25],['spp','Pressão de bombeio','Standpipe pressure','bar',0,0,300],['bloco','Altura do bloco','Block height','m',1,0,50]],
  extra:'comp',
  wx:{ok:['O compensador na coroa absorve o heave e a perfuração segue normalmente.','The crown compensator absorbs heave and drilling continues normally.'],
   warn:['Heave alto: o compensador trabalha perto do curso máximo, o peso sobre a broca oscila e a manobra de tubos fica mais lenta.','High heave: the compensator works near full stroke, weight on bit fluctuates and pipe handling slows down.'],
   stop:['Mar e vento acima dos limites: broca fora do fundo, coluna pendurada com compensador ativo e equipe aguardando o tempo (WOW).','Sea and wind above the limits: bit off bottom, string hung off with the compensator active, crew waiting on weather (WOW).']}},
 mpd:{build:sceneMPD,D:56,ac:[0,1,0,2,2,0],key:'drill',area:['Topside · abaixo do piso','Topside · below the drill floor'],nome:['Operações de MPD','MPD operations'],
  sub:['Perfuração com pressão gerenciada: o choke ajusta a contrapressão para manter a pressão no fundo constante numa janela estreita.','Managed pressure drilling: the choke adjusts back-pressure to hold bottom-hole pressure constant inside a narrow window.'],
  steps:[[0,'Perfurando com BHP constante','Drilling at constant BHP','O RCD fecha o anular no topo do riser e desvia o retorno para o manifold. Com bombas ligadas, a fricção (ECD) já sustenta a pressão no fundo.','The RCD seals the annulus at the top of the riser and diverts returns to the manifold. With pumps on, friction (ECD) holds bottom-hole pressure.'],
   [12,'Conexão: bombas param, choke fecha','Connection: pumps off, choke closes','Sem bombeio a fricção some. O choke fecha e aplica contrapressão na superfície (SBP) para a pressão no fundo não cair abaixo da pressão de poros.','Without pumping, friction is lost. The choke closes and applies surface back-pressure (SBP) so bottom-hole pressure does not fall below pore pressure.'],
   [24,'Bombas voltam, SBP diminui','Pumps back on, SBP eases','As bombas retomam em rampa e o choke abre na mesma medida: a pressão no fundo não muda.','Pumps ramp back up and the choke opens to match: bottom-hole pressure stays put.'],
   [30,'Influxo detectado','Influx detected','O medidor Coriolis vê mais lama saindo do que entrando (+150 L/min). O sistema percebe em segundos, muito antes do aumento de volume nos tanques.','The Coriolis meter sees more mud coming out than going in (+150 L/min). The system catches it in seconds, long before a pit gain shows.'],
   [36,'Choke controla e circula o gás','Choke controls, gas circulated out','O choke fecha um pouco, a SBP sobe e o influxo para. O gás é circulado pelo separador (MGS) sem fechar o BOP.','The choke closes slightly, SBP rises and the influx stops. Gas is circulated through the mud-gas separator without shutting the BOP.'],
   [48,'Perfuração continua','Drilling continues','Novo ajuste de contrapressão e a perfuração segue dentro da janela operacional.','New back-pressure setpoint and drilling continues inside the operating window.']],
  wow:[[0,'Circulação reduzida','Reduced circulation','Rotação parada, vazão reduzida.','Rotation stopped, flow reduced.'],[8,'SBP compensa a fricção perdida','SBP replaces lost friction','Com menos vazão, o choke mantém a pressão no fundo com contrapressão.','With less flow, the choke holds bottom-hole pressure with back-pressure.'],[16,'Aguardando o tempo','Waiting on weather','O MPD segura a pressão do poço estável durante a espera.','MPD keeps well pressure steady while waiting.']],
  eq:['mpd','diverter','telescopic','riser','valves','mudsys'],
  kpi:[['qin','Vazão de entrada','Flow in','L/min',0,0,3600],['qout','Vazão de saída','Flow out','L/min',0,0,3600],['dq','Diferença (saída − entrada)','Delta (out − in)','L/min',0,-200,200],['sbp','Contrapressão (SBP)','Back-pressure (SBP)','bar',1,0,60],['bhp','Pressão no fundo (BHP)','Bottom-hole pressure','sg',3,1.3,1.6],['ch','Abertura do choke','Choke opening','%',0,0,100]],
  extra:'window',
  wx:{ok:['Equipamento abaixo do piso, protegido da chuva. Pouco heave: pressão no fundo estável.','Equipment below the drill floor, sheltered from rain. Little heave: steady bottom-hole pressure.'],
   warn:['Nas conexões a coluna sobe e desce com o navio (pistoneio) e a pressão no fundo oscila. O choke reage em segundos e reduz a oscilação.','During connections the string heaves with the vessel (surge and swab) and bottom-hole pressure swings. The choke reacts within seconds and damps it.'],
   stop:['Perfuração suspensa. O MPD mantém a pressão do poço com contrapressão enquanto a sonda aguarda o tempo.','Drilling suspended. MPD holds well pressure with back-pressure while the rig waits on weather.']}},
 pumps:{build:scenePumps,D:48,ac:[0,1,2,1,0],key:null,area:['Casco · casa de bombas','Hull · pump room'],nome:['Bombas de lama','Mud pumps'],
  sub:['Três bombas triplex mandam o fluido de perfuração em alta pressão até o top drive.','Three triplex pumps send drilling fluid at high pressure up to the top drive.'],
  steps:[[0,'Partida em rampa','Staged start-up','As bombas entram uma de cada vez, com rotação crescente, para evitar picos de pressão no poço.','Pumps come online one at a time, ramping up to avoid pressure surges in the well.'],
   [8,'Circulação estável','Steady circulation','Três bombas a 110 golpes/min: ~3.800 L/min a ~340 bar. Os amortecedores suavizam a pulsação.','Three pumps at 110 strokes/min: ~3,800 L/min at ~340 bar. Dampeners smooth the pulsation.'],
   [22,'Bomba 2 em manutenção','Pump 2 down for maintenance','A bomba 2 sai (troca de válvula). As outras sobem a rotação, mas a vazão total cai e a pressão acompanha.','Pump 2 drops out (valve change). The others speed up, but total flow drops and pressure follows.'],
   [32,'Bomba 2 volta','Pump 2 back online','A bomba 2 retorna em rampa e as três voltam a dividir a carga.','Pump 2 ramps back and the three share the load again.'],
   [40,'Desligamento para a conexão','Shutdown for the connection','As bombas param em rampa para a próxima conexão de tubos.','Pumps ramp down for the next pipe connection.']],
  wow:[[0,'Circulação mínima','Minimum circulation','Uma bomba a 60 golpes/min mantém a lama condicionada no poço.','One pump at 60 strokes/min keeps the mud conditioned in the well.'],[10,'Aguardando o tempo','Waiting on weather','As demais ficam prontas para retomar a perfuração.','The others stand by to resume drilling.']],
  eq:['mudpumps','mudsys','deal'],
  kpi:[['b1','Bomba 1','Pump 1','spm',0,0,140],['b2','Bomba 2','Pump 2','spm',0,0,140],['b3','Bomba 3','Pump 3','spm',0,0,140],['q','Vazão total','Total flow','L/min',0,0,4600],['p','Pressão de descarga','Discharge pressure','bar',0,0,420],['kw','Potência hidráulica','Hydraulic power','kW',0,0,3000]],
  wx:{ok:['Bombas abrigadas no casco: chuva e vento não afetam a operação.','Pumps sheltered inside the hull: rain and wind do not affect them.'],warn:['Bombas abrigadas no casco: operação normal. A perfuração acima pode ir mais devagar.','Pumps sheltered inside the hull: normal operation. Drilling above may slow down.'],stop:['Perfuração suspensa: só uma bomba mantém circulação mínima.','Drilling suspended: only one pump keeps minimum circulation.']}},
 tens:{build:sceneTens,D:24,ac:[0,1,2],key:'tens',area:['Moonpool · riser','Moonpool · riser'],nome:['Tensionadores e heave','Tensioners and heave'],
  sub:['O navio sobe e desce com as ondas, mas o riser fica preso ao poço. Tensionadores e junta telescópica absorvem a diferença.','The vessel heaves with the waves, but the riser is tied to the well. Tensioners and the telescopic joint absorb the difference.'],
  steps:[[0,'Navio sobe com a onda','Vessel rises on a wave','Os cilindros estendem e a junta telescópica abre, mantendo a mesma força de tração no riser.','The cylinders extend and the telescopic joint opens, keeping the same pull on the riser.'],
   [8,'Navio desce','Vessel drops','Os cilindros recolhem. Acumuladores de gás mantêm a tensão quase constante.','The cylinders retract. Gas accumulators keep tension nearly constant.'],
   [16,'Riser parado em relação ao fundo','Riser still relative to the seabed','Com o riser tracionado, o BOP no leito marinho não sente o movimento do navio.','With the riser in tension, the BOP on the seabed does not feel the vessel motion.']],
  eq:['tens','telescopic','riser','motion','diverter'],
  kpi:[['heave','Heave (agora)','Heave (now)','m',2,-3,3],['stroke','Curso dos cilindros','Cylinder stroke','m',2,-3,3],['tension','Tensão total','Total tension','t',0,700,860],['tj','Curso usado da junta','Telescopic joint used','%',0,0,100],['flex','Ângulo do flex joint','Flex joint angle','°',1,0,6],['offset','Afastamento (% LDA)','Offset (% WD)','%',1,0,6]],
  extra:'watch',
  wx:{ok:['Mar calmo: curso pequeno e tensão estável.','Calm sea: small stroke and steady tension.'],warn:['Mar grosso: curso grande dos tensionadores e da junta telescópica. Equipe acompanha o ângulo do flex joint.','Rough sea: large tensioner and telescopic joint stroke. The crew watches flex joint angle.'],
   stop:['Curso perto do limite: preparar desconexão de emergência (EDS) se o afastamento passar do círculo amarelo.','Stroke near the limit: prepare an emergency disconnect (EDS) if offset passes the yellow circle.']}}};
export const SCN_IDS=Object.keys(DEF);

/* =====================================================================
   Fundo: céu e mar (shaders leves) e luzes
   ===================================================================== */
const WV=`uniform float uTime;uniform vec2 uSea;float wv(vec2 p){return uSea.x*(.5*sin(p.x*.045+uTime*.8)+.35*sin(p.y*.06+uTime*1.05+1.3)+.18*sin((p.x+p.y)*.11+uTime*1.6))+uSea.y*(.32*sin(p.x*.19-p.y*.05+uTime*2.1)+.22*sin(p.y*.23+p.x*.08+uTime*2.6+.7));}`;
function backdrop(){const U={uTime:{value:0},uSea:{value:new THREE.Vector2(1,0)},uSt:WXU.storm,uFl:WXU.flash,uN:{value:0},uFog:{value:0},uA:{value:1}};
 const sky=new THREE.Mesh(new THREE.SphereGeometry(1800,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:U,
  vertexShader:'varying vec3 d;void main(){d=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position.z=gl_Position.w;}',
  fragmentShader:`uniform float uSt,uFl,uN;varying vec3 d;void main(){float k=clamp(d.y,0.,1.);vec3 c=mix(vec3(.74,.82,.89),vec3(.22,.44,.72),pow(k,.5));
   float cl=sin(d.x*7.+d.y*13.)*sin(d.z*9.-d.y*5.)*.5+.5;c=mix(c,mix(vec3(.42,.46,.5),vec3(.2,.23,.27),pow(k,.6))*mix(.85,1.08,cl),uSt);c+=uFl*vec3(.8,.85,1.)*mix(.6,1.,cl);
   c=mix(c,mix(vec3(.03,.05,.09),vec3(.0,.01,.03),pow(k,.4)),uN);if(d.y<0.)c=mix(c,c*.6,clamp(-d.y*4.,0.,1.));gl_FragColor=vec4(c,1.);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
   }`}));sky.frustumCulled=false;sky.renderOrder=-10;
 const sea=new THREE.Mesh(new THREE.PlaneGeometry(1600,1600,160,160).rotateX(-PI/2),new THREE.ShaderMaterial({uniforms:U,fog:false,transparent:true,
  vertexShader:WV+`varying vec3 w;varying vec3 n;void main(){vec3 p=position;vec4 wp=modelMatrix*vec4(p,1.);float h=wv(wp.xz);p.y+=h;float e=.6;n=normalize(vec3(-(wv(wp.xz+vec2(e,0.))-wv(wp.xz-vec2(e,0.)))/(2.*e),1.,-(wv(wp.xz+vec2(0.,e))-wv(wp.xz-vec2(0.,e)))/(2.*e)));wp=modelMatrix*vec4(p,1.);w=wp.xyz;gl_Position=projectionMatrix*viewMatrix*wp;}`,
  fragmentShader:`uniform float uSt,uFl,uN,uFog,uA;uniform vec2 uSea;varying vec3 w;varying vec3 n;void main(){vec3 v=normalize(cameraPosition-w);vec3 nn=normalize(n);float f=pow(1.-max(dot(nn,v),0.),4.);
   vec3 deep=mix(vec3(.02,.17,.24),vec3(.12,.17,.19),uSt*.8);vec3 skyc=mix(vec3(.62,.74,.85),vec3(.42,.46,.5),uSt);vec3 c=mix(deep,skyc,.12+.75*f);
   vec3 sd=normalize(vec3(.45,.6,.65));float sp=pow(max(dot(reflect(-sd,nn),v),0.),180.)*(1.-uSt)*2.;c+=sp;
   float foam=smoothstep(.55,1.,(w.y-.6*uSea.x)/(.4+uSea.y))*clamp(uSea.y,0.,1.);c=mix(c,vec3(.9,.93,.95),foam*.6);c+=uFl*.25;
   float dist=length(w.xz-cameraPosition.xz);float hz=1.-exp(-dist*(.0012+uFog*2.2));c=mix(c,skyc*mix(1.,.92,uSt),clamp(hz,0.,1.));c=mix(c,c*.08+vec3(.0,.01,.02),uN);
   gl_FragColor=vec4(c,uA);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
   }`}));sea.renderOrder=-5;
 return {sky,sea,U}}

/* =====================================================================
   Módulo: abre/fecha cenários, interface, câmera, dados e clima
   ===================================================================== */
export function createCenarios({renderer,env,lang,WX,nome,sheet,kick,night=()=>0,reduced=false,onOpen=()=>{},onClose=()=>{}}){
 const L=()=>lang()==='en'?1:0,X=k=>UI[lang()][k];
 const scene=new THREE.Scene();const cam=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.3,4000);
 const hemi=new THREE.HemisphereLight(0xdfeeff,0x3a3f44,.7),sun=new THREE.DirectionalLight(0xfff0dc,2.4);sun.position.set(300,420,380);scene.add(hemi,sun,sun.target);
 const fl1=new THREE.PointLight(0xffe2b0,0,90,1.6),fl2=new THREE.PointLight(0xffe2b0,0,90,1.6);fl1.position.set(14,40,14);fl2.position.set(-14,26,-10);
 const bd=backdrop();scene.add(bd.sky,bd.sea);const rain=makeRain(4500);scene.add(rain.mesh);
 const cache={};let cur=null,id=null,open=false,T=0,play=true,speed=1,auto=true,motion=!reduced,camI=0,az=.5,el=.2,dist=40,tgt=V(),camT=V(),camP=V(),drag=null,stepN=-1,mode='ok',hist={},histT=0,frameN=0,ready=false,tStart=performance.now()/1000;
 const out={};

 /* ---------- interface ---------- */
 const root=document.createElement('section');root.className='scn';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','scnT');
 root.innerHTML=`<div class="scnHit" id="scnHit"></div><div class="scnLabs" id="scnLabs" aria-hidden="true"></div><div class="scnFade" id="scnFade"><span id="scnPrep"></span></div>
 <header class="scnTop"><button class="scnBack" id="scnBack"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg><span id="scnBackL"></span></button>
  <div class="scnTi"><small id="scnArea"></small><h2 id="scnT"></h2></div>
  <nav class="scnTabs" id="scnTabs" aria-label="Cenários"></nav>
  <button class="scnWx" id="scnWx" aria-haspopup="dialog"></button></header>
 <div class="scnBan" id="scnBan" hidden></div>
 <aside class="scnL glass dw" id="scnL"><p class="scnSub" id="scnSub"></p><h4 id="scnStT"></h4><ol class="scnSteps" id="scnSteps"></ol></aside>
 <aside class="scnR glass dw" id="scnR"><h4 id="scnDT"></h4><div class="scnK" id="scnK"></div><div class="scnX" id="scnX"></div>
  <h4 id="scnWT"></h4><p class="scnWn" id="scnWn"></p><h4 id="scnET"></h4><div class="scnEq" id="scnEq"></div><small class="scnIl" id="scnIl"></small></aside>
 <footer class="scnBar glass dw"><button class="opb" id="scnPlay"></button><div class="scnTl" id="scnTl" role="slider" aria-valuemin="0" aria-valuemax="100" tabindex="0"><i id="scnFill"></i><span id="scnTicks"></span></div><button class="opb" id="scnSp">1×</button>
  <div class="scnCams" id="scnCams"></div><button class="opb" id="scnMov" aria-pressed="true"></button><button class="opb scnPan" id="scnPanB" aria-pressed="false"></button></footer>
 <small class="scnHint" id="scnHint"></small>`;
 document.body.appendChild(root);const $=q=>root.querySelector(q);
 // menu "Operações" na barra
 const menu=document.createElement('div');menu.className='opsMenu glass';menu.id='opsMenu';menu.setAttribute('role','menu');menu.hidden=true;document.body.appendChild(menu);
 const ICON={topdrive:'<path d="M9 3h6v4H9zM12 7v14M8 11h8v4H8z"/>',mpd:'<path d="M12 3v18M7 8h10M5 14h6M13 14h6"/><circle cx="16" cy="14" r="2.2"/>',pumps:'<rect x="3" y="9" width="11" height="8" rx="1.5"/><path d="M14 11h4v4h-4M18 13h3M7 9V6h4v3"/>',tens:'<path d="M12 3v18M5 6l5 8M19 6l-5 8"/><path d="M8 18h8"/>',kick:'<path d="M12 3 2.5 20h19Z"/><path d="M12 10v4.5M12 17.5v.01"/>'};
 const ic=k=>`<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;
 function buildMenu(){const i=L();menu.innerHTML=`<p class="omH">${X('menuSub')}</p>`+SCN_IDS.map(k=>`<button role="menuitem" data-k="${k}">${ic(k)}<span><b>${DEF[k].nome[i]}</b><small>${DEF[k].area[i]}</small></span></button>`).join('')+`<button role="menuitem" data-k="kick">${ic('kick')}<span><b>${X('kick')}</b><small>${X('kickD')}</small></span></button>`;
  menu.querySelectorAll('button').forEach(b=>b.onclick=()=>{showMenu(false);if(b.dataset.k==='kick'){if(open)close();kick()}else openS(b.dataset.k)})}
 let menuBtn=null;function showMenu(v,btn){if(btn)menuBtn=btn;menu.hidden=!v;menuBtn&&menuBtn.setAttribute('aria-expanded',v);if(v){buildMenu();const r=menuBtn.getBoundingClientRect();menu.style.top=(r.bottom+10)+'px';menu.style.left=Math.max(12,Math.min(innerWidth-menu.offsetWidth-12,r.left+r.width/2-menu.offsetWidth/2))+'px';menu.querySelector('button').focus({preventScroll:true})}}
 addEventListener('pointerdown',e=>{if(!menu.hidden&&!menu.contains(e.target)&&!(menuBtn&&menuBtn.contains(e.target)))showMenu(false)});
 menu.addEventListener('keydown',e=>{const bs=[...menu.querySelectorAll('button')],k=bs.indexOf(document.activeElement);if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();bs[(k+(e.key==='ArrowDown'?1:-1)+bs.length)%bs.length].focus()}if(e.key==='Escape'){showMenu(false);menuBtn&&menuBtn.focus()}});

 const num=(v,d)=>(+v).toLocaleString(lang()==='pt'?'pt-BR':'en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
 function steps(){const d=DEF[id];return mode==='stop'&&d.wow?d.wow:d.steps}
 function dur(){const d=DEF[id];return mode==='stop'&&d.wow?(d.wow[d.wow.length-1][0]+8):d.D}
 function texts(){if(!id)return;const d=DEF[id],i=L();
  $('#scnT').textContent=d.nome[i];$('#scnArea').textContent=X('cen')+' · '+d.area[i];$('#scnSub').textContent=d.sub[i];$('#scnBackL').textContent=X('voltar');$('#scnBack').setAttribute('aria-label',X('voltar'));
  $('#scnStT').textContent=X('etapas');$('#scnDT').textContent=X('dados');$('#scnWT').textContent=X('clima');$('#scnET').textContent=X('equip');$('#scnIl').textContent=X('ilus');$('#scnHint').textContent=X('dica');$('#scnPrep').textContent=X('prep');
  $('#scnTabs').innerHTML=SCN_IDS.map(k=>`<button data-k="${k}" aria-pressed="${k===id}" title="${DEF[k].nome[i]}">${ic(k)}<span>${DEF[k].nome[i]}</span></button>`).join('');$('#scnTabs').querySelectorAll('button').forEach(b=>b.onclick=()=>openS(b.dataset.k));
  const S=steps();$('#scnSteps').innerHTML=S.map((s,n)=>`<li data-n="${n}"><button data-t="${s[0]}"><span>${n+1}</span><b>${s[1+i]}</b></button><p>${s[3+i]}</p></li>`).join('');$('#scnSteps').querySelectorAll('button').forEach(b=>b.onclick=()=>{T=+b.dataset.t+.01;stepN=-1});
  $('#scnTicks').innerHTML=S.map(s=>`<b style="left:${(s[0]/dur()*100).toFixed(1)}%"></b>`).join('');
  $('#scnK').innerHTML=d.kpi.map(k=>`<div class="kp" data-k="${k[0]}"><small>${k[1+i]}</small><b><span>–</span> <em>${k[3]}</em></b><canvas width="120" height="26"></canvas></div>`).join('');
  $('#scnEq').innerHTML=d.eq.map(e=>`<button data-id="${e}">${nome(e)}<span aria-hidden="true">↗</span></button>`).join('');$('#scnEq').querySelectorAll('button').forEach(b=>{b.title=X('info');b.onclick=()=>sheet(b.dataset.id)});
  $('#scnCams').innerHTML=`<button class="opb" data-c="auto" aria-pressed="${auto}">${X('auto')}</button>`+(cur?cur.cams:[]).map((c,n)=>`<button class="opb" data-c="${n}" aria-pressed="${!auto&&camI===n}">${n+1}</button>`).join('');
  $('#scnCams').querySelectorAll('button').forEach(b=>b.onclick=()=>{if(b.dataset.c==='auto'){auto=true}else{auto=false;setCam(+b.dataset.c)}texts()});
  $('#scnMov').textContent=X('mov');$('#scnMov').setAttribute('aria-pressed',motion);$('#scnPlay').textContent=play?'⏸':'▶';$('#scnPlay').setAttribute('aria-label',play?X('play'):X('playB'));$('#scnSp').setAttribute('aria-label',X('vel'));
  $('#scnPanB').textContent=X('dados');extraBuild();weather();stepN=-1}
 function weather(){if(!id||!WX)return;const d=DEF[id],i=L();const st=WX.status;const m=d.key?st[d.key]:(st.drill==='stop'?'stop':st.drill==='warn'?'warn':'ok');
  if(m!==mode){mode=m;if(open){T=0;texts();return}}
  $('#scnWx').innerHTML=`${WX.icon()}<span>${WX.resumo()}</span>`;$('#scnWx').className='scnWx '+mode;$('#scnWx').setAttribute('aria-label',X('clima')+': '+WX.resumo());
  $('#scnWn').innerHTML=`<b class="${mode}">${X(mode)}</b> ${d.wx[mode][i]}`;const ban=$('#scnBan');ban.hidden=mode==='ok';ban.className='scnBan '+mode;ban.innerHTML=`${wxIcon(mode==='stop'?'tempestade':'moderado')}<span><b>${X(mode)}</b> ${d.wx[mode][i]}</span>`}
 /* painéis extras: janela de pressão (MPD), compensador (top drive) e círculo de vigilância (tensionadores) */
 function extraBuild(){const d=DEF[id],i=L(),e=$('#scnX');
  if(d.extra==='window')e.innerHTML=`<div class="pw"><div class="pwT"><span>${['Janela de pressão no fundo','Bottom-hole pressure window'][i]}</span><em>sg</em></div><div class="pwB"><i class="z0"></i><i class="z1"></i><i class="z2"></i><b class="mk conv" id="pwC"><span>${['Sem MPD','No MPD'][i]}</span></b><b class="mk mpd" id="pwM"><span>MPD</span></b></div><div class="pwL"><span>${['Poros 1,38','Pore 1.38'][i]}</span><span>${['Fratura 1,52','Fracture 1.52'][i]}</span></div></div>`;
  else if(d.extra==='comp')e.innerHTML=`<div class="pw"><div class="pwT"><span>${['Compensador na coroa: curso','Crown compensator stroke'][i]}</span><em id="cmpV"></em></div><div class="cmp"><i></i><b id="cmpM"></b></div><div class="pwL"><span>−3,8 m</span><span>0</span><span>+3,8 m</span></div></div>`;
  else if(d.extra==='watch')e.innerHTML=`<div class="pw wc"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54" class="r2"/><circle cx="60" cy="60" r="40" class="r1"/><circle cx="60" cy="60" r="24" class="r0"/><path d="M60 8v104M8 60h104" class="ax"/><circle id="wcD" cx="60" cy="60" r="5" class="dot"/></svg><div><span>${['Círculo de vigilância','Watch circle'][i]}</span><small>${['Verde: operar · amarelo: preparar a desconexão · vermelho: desconectar (EDS)','Green: operate · yellow: prepare to disconnect · red: disconnect (EDS)'][i]}</small></div></div>`;
  else e.innerHTML=''}
 function extraUpd(){const d=DEF[id];if(d.extra==='window'){const p=v=>clamp((v-1.3)/.3)*100;const m=$('#pwM'),c=$('#pwC');if(m)m.style.left=p(out.bhp)+'%';if(c){c.style.left=p(out.conv)+'%';c.classList.toggle('bad',out.conv<1.38||out.conv>1.52)}}
  if(d.extra==='comp'){const m=$('#cmpM');if(m){m.style.left=(50+clamp(out.comp/3.8,-1,1)*50)+'%';m.classList.toggle('bad',Math.abs(out.comp)>2.6)}const v=$('#cmpV');if(v)v.textContent=(out.comp>=0?'+':'')+num(out.comp,2)+' m'}
  if(d.extra==='watch'){const dd=$('#wcD');if(dd){const r=clamp(out.offset/6)*54;dd.setAttribute('cx',60+r*.92);dd.setAttribute('cy',60-r*.38);dd.setAttribute('class','dot '+(out.offset>5?'stop':out.offset>3?'warn':'ok'))}}}
 function kpiUpd(){const d=DEF[id];root.querySelectorAll('.kp').forEach((el,n)=>{const k=d.kpi[n],v=out[k[0]];if(v==null)return;const s=el.querySelector('span');s.textContent=(k[0]==='dq'&&v>0?'+':'')+num(Math.abs(v)<.5*Math.pow(10,-k[4])?0:v,k[4]);
   el.classList.toggle('alert',(k[0]==='dq'&&v>60)||(k[0]==='offset'&&v>3)||(k[0]==='stroke'&&Math.abs(v)>2.4));
   const h=hist[k[0]]||(hist[k[0]]=[]);const cv=el.querySelector('canvas'),g=cv.getContext('2d');g.clearRect(0,0,120,26);g.strokeStyle='rgba(143,224,255,.9)';g.lineWidth=1.6;g.beginPath();h.forEach((q,j)=>{const y=24-clamp((q-k[5])/(k[6]-k[5]))*22,x=j/59*120;j?g.lineTo(x,y):g.moveTo(x,y)});g.stroke()})}
 function recHist(){const d=DEF[id];d.kpi.forEach(k=>{const h=hist[k[0]]||(hist[k[0]]=[]);h.push(out[k[0]]||0);if(h.length>60)h.shift()})}

 /* ---------- câmera: órbita com arraste, roda e pinça; presets e câmera automática por etapa ---------- */
 function setCam(n){if(!cur)return;camI=n%cur.cams.length;const[p,t]=cur.cams[camI];tgt.copy(t);const d=p.clone().sub(t);dist=d.length();az=Math.atan2(d.x,d.z);el=Math.asin(d.y/dist)}
 const hit=$('#scnHit');const ptrs=new Map();let pinch0=0;
 hit.addEventListener('pointerdown',e=>{hit.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});drag={x:e.clientX,y:e.clientY,az,el,moved:false};if(ptrs.size===2){const[a,b]=[...ptrs.values()];pinch0=Math.hypot(a.x-b.x,a.y-b.y)/dist}});
 hit.addEventListener('pointermove',e=>{if(!ptrs.has(e.pointerId))return;ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});if(ptrs.size===2){const[a,b]=[...ptrs.values()];dist=clamp(Math.hypot(a.x-b.x,a.y-b.y)/pinch0,8,120);return}
  if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>4&&!drag.moved){drag.moved=true;if(auto){auto=false;texts()}}az=drag.az-dx*.006;el=clamp(drag.el+dy*.004,-.35,1.3)});
 const up=e=>{ptrs.delete(e.pointerId);if(!ptrs.size)drag=null};hit.addEventListener('pointerup',up);hit.addEventListener('pointercancel',up);
 hit.addEventListener('wheel',e=>{e.preventDefault();dist=clamp(dist*Math.exp(e.deltaY*.0012),8,120);if(auto){auto=false;texts()}},{passive:false});

 /* ---------- controles ---------- */
 $('#scnBack').onclick=()=>close();$('#scnWx').onclick=()=>WX&&WX.toggle();
 $('#scnPlay').onclick=()=>{play=!play;texts()};$('#scnSp').onclick=()=>{speed=speed===1?2:speed===2?.5:1;$('#scnSp').textContent=(speed===.5?'.5':speed)+'×'};
 $('#scnMov').onclick=()=>{motion=!motion;texts()};$('#scnPanB').onclick=()=>{const v=root.classList.toggle('showR');$('#scnPanB').setAttribute('aria-pressed',v)};
 const tl=$('#scnTl');const seek=e=>{const r=tl.getBoundingClientRect();T=clamp((e.clientX-r.left)/r.width,0,.999)*dur();stepN=-1};tl.addEventListener('pointerdown',e=>{seek(e);tl.setPointerCapture(e.pointerId);tl.onpointermove=seek});tl.addEventListener('pointerup',()=>tl.onpointermove=null);
 tl.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){T=Math.min(dur()-.01,T+2);e.preventDefault()}if(e.key==='ArrowLeft'){T=Math.max(0,T-2);e.preventDefault()}});
 function key(e){if(e.key==='Escape'){if(WX&&WX.isOpen()){WX.open(false);return}close();return}if(e.key===' '&&e.target===document.body){play=!play;texts();e.preventDefault()}
  if(e.key==='Tab'){const f=[...root.querySelectorAll('button,[tabindex="0"]')].filter(x=>x.offsetParent!==null);if(!f.length)return;if(!root.contains(document.activeElement)){e.preventDefault();f[0].focus();return}if(e.shiftKey&&document.activeElement===f[0]){e.preventDefault();f[f.length-1].focus()}else if(!e.shiftKey&&document.activeElement===f[f.length-1]){e.preventDefault();f[0].focus()}}}

 /* ---------- abrir e fechar ---------- */
 async function openS(k){if(!DEF[k])return;showMenu(false);const first=!open;
  if(cur){if(cur.world)scene.remove(cur.world);if(cur.holder)scene.remove(cur.holder)}
  id=k;if(!cache[k]){const c=DEF[k].build();c.holder=new THREE.Group();c.holder.add(c.rig);cache[k]=c;c.compiled=false}cur=cache[k];scene.add(cur.holder);if(cur.world)scene.add(cur.world);
  cur.holder.add(fl1,fl2);bd.sky.visible=k!=='pumps';bd.sea.visible=k!=='pumps';bd.U.uA.value=k==='tens'?.82:1;scene.background=k==='pumps'?new THREE.Color(0x0d1620):null;
  $('#scnLabs').innerHTML=cur.labs.map(l=>`<span class="scl">${l[1+L()]}</span>`).join('');
  T=0;stepN=-1;hist={};auto=true;setCam(0);camT.copy(tgt);mode='';weather();texts();
  scene.environment=env();
  if(first){open=true;root.hidden=false;document.body.classList.add('scnOn');onOpen(k);root.classList.remove('ready');root.querySelector('#scnFade').classList.remove('off');{const h=$('#scnT');h.tabIndex=-1;try{h.focus({preventScroll:true})}catch(e){}}}
  try{history.replaceState(history.state,'','#cenario/'+k)}catch(e){}
  ready=false;if(!cur.compiled){$('#scnFade').classList.remove('off');if(cur.ready)await cur.ready;if(id!==k)return;try{place(0,performance.now()/1000);await renderer.compileAsync(scene,cam)}catch(e){}cur.compiled=true}ready=true;
  requestAnimationFrame(()=>{root.classList.add('ready');$('#scnFade').classList.add('off')})}
 function close(){if(!open)return;open=false;root.hidden=true;document.body.classList.remove('scnOn');showMenu(false);onClose()}

 /* ---------- quadro a quadro ---------- */
 const tv=new THREE.Vector3();
 function place(dt,t){const W=WX?WX.s:{hs:1,vento:8,chuva:0,cloud:0,fogk:0,vis:20};
  // movimento do navio: mesma onda da cena principal (heave, arfagem e balanço)
  const heave=wave(0,0,t)*.45,mk=motion?1:0;const h=cur.holder;h.position.y=heave*mk;h.rotation.z=(wave(40,0,t)-wave(-40,0,t))/80*.25*mk;h.rotation.x=(wave(0,14,t-.4)-wave(0,-14,t-.4))/28*.35*mk;
  bd.U.uTime.value=t;bd.U.uSea.value.set(SEA.amp,SEA.chop);bd.U.uN.value=night();bd.U.uFog.value=W.fogk;
  // câmera: automática segue a etapa; livre usa a órbita
  if(auto&&cur.cams.length>1){const S=steps();let sn=0;S.forEach((s,n)=>{if(T>=s[0])sn=n});const ac=mode==='stop'?[0,0,1,0]:DEF[id].ac;const want=Math.min(cur.cams.length-1,ac[sn]??0);if(want!==camI)setCam(want)}
  if(!drag&&auto&&!reduced)az+=dt*.03;
  const k=1-Math.exp(-dt*3);camT.lerp(tgt,k);const ce=Math.cos(el);camP.set(camT.x+Math.sin(az)*ce*dist,camT.y+Math.sin(el)*dist,camT.z+Math.cos(az)*ce*dist);
  if(cur.camWorld){cam.position.copy(camP);cam.up.set(0,1,0);cam.lookAt(camT)}else{h.updateMatrixWorld();cam.position.copy(h.localToWorld(camP.clone()));tv.copy(camT);h.localToWorld(tv);cam.up.set(0,1,0).applyQuaternion(h.quaternion);cam.lookAt(tv)}
  if(cam.aspect!==innerWidth/innerHeight){cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix()}
  // luz e chuva conforme o clima
  const wc=W.cloud||0,n=night(),fla=WXU.flash.value;sun.intensity=2.4*(1-wc*.72)*(1-n*.9);hemi.intensity=.7*(1-wc*.3)*(1-n*.7)+fla*2;scene.environmentIntensity=.75*(1-wc*.4)*(1-n*.75)+fla*.4+(id==='pumps'?.25:0);
  fl1.intensity=fl2.intensity=(id==='pumps'?1:clamp(n+wc*.6))*900;
  const outside=id!=='pumps';cam.getWorldDirection(tv);const rc=cam.position.clone().addScaledVector(tv,22);const fall=lerp(9,11,clamp(W.chuva/45)),wind=W.vento*.5144*.9;
  rain.set({c:rc,size:V(70,50,70),v:V(wind,-fall,wind*.2),t,a:outside?.42:0,n:outside?clamp(W.chuva/45):0,len:.045,y0:.3});rain.U.uCol.value.setRGB(.8,.86,.92).multiplyScalar(1-n*.5);
  return {heave,wc,n}}
 function frame(dt,nowMs,busy){if(!open||!cur)return;frameN++;const t=nowMs/1000;
  if(play&&ready)T=(T+dt*speed*(mode==='warn'&&id!=='tens'?.8:1))%dur();
  const P=place(dt,t);const W=WX?WX.s:{};
  cur.update(T,{dt:dt*(play?1:0)||0,t,heave:motion?P.heave:0,mode,out,W,night:P.n,wc:P.wc,play});
  // etapa atual
  const S=steps();let sn=0;S.forEach((s,n)=>{if(T>=s[0])sn=n});if(sn!==stepN){stepN=sn;root.querySelectorAll('.scnSteps li').forEach((li,n)=>{li.classList.toggle('on',n===sn);li.classList.toggle('ok',n<sn)});const li=root.querySelector('.scnSteps li.on');if(li&&!reduced)li.scrollIntoView({block:'nearest',behavior:'smooth'})}
  $('#scnFill').style.width=(T/dur()*100).toFixed(2)+'%';$('#scnTl').setAttribute('aria-valuenow',Math.round(T/dur()*100));
  histT+=dt;if(histT>.12){histT=0;recHist()}if(frameN%3===0){kpiUpd();extraUpd()}
  // rótulos ancorados em 3D
  const lb=root.querySelectorAll('.scl');cur.labs.forEach((l,i)=>{const e=lb[i];if(!e)return;l[0].getWorldPosition(tv);tv.project(cam);const on=tv.z<1&&Math.abs(tv.x)<1.05&&Math.abs(tv.y)<1.05;e.style.opacity=on?1:0;if(on)e.style.transform=`translate3d(${((tv.x*.5+.5)*innerWidth).toFixed(0)}px,${((-tv.y*.5+.5)*innerHeight).toFixed(0)}px,0)`});
  if(document.hidden||(busy&&frameN%3))return;
  renderer.setRenderTarget(null);renderer.render(scene,cam)}
 if(/[?&]debug/.test(location.search))window.__scn={get cur(){return cur},view(p,t){auto=false;tgt.set(...t);camT.set(...t);const d=V(...p).sub(V(...t));dist=d.length();az=Math.atan2(d.x,d.z);el=Math.asin(d.y/dist)},setT:v=>{T=v;play=false}};
 return {open:openS,close,isOpen:()=>open,frame,key,retext:()=>{if(open)texts();if(!menu.hidden)buildMenu()},weather:()=>{if(open)weather()},menu:(btn)=>showMenu(menu.hidden,btn),ids:SCN_IDS}}
