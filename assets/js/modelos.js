// Fábrica de modelos procedurais: todos no mesmo padrão de materiais e detalhe.
// Para usar modelos oficiais (GLB), veja assets/models/README.md.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {M,G,add,beamG,tubeG,mergeMesh,bolts,clean,V,UP,ZR,lerp,clamp,smooth,rnd,pbr} from './kit.js';

export function makeGateValve(col=M.red,s=1){const g=new THREE.Group();
 add(g,G.rbox(1.6,1.8,1.4,.22),col);
 for(const k of[-1,1]){add(g,G.cyl(.55,.55,1.1,24),col,[k*1.25,0,0],ZR);add(g,G.cyl(.9,.9,.32,28),col,[k*1.85,0,0],ZR);bolts(g,.72,8,[k*2.03,0,0],M.steel,'x',.07,.2)}
 add(g,G.cyl(.62,.72,1.3,24),col,[0,1.5,0]);add(g,G.cyl(.08,.08,1.4,8),M.chrome,[0,2.6,0]);
 add(g,G.tor(.78,.08,36),col,[0,3.25,0],[Math.PI/2,0,0]);for(let i=0;i<3;i++)add(g,G.cyl(.05,.05,1.5,6),col,[0,3.25,0],[0,i*Math.PI/3,Math.PI/2]);
 g.scale.setScalar(s);return g}
export function makeRam(o={}){const g=new THREE.Group();const body=o.body||M.yellow,bon=o.bonnet||M.red;
 add(g,G.rbox(11,4.2,6.4,.55),body);add(g,G.cyl(3.15,3.15,4.6,48),bon);
 for(const k of[-1,1]){
  add(g,G.cyl(2.25,2.25,.8,48),bon,[k*5.9,0,0],ZR);bolts(g,1.95,16,[k*6.35,0,0],M.steel,'x',.13,.3);
  add(g,G.cyl(1.9,1.9,2.6,48),bon,[k*7.5,0,0],ZR);add(g,G.cyl(2.05,2.05,.45,48),body,[k*8.9,0,0],ZR);
  add(g,G.cyl(1.1,1.1,2,32),o.electric?M.dark:bon,[k*10.1,0,0],ZR);add(g,G.cyl(1.2,1.2,.35,32),M.dark,[k*11.2,0,0],ZR);
  if(o.electric){add(g,G.rbox(2.4,2.4,2.4,.25),M.dark,[k*12.6,0,0]);add(g,G.box(.06,2.42,2.42),M.lampC,[k*11.38,0,0])}
  add(g,G.rbox(1.2,.8,1,.15),M.dark,[k*4.6,2.3,1.6])}
 return g}
export function makeAnnular(col=M.yellow){const g=new THREE.Group();
 add(g,G.cyl(3.4,3.4,.8,48),M.red,[0,.4,0]);bolts(g,3,18,[0,.85,0]);
 add(g,G.cyl(4.42,4.6,4,64),col,[0,2.8,0]);add(g,new THREE.SphereGeometry(4.6,64,24,0,Math.PI*2,0,Math.PI*.42),col,[0,3.65,0]);
 for(let i=0;i<10;i++){const a=i/10*Math.PI*2;add(g,G.rbox(.7,1.3,.5,.12),M.dark,[Math.cos(a)*4.6,3.6,Math.sin(a)*4.6],[0,-a,0])}
 add(g,G.cyl(2.2,2.6,1.4,48),col,[0,8.4,0]);add(g,G.cyl(3,3,.7,48),M.red,[0,9.3,0]);bolts(g,2.6,16,[0,9.7,0]);
 g.userData.h=9.65;return g}
export function makeH4(){const g=new THREE.Group();
 add(g,G.cyl(3.8,3.8,3.2,64),M.dark,[0,1.6,0]);add(g,G.cyl(4,4,.5,64),M.grey,[0,.25,0]);add(g,G.cyl(3.3,3.3,.6,48),M.grey,[0,3.5,0]);
 for(let i=0;i<14;i++){const a=i/14*Math.PI*2;add(g,G.rbox(.8,2.2,.6,.12),M.grey,[Math.cos(a)*3.95,1.7,Math.sin(a)*3.95],[0,-a+Math.PI/2,0])}
 g.userData.h=3.8;return g}
export function makePod(){const g=new THREE.Group();
 add(g,G.rbox(2.6,5.2,2.6,.3),M.yellow,[0,2.6,0]);add(g,G.rbox(2.7,.7,2.7,.2),M.dark,[0,5.4,0]);add(g,G.box(1.8,2.6,.1),M.dark,[0,2.8,1.32]);
 for(let i=0;i<6;i++)add(g,G.cyl(.15,.15,.4,10),M.steel,[-.55+(i%3)*.55,2+(i>2?1.2:0),1.5],[Math.PI/2,0,0]);
 add(g,G.sph(.12,10),M.ledG,[.9,4.6,1.33]);return g}
export function makeBOP(o={}){const g=new THREE.Group();
 add(g,G.cyl(11,11.4,1.2,64),M.grey,[0,.6,0]);add(g,G.tor(11.2,.25,64),M.dark,[0,1.2,0],[Math.PI/2,0,0]);
 for(let i=0;i<8;i++){const a=i/8*Math.PI*2+.2;add(g,G.cyl(.5,.5,.3,16),M.dark,[Math.cos(a)*9,1.3,Math.sin(a)*9])}
 add(g,G.cyl(2.6,2.6,6,48),M.red,[0,4.4,0]);add(g,G.cyl(3.4,3.4,.9,48),M.red,[0,2,0]);add(g,G.cyl(3.4,3.4,.9,48),M.red,[0,7.2,0]);bolts(g,3,16,[0,7.7,0]);
 const valves=[];
 for(const k of[-1,1]){add(g,G.cyl(.7,.7,3.4,24),M.red,[k*4.2,4.4,0],ZR);const v=makeGateValve(M.red);v.position.set(k*7.6,4.4,0);g.add(v);valves.push(v);
  add(g,tubeG([[k*9.6,4.4,0],[k*12,3.8,1.2],[k*15,1.8,3],[k*20,1.4,6],[k*24,1.4,8]],.38),M.hoseGrey)}
 const h4=makeH4();h4.position.y=7.8;g.add(h4);
 let y=11.6;const ramYs=[];
 for(let i=0;i<(o.rams||3);i++){const r=makeRam(o);r.position.y=y+2.1;g.add(r);ramYs.push(y+2.1);y+=4.2;add(g,G.cyl(3.3,3.3,.7,48),o.bonnet||M.red,[0,y+.35,0]);y+=.7}
 const annYs=[];for(let i=0;i<(o.anns||1);i++){const a=makeAnnular(o.annCol);a.position.y=y;g.add(a);annYs.push(y+5);y+=a.userData.h}
 const l=makeH4();l.position.y=y;g.add(l);y+=3.8;
 add(g,G.sph(2.2),M.steel,[0,y+1.5,0]);y+=2.8;add(g,G.cyl(1.32,1.32,4,32),M.white,[0,y+2,0]);add(g,G.cyl(2.3,2.3,.8,48),M.grey,[0,y+4.2,0]);bolts(g,1.95,16,[0,y+4.65,0]);const top=y+4.6;
 const fy0=1.4,fy1=ramYs[ramYs.length-1]+3.6,posts=[[8.6,5.6],[-8.6,5.6],[8.6,-5.6],[-8.6,-5.6]],fr=[];
 for(const[x,z]of posts)fr.push(tubeG([[x,fy0,z],[x,fy1,z],[x*.93,fy1+2.5,z*.95],[x*.55,top-5,z*.62],[x*.3,top-2,z*.42],[x*.24,top-.8,z*.36]],.48,14));
 for(const yy of[fy0+.6,(fy0+fy1)/2,fy1]){fr.push(beamG(V(-8.6,yy,5.6),V(8.6,yy,5.6),.42,14),beamG(V(-8.6,yy,-5.6),V(8.6,yy,-5.6),.42,14),beamG(V(8.6,yy,-5.6),V(8.6,yy,5.6),.42,14),beamG(V(-8.6,yy,-5.6),V(-8.6,yy,5.6),.42,14))}
 g.add(mergeMesh(fr,M.yellow));
 const pods=[];for(const k of[-1,1]){const p=makePod();p.position.set(k*10.6,ramYs[1]-1,-6.2);g.add(p);pods.push(p);add(g,tubeG([[k*10.6,ramYs[1]+4.6,-6.2],[k*9.6,top-7,-4.5],[k*3,top-3.5,-1.6],[k*1.4,top-1.4,0]],.22),M.rubber)}
 for(let i=0;i<7;i++)add(g,G.cyl(.55,.55,4.4,24),M.white,[-5.4+i*1.8,ramYs[0]+.8,-7]);
 for(const k of[-1,1]){add(g,G.cyl(.34,.34,top-ramYs[0]-1,16),M.steel,[k*4.4,(top+ramYs[0]-1)/2,-4]);const v=makeGateValve(M.red,.7);v.position.set(k*4.4,ramYs[1]+3,-4.9);v.rotation.y=Math.PI/2;g.add(v)}
 const lad=[beamG(V(9.7,fy0,5.6),V(9.7,fy1,5.6),.08),beamG(V(11.1,fy0,5.6),V(11.1,fy1,5.6),.08)];for(let yy=fy0+1;yy<fy1;yy+=1.1)lad.push(beamG(V(9.7,yy,5.6),V(11.1,yy,5.6),.06));g.add(mergeMesh(lad,M.yellow));
 const leds=[add(g,G.sph(.18,10),M.ledG,[8.6,fy1+.6,5.7]),add(g,G.sph(.18,10),M.ledR,[-8.6,fy1+.6,5.7])];
 g.userData={top,ramYs,annYs,valves,pods,h4,leds};return g}
export function makeTensioner(L=20){const g=new THREE.Group();
 add(g,G.rbox(2.8,1.3,2.4,.18),M.blue,[0,.65,0]);for(const k of[-1,1])add(g,G.rbox(.45,2,1.5,.12),M.blue,[k*.95,1.9,0]);add(g,G.cyl(.32,.32,2.9,16),M.steel,[0,2.1,0],ZR);
 const b0=2.6,bl=L*.55;add(g,G.cyl(.9,.9,bl,48),M.red,[0,b0+bl/2,0]);add(g,G.cyl(1.08,1.08,.7,48),M.red,[0,b0+.35,0]);add(g,G.cyl(1.08,1.08,.7,48),M.red,[0,b0+bl-.35,0]);
 bolts(g,.98,12,[0,b0+.72,0],M.steel,'y',.08,.15);bolts(g,.98,12,[0,b0+bl-.72,0],M.steel,'y',.08,.15);
 for(const k of[.33,.66])add(g,G.cyl(.96,.96,.28,48),M.dark,[0,b0+bl*k,0]);
 add(g,G.rbox(.75,1.5,.6,.1),M.dark,[1.05,b0+bl*.42,0]);add(g,tubeG([[1.1,b0+bl*.42-.75,0],[1.5,b0+1.5,.3],[1.3,1.2,.9],[.4,.6,1.3]],.13),M.rubber);
 add(g,tubeG([[1.1,b0+bl*.42+.75,0],[1.35,b0+bl-.5,.2],[.9,b0+bl+.2,.6]],.11),M.rubber);
 const rod=new THREE.Group();rod.position.y=b0+bl;g.add(rod);const rl=L*.45;
 add(rod,G.cyl(.4,.4,rl,32),M.chrome,[0,rl/2,0]);add(rod,G.cyl(.55,.55,.5,24),M.dark,[0,rl,0]);add(rod,G.rbox(1,1.3,1,.14),M.red,[0,rl+.8,0]);add(rod,G.cyl(.26,.26,1.7,12),M.steel,[0,rl+1,0],[Math.PI/2,0,0]);
 g.userData={rod,base:b0+bl,closed:b0+bl+rl+1.3};return g}
export function makeRiserJoint(L=24,o={}){const g=new THREE.Group();const h=L/2;
 add(g,G.cyl(1.25,1.25,L-1.6,48),o.body||M.white);
 for(const k of[-1,1]){add(g,G.cyl(2.3,2.3,.8,56),M.grey,[0,k*(h-.4),0]);add(g,G.cyl(1.55,2.25,.6,48),M.grey,[0,k*(h-1.1),0]);bolts(g,1.95,14,[0,k*(h-.4)+k*.45,0])}
 for(const[x,z,r,m]of[[2,0,.32,M.steel],[-2,0,.32,M.steel],[0,2,.2,M.dark],[0,-2,.2,M.dark],[1.42,1.42,.15,M.red],[-1.42,-1.42,.15,M.blue]]){add(g,G.cyl(r,r,L-.3,16),m,[x,0,z]);for(const k of[-1,1])add(g,G.cyl(r*1.55,r*1.55,.8,16),M.grey,[x,k*(h-1.5),z])}
 for(const yy of[-h*.48,0,h*.48]){add(g,G.cyl(2.32,2.32,.3,56),M.dark,[0,yy,0]);for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;add(g,G.rbox(.5,.5,.5,.08),M.dark,[Math.cos(a)*2.3,yy,Math.sin(a)*2.3])}}
 add(g,G.cyl(1.29,1.29,2.2,40),M.dark,[0,h-2.7,0]);add(g,G.cyl(1.29,1.29,2.2,40),M.dark,[0,-h+2.7,0]);
 if(o.mpd){add(g,G.cyl(2,2,6,48),M.blue,[0,0,0]);for(const k of[-1,1]){add(g,G.cyl(.45,.45,3,16),M.steel,[k*3.2,1.4,0],ZR);const v=makeGateValve(M.red,.55);v.position.set(k*4.6,1.4,0);g.add(v)}}
 return g}
export function makeROV(){const g=new THREE.Group();const X=3,Y0=-1.6,Y1=.4,Z=2;const fr=[];
 const c=[[-X,Y0,-Z],[X,Y0,-Z],[X,Y0,Z],[-X,Y0,Z],[-X,Y1,-Z],[X,Y1,-Z],[X,Y1,Z],[-X,Y1,Z]].map(p=>V(...p));
 for(const[a,b]of[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7],[0,5],[3,6]])fr.push(beamG(c[a],c[b],.13,4));
 fr.push(beamG(V(-X-.3,Y0-.3,-Z+.4),V(X+.3,Y0-.3,-Z+.4),.12,6),beamG(V(-X-.3,Y0-.3,Z-.4),V(X+.3,Y0-.3,Z-.4),.12,6));
 g.add(mergeMesh(fr,M.yellow));
 add(g,G.rbox(6.4,1.6,4.3,.4),M.yellow,[0,1.25,0]);add(g,G.box(6.42,.18,4.32),M.black,[0,.55,0]);
 for(const[x,z,a]of[[2.6,1.7,.6],[-2.6,1.7,-.6],[2.6,-1.7,-.6],[-2.6,-1.7,.6]]){const t=new THREE.Group();t.position.set(x,-.6,z);t.rotation.y=a;g.add(t);add(t,G.tor(.48,.1,28),M.black);add(t,G.cyl(.18,.18,.9,12),M.dark,[0,0,0],[Math.PI/2,0,0])}
 for(const x of[-1.2,1.2])add(g,G.tor(.45,.1,28),M.black,[x,1.3,0],[Math.PI/2,0,0]);
 add(g,G.sph(.38,20),M.glass,[0,-.3,2.1]);
 const lamps=[];for(const x of[-2.2,2.2]){add(g,G.cyl(.3,.3,.5,16),M.dark,[x,.1,2.2],[Math.PI/2,0,0]);lamps.push(add(g,G.cyl(.24,.24,.06,16),M.lampW,[x,.1,2.48],[Math.PI/2,0,0]))}
 const arm=[V(1.4,-1.4,2.1),V(1.8,-1.2,3.2),V(1.2,-1.8,4.2),V(1.1,-2.1,4.7)];for(let i=0;i<3;i++){add(g,beamG(arm[i],arm[i+1],.16,10),i%2?M.chrome:M.dark);add(g,G.sph(.24,12),M.dark,arm[i].toArray())}
 add(g,tubeG([[0,2,0],[0,3.5,-.6],[.5,6,-1.8]],.12),M.rubber);g.userData.lamps=lamps;return g}
export function makeTopDrive(){const g=new THREE.Group();
 add(g,G.box(.5,7.4,.5),M.dark,[-1.5,3.6,-1.2]);add(g,G.box(.5,7.4,.5),M.dark,[1.5,3.6,-1.2]);add(g,G.rbox(3.6,1.2,1,.12),M.dark,[0,6.4,-1.2]);
 add(g,G.rbox(2.6,1.7,2.4,.25),M.red,[0,3.3,0]);add(g,G.rbox(2.4,2.4,2.2,.3),M.red,[0,5.4,0]);add(g,G.cyl(1,1,.4,32),M.dark,[0,6.8,0]);
 add(g,tubeG([[0,7,0],[0,8,.4],[0,8.3,1.4],[0,7.6,2]],.24),M.red);add(g,G.cyl(.3,.3,2.2,16),M.steel,[0,1.6,0]);add(g,G.tor(1,.18,32),M.red,[0,2.2,0],[Math.PI/2,0,0]);
 for(const k of[-1,1])add(g,G.cyl(.09,.09,4,8),M.chrome,[k*.75,.2,0]);add(g,G.rbox(2.1,.6,1.2,.15),M.yellow,[0,-1.8,0]);
 add(g,tubeG([[1.3,5.4,.6],[1.8,4.4,1],[1.4,3,.6]],.1),M.rubber);return g}
export function makeRoughneck(){const g=new THREE.Group();
 add(g,G.rbox(2,.8,2,.15),M.dark,[0,.4,0]);add(g,G.cyl(.45,.55,2.6,24),M.red,[0,2,0]);
 const arm=new THREE.Group();arm.position.y=3.2;g.add(arm);add(arm,G.rbox(3.4,.8,.9,.15),M.red,[1.6,0,0]);add(arm,G.cyl(.18,.18,2.8,12),M.chrome,[1.6,-.6,.35],ZR);
 const head=new THREE.Group();head.position.set(3.6,-.2,0);arm.add(head);add(head,G.rbox(1.8,2.4,1.6,.2),M.red);
 for(const yy of[-.6,.6])add(head,G.tor(.55,.18,24),M.dark,[.9,yy,0],[Math.PI/2,0,0]);g.userData.arm=arm;return g}
export function makeDrawworks(){const g=new THREE.Group();
 add(g,G.rbox(6,.6,3.6,.12),M.dark,[0,.3,0]);add(g,G.rbox(1.6,2.8,3.2,.2),M.blue,[-2.2,2,0]);add(g,G.rbox(1.6,2.8,3.2,.2),M.blue,[2.2,2,0]);
 const drum=new THREE.Group();drum.position.set(0,2.2,0);g.add(drum);add(drum,G.cyl(1.05,1.05,2.6,40),M.dark,[0,0,0],ZR);
 for(let i=0;i<9;i++)add(drum,G.tor(1.08,.09,32),M.black,[-1.1+i*.27,0,0],[0,Math.PI/2,0]);for(const k of[-1,1])add(drum,G.cyl(1.5,1.5,.25,40),M.red,[k*1.35,0,0],ZR);
 for(const k of[-1,1])add(g,G.cyl(.9,.9,1.6,32),M.blue,[k*3.5,2,0],ZR);g.userData.drum=drum;return g}
export function makeRotary(){const g=new THREE.Group();add(g,G.rbox(4,.9,4,.2),M.dark,[0,.45,0]);add(g,G.cyl(1.6,1.6,.4,48),M.orange,[0,1.1,0]);add(g,G.cyl(.6,.6,.45,24),M.black,[0,1.15,0]);return g}
export function makeMudPump(){const g=new THREE.Group();
 add(g,G.rbox(7,.5,3.6,.1),M.dark,[0,.25,0]);add(g,G.rbox(3.8,2.6,3,.35),M.red,[-.8,1.8,0]);
 for(let i=0;i<3;i++){add(g,G.rbox(1.6,1.6,.9,.15),M.steel,[2.1,1.6,-1+i]);add(g,G.cyl(.32,.32,.4,16),M.chrome,[2.95,1.6,-1+i],ZR)}
 add(g,G.sph(.75,24),M.dark,[2.1,3,0]);add(g,G.cyl(.25,.25,2.4,12),M.steel,[2.1,2.5,0],[Math.PI/2,0,0]);add(g,G.cyl(1,1,2.6,32),M.blue,[-3.1,1.6,0],[Math.PI/2,0,0]);return g}
export function makeCrane(){const g=new THREE.Group();
 add(g,G.cyl(1,1.3,6,32),M.yellow,[0,3,0]);add(g,G.cyl(1.4,1.4,.5,32),M.dark,[0,6.2,0]);
 const tur=new THREE.Group();tur.position.y=6.4;g.add(tur);add(tur,G.rbox(2.6,1.6,2.4,.3),M.yellow,[0,.8,0]);add(tur,G.rbox(1.3,1.5,1.2,.15),M.glass,[.9,1.8,.9]);
 const b1=new THREE.Group();b1.position.set(-.4,1.6,0);b1.rotation.z=1.05;tur.add(b1);add(b1,G.rbox(9,1,1,.15),M.yellow,[4.5,0,0]);add(b1,G.cyl(.25,.25,6,12),M.chrome,[3,-.8,0],[0,0,Math.PI/2]);
 const b2=new THREE.Group();b2.position.set(9,0,0);b2.rotation.z=-1.9;b1.add(b2);add(b2,G.rbox(8,.8,.8,.12),M.yellow,[4,0,0]);add(b2,G.cyl(.4,.4,1.2,16),M.dark,[0,0,0],[Math.PI/2,0,0]);
 const gr=new THREE.Group();gr.position.set(8,0,0);b2.add(gr);add(gr,G.rbox(.8,1.6,1.2,.12),M.red,[0,-.8,0]);g.userData.tur=tur;return g}
export function makeDerrick(H=47){const g=new THREE.Group();const lv=12,h0=7.4,h1=2.4,cs=[[1,1],[1,-1],[-1,-1],[-1,1]];
 const Pt=(i,k)=>{const t=i/lv,hw=lerp(h0,h1,t);return V(cs[k][0]*hw,H*t,cs[k][1]*hw)};const A=[],Rd=[];
 for(let i=0;i<lv;i++){const tgt=i>=lv-2?Rd:A;for(let k=0;k<4;k++){const k2=(k+1)%4;tgt.push(beamG(Pt(i,k),Pt(i+1,k),.34,6),beamG(Pt(i,k),Pt(i,k2),.17,5),beamG(Pt(i,k),Pt(i+1,k2),.11,4),beamG(Pt(i,k2),Pt(i+1,k),.11,4))}}
 g.add(mergeMesh(A,M.lattice));g.add(mergeMesh(Rd,M.red));
 add(g,G.rbox(7,.5,7,.1),M.dark,[0,H*.55,0]);
 add(g,G.rbox(6,2.6,6,.3),M.yellow,[0,H+1.3,0]);for(const x of[-1.7,1.7])add(g,G.cyl(.55,.55,4.5,20),M.chrome,[x,H+4.6,0]);add(g,G.rbox(4.8,.7,1.4,.1),M.dark,[0,H+7,0]);
 add(g,G.sph(.4,12),M.ledR,[0,H+7.7,0]);
 // luzes de serviço ao longo das pernas (acendem no modo noite)
 const lg=new THREE.SphereGeometry(.22,8,6),lights=new THREE.InstancedMesh(lg,M.lampN,lv*4);const d=new THREE.Object3D();let n=0;for(let i=1;i<=lv;i++)for(let k=0;k<4;k++){const p=Pt(i,k);d.position.copy(p).multiplyScalar(1.04);d.position.y=p.y;d.updateMatrix();lights.setMatrixAt(n++,d.matrix)}g.add(lights);
 const sY=H*.42,sHW=lerp(h0,h1,.42);add(g,G.box(sHW*1.7,sHW*1.7*172/544,.3),M.sign,[0,sY,sHW+.25]);
 return g}
function hullGeometry(){
 const NX=96,NY=20,YK=-7,YD=9.6;const xr=y=>{const yn=(y-YK)/(YD-YK);return[lerp(-77,-82,yn),lerp(54,69,Math.pow(yn,.75))]};
 const hb=(x,y)=>{const yn=(y-YK)/(YD-YK),[xs,xb]=xr(y);let w=13;if(x>26){const t=clamp((x-26)/(xb-26));w*=Math.pow(Math.max(0,1-Math.pow(t,lerp(1.5,2.8,yn))),.55)}
  if(x<xs+7){const t=clamp((xs+7-x)/7);w*=1-.1*t}w*=.8+.2*Math.sqrt(clamp((y-YK)/2.4));return w};
 const cRed=new THREE.Color(0x8a2023),cBlk=new THREE.Color(0x16191c),cBlue=new THREE.Color(0x1b2e4f),cWht=new THREE.Color(0xe7eaec);
 const colY=y=>y<-.4?cRed:y<.6?cBlk:y<9?cBlue:cWht;const parts=[];
 const mk=(pos,col,uv,idx)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g};
 for(const side of[1,-1]){const pos=[],col=[],uv=[],idx=[];
  for(let j=0;j<=NY;j++){const y=lerp(YK,YD,j/NY),[xs,xb]=xr(y);for(let i=0;i<=NX;i++){const x=lerp(xs,xb,i/NX);pos.push(x,y,side*hb(x,y));const c=colY(y);col.push(c.r,c.g,c.b);uv.push(x/10,y/10)}}
  for(let j=0;j<NY;j++)for(let i=0;i<NX;i++){const a=i+(NX+1)*j,b=a+1,c=a+NX+2,d=a+NX+1;if(side>0)idx.push(a,b,c,a,c,d);else idx.push(a,c,b,a,d,c)}
  parts.push(mk(pos,col,uv,idx))}
 {const pos=[],col=[],uv=[],idx=[];const[xs,xb]=xr(YK);for(let i=0;i<=NX;i++){const x=lerp(xs,xb,i/NX),w=hb(x,YK);pos.push(x,YK,w,x,YK,-w);col.push(cRed.r,cRed.g,cRed.b,cRed.r,cRed.g,cRed.b);uv.push(x/10,w/10,x/10,-w/10)}
  for(let i=0;i<NX;i++){const a=i*2;idx.push(a,a+1,a+3,a,a+3,a+2)}parts.push(mk(pos,col,uv,idx))}
 {const pos=[],col=[],uv=[],idx=[];for(let j=0;j<=NY;j++){const y=lerp(YK,YD,j/NY),[xs]=xr(y),w=hb(xs,y),c=colY(y);pos.push(xs,y,w,xs,y,-w);col.push(c.r,c.g,c.b,c.r,c.g,c.b);uv.push(w/10,y/10,-w/10,y/10)}
  for(let j=0;j<NY;j++){const a=j*2;idx.push(a,a+2,a+3,a,a+3,a+1)}parts.push(mk(pos,col,uv,idx))}
 const hull=mergeGeometries(parts);
 const dpos=[],duv=[],didx=[];const yd=8,[xs,xb]=xr(yd);for(let i=0;i<=NX;i++){const x=lerp(xs,xb,i/NX),w=hb(x,yd)*.97;dpos.push(x,yd,-w,x,yd,w);duv.push(x/6,-w/6,x/6,w/6)}
 for(let i=0;i<NX;i++){const a=i*2;didx.push(a,a+1,a+3,a,a+3,a+2)}const deck=new THREE.BufferGeometry();deck.setAttribute('position',new THREE.Float32BufferAttribute(dpos,3));deck.setAttribute('uv',new THREE.Float32BufferAttribute(duv,2));deck.setIndex(didx);deck.computeVertexNormals();
 return{hull,deck,hb}}
export function makeShip(){const s=new THREE.Group();const H=hullGeometry();const hull=new THREE.Mesh(H.hull,M.hull);hull.receiveShadow=hull.castShadow=true;s.add(hull);const deck=new THREE.Mesh(H.deck,M.deck);deck.receiveShadow=true;s.add(deck);
 for(const[x0,x1,hw,y]of[[33,58,11,8],[34,57,11,11],[36,55,10.4,14],[39,53,9.4,17]]){const w=x1-x0,cx=(x0+x1)/2;add(s,G.rbox(w,3,hw*2,.2),M.white,[cx,y+1.5,0]);add(s,G.box(w-.8,.85,hw*2+.06),M.glass,[cx,y+1.85,0]);add(s,G.box(.06,.85,hw*2-.8),M.glass,[x1+.01,y+1.85,0]);add(s,G.box(w+.5,.22,hw*2+.5),M.white,[cx,y+3.05,0])}
 add(s,G.rbox(3.6,2.6,30,.15),M.white,[51.5,21.5,0]);add(s,G.box(.06,1,29),M.glass,[53.35,21.7,0]);
 add(s,G.cyl(.22,.3,9,12),M.white,[46,26,0]);add(s,G.box(.4,.15,5),M.dark,[46,28.2,0]);add(s,G.box(.3,.12,3.5),M.dark,[46,29.4,0]);add(s,G.cyl(.55,.55,.4,16),M.white,[46,30.6,0]);
 add(s,G.rbox(4,1.8,3,.15),M.white,[44,21.6,-6]);add(s,G.rbox(4,1.8,3,.15),M.white,[44,21.6,6]);
 const hd=new THREE.Group();hd.position.set(68,23.5,0);s.add(hd);
 add(hd,new THREE.CylinderGeometry(10.5,10.5,.5,8),[M.dark,M.heli,M.dark],[0,0,0],[0,Math.PI/8,0]);
 add(hd,new THREE.CylinderGeometry(11.6,10.6,.9,8,1,true),new THREE.MeshStandardMaterial({color:0x2a2f33,roughness:.9,side:THREE.DoubleSide,transparent:true,opacity:.7}),[0,.2,0],[0,Math.PI/8,0]);
 const hs=[];for(let a=0;a<8;a++){const an=a/8*Math.PI*2+Math.PI/8;const p=V(Math.cos(an)*9.5,-.3,Math.sin(an)*9.5);if(p.x<0)hs.push(beamG(p.clone().add(V(68,23.5,0)),V(56,16,p.z*.8),.28));else hs.push(beamG(p.clone().add(V(68,23.5,0)),V(62,9,p.z*.6),.3))}s.add(mergeMesh(hs,M.dark));
 for(const z of[-12.4,12.4]){add(s,new THREE.CapsuleGeometry(1.25,4,8,16),M.orange,[30,12.6,z],ZR);add(s,G.box(4.4,.6,.6),M.dark,[30,11.6,z*.97]);add(s,beamG(V(28,8,z*.92),V(28,13.4,z),.15),M.dark);add(s,beamG(V(32,8,z*.92),V(32,13.4,z),.15),M.dark)}
 for(const z of[-3,3]){add(s,G.cyl(1.3,1.3,9,24),M.white,[-74,12.5,z]);add(s,G.cyl(1.32,1.32,1.2,24),M.black,[-74,17.4,z])}
 const sub=[];for(const[x,z]of[[9,9],[9,-9],[-9,-9],[-9,9]])sub.push(beamG(V(x,8,z),V(x,16,z),.5,8));for(const[a,b]of[[[9,9],[9,-9]],[[-9,9],[-9,-9]],[[9,-9],[-9,-9]],[[9,9],[-9,9]]]){sub.push(beamG(V(a[0],8.4,a[1]),V(b[0],15.6,b[1]),.25,6),beamG(V(a[0],15.6,a[1]),V(b[0],8.4,b[1]),.25,6))}s.add(mergeMesh(sub,M.grey));
 add(s,G.rbox(21,1,21,.15),M.deck,[0,16.5,0]);
 for(const[x,z,w,d]of[[0,-10.2,20,.3],[-10.2,0,.3,20]])add(s,G.box(w,6,d),M.wall,[x,20,z]);
 const der=makeDerrick();der.position.y=17;s.add(der);
 const td=makeTopDrive();s.add(td);const wires=[0,1,2,3].map(()=>add(s,G.cyl(.06,.06,1,6),M.black));const dpipe=add(s,G.cyl(.24,.24,1,12),M.steel);
 const rot=makeRotary();rot.position.set(0,17,0);s.add(rot);
 const rn=makeRoughneck();rn.position.set(4,17,4.2);rn.rotation.y=Math.PI*.9;s.add(rn);
 const dw=makeDrawworks();dw.position.set(-5,17,6.5);s.add(dw);
 add(s,G.rbox(5,3.6,4,.25),M.white,[6.5,18.8,-7]);add(s,G.box(4.6,1.3,.06),M.glass,[6.5,19.4,-4.98]);
 add(s,G.cyl(1.6,1.6,2.4,40),M.red,[0,14.6,0]);add(s,beamG(V(1.4,14.6,0),V(8,14.2,0),.45),M.red);
 const kc=[];for(const[x,z,ry]of[[-12,10.5,-.6],[12,-10.5,2.5]]){const c=makeCrane();c.position.set(x,8,z);c.rotation.y=ry;s.add(c);kc.push(c)}
 const pc=[];for(const[x,z,a]of[[-46,11,.3],[24,-11.5,2.6]]){const g=new THREE.Group();g.position.set(x,8,z);s.add(g);add(g,G.cyl(1.4,1.8,9,32),M.yellow,[0,4.5,0]);const t=new THREE.Group();t.position.y=9;t.rotation.y=a;g.add(t);add(t,G.rbox(3.6,2.6,3,.3),M.yellow,[0,1.3,0]);
  const L=30,el=.75,tip=V(Math.cos(el)*L,1.6+Math.sin(el)*L,0),bm=[];const cr=(tt,k)=>{const h=lerp(.9,.35,tt);const c=V(0,1.6,0).lerp(tip,tt);return c.add(V(-Math.sin(el)*(k<2?h:-h),Math.cos(el)*(k<2?h:-h),k%2?h:-h))};
  for(let k=0;k<4;k++)bm.push(beamG(cr(0,k),cr(1,k),.13,5));for(let i=0;i<14;i++){const a0=i/14,a1=(i+1)/14;bm.push(beamG(cr(a0,0),cr(a1,1),.07,4),beamG(cr(a0,2),cr(a1,3),.07,4),beamG(cr(a0,0),cr(a1,2),.07,4),beamG(cr(a0,1),cr(a1,3),.07,4))}
  t.add(mergeMesh(bm,M.yellow));t.add(mergeMesh([beamG(tip,tip.clone().add(V(0,-12,0)),.05,4)],M.black));add(t,G.rbox(.9,1.2,.9,.1),M.red,[tip.x,tip.y-12.6,0]);pc.push({t,a})}
 {const n=60,im=new THREE.InstancedMesh(G.cyl(.22,.22,12,10),M.pipe,n),d=new THREE.Object3D();for(let i=0;i<n;i++){d.position.set(-58,8.4+Math.floor(i/15)*.46,3.6+(i%15)*.48+(Math.floor(i/15)%2)*.24);d.rotation.set(0,0,Math.PI/2);d.updateMatrix();im.setMatrixAt(i,d.matrix)}s.add(im);for(const x of[-63,-58,-53])add(s,G.box(.6,.6,8),M.yellow,[x,8.3,7.4])}
 {const n=8,im=new THREE.InstancedMesh(G.cyl(1.3,1.3,18,32),M.white,n),im2=new THREE.InstancedMesh(G.cyl(2.2,2.2,.7,32),M.grey,n*2),d=new THREE.Object3D();
  for(let i=0;i<n;i++){const x=-34,y=9.4+Math.floor(i/4)*2.6,z=-11+(i%4)*2.8;d.position.set(x,y,z);d.rotation.set(0,0,Math.PI/2);d.updateMatrix();im.setMatrixAt(i,d.matrix);for(const k of[-1,1]){d.position.set(x+k*9,y,z);d.updateMatrix();im2.setMatrixAt(i*2+(k>0?1:0),d.matrix)}}s.add(im,im2)}
 const mm=new THREE.Group();mm.position.set(-24,8,9);s.add(mm);const fr=[];for(const[x,z]of[[-5,-3.5],[5,-3.5],[-5,3.5],[5,3.5]])fr.push(beamG(V(x,0,z),V(x,6,z),.2));for(const[a,b]of[[[-5,-3.5],[5,-3.5]],[[-5,3.5],[5,3.5]],[[-5,-3.5],[-5,3.5]],[[5,-3.5],[5,3.5]]])fr.push(beamG(V(a[0],6,a[1]),V(b[0],6,b[1]),.2));mm.add(mergeMesh(fr,M.white));add(mm,G.box(10.6,.3,7.4),M.wall,[0,6.2,0]);
 for(const z of[-1.6,1.9]){const p=makeMudPump();p.scale.setScalar(.62);p.position.set(0,0,z);mm.add(p)}
 for(let i=0;i<3;i++)add(s,G.rbox(2.6,2,3.2,.2),M.blue,[-16,9,-7+i*3.5]);
 for(const[x,z,c]of[[-70,8,0x2f6db3],[-70,3,0xc8242b],[-64,-10,0xe9eef2],[-70,-10,0x2f6db3]])add(s,G.rbox(5.8,2.5,2.4,.08),pbr(c,.3,.55),[x,9.25,z]);
 const disp=new THREE.Group();disp.position.set(-19,8,-11);s.add(disp);add(disp,G.rbox(7,.5,5,.1),M.yellow,[0,.25,0]);const ra=makeRam();ra.scale.setScalar(.26);ra.position.set(0,1.1,0);disp.add(ra);const an=makeAnnular();an.scale.setScalar(.26);an.position.set(0,1.75,0);disp.add(an);
 for(const[x,y,z]of[[-70,17,-11],[-40,12,-12],[20,12,12],[-80,10,0],[60,13,11],[60,13,-11],[-30,15,12],[10,10,-12]])add(s,G.sph(.3,8),M.lampN,[x,y,z]);
 s.userData={td,wires,dpipe,rn,dw,kc,pc,der,disp,mm};return s}
export function makeBit(){const g=new THREE.Group();
 add(g,G.cyl(1.2,1.45,2.8,40),M.steel,[0,7.6,0]);for(let i=0;i<9;i++)add(g,G.tor(1.28+i*.02,.07,40),M.steel,[0,6.4+i*.28,0],[Math.PI/2,0,0]);
 add(g,G.cyl(2.25,2.25,.6,48),M.steel,[0,6,0]);add(g,G.cyl(2.35,2.15,1.8,48),M.steel,[0,4.9,0]);
 const tooth=new THREE.ConeGeometry(.2,.48,10);tooth.translate(0,.24,0);const cones=[];
 for(let k=0;k<3;k++){const leg=new THREE.Group();leg.rotation.y=k*Math.PI*2/3;g.add(leg);
  add(leg,G.rbox(1.9,3.8,1.3,.3),M.steel,[0,3,1.75],[-.2,0,0]);add(leg,G.cyl(.32,.32,.6,16),M.dark,[0,4.2,2.35],[Math.PI/2,0,0]);
  const cg=new THREE.Group();cg.position.set(0,1.5,1.5);cg.rotation.x=-2.45;leg.add(cg);const sp=new THREE.Group();cg.add(sp);
  add(sp,G.cyl(.4,1.55,2.3,40),M.steel,[0,1.15,0]);add(sp,G.cyl(1.55,1.55,.35,40),M.steel,[0,0,0]);
  const rows=[[.12,1.62,14],[.95,1.05,11],[1.75,.58,7]];const n=rows.reduce((s,r)=>s+r[2],0);const im=new THREE.InstancedMesh(tooth,M.chrome,n);const d=new THREE.Object3D();let c=0;
  for(const[y,r,m]of rows)for(let i=0;i<m;i++){const t=i/m*Math.PI*2+y;d.position.set(Math.cos(t)*r,y,Math.sin(t)*r);d.quaternion.setFromUnitVectors(UP,V(Math.cos(t),.55,Math.sin(t)).normalize());d.updateMatrix();im.setMatrixAt(c++,d.matrix)}
  sp.add(im);cones.push(sp)}
 for(let k=0;k<3;k++){const a=k*Math.PI*2/3+Math.PI/3;add(g,G.cyl(.28,.32,.8,16),M.dark,[Math.cos(a)*1.6,3.6,Math.sin(a)*1.6])}
 g.userData.cones=cones;return g}

/* ---------- peixes (nado animado no shader) ---------- */
export const fishTime={value:0};
export function fishGeometry(dark,mid,belly){
 const pts=[];for(let i=0;i<=20;i++){const t=i/20;let r=Math.pow(Math.sin(Math.PI*(.06+.9*t)),.75)*.2;if(t<.22)r*=.3+.7*(t/.22);pts.push(new THREE.Vector2(Math.max(.006,r),t))}
 const body=new THREE.LatheGeometry(pts,14);body.scale(1,1,.48);body.rotateZ(-Math.PI/2);body.translate(-.5,0,0);
 const ts=new THREE.Shape();ts.moveTo(-.46,0);ts.quadraticCurveTo(-.6,.06,-.74,.22);ts.lineTo(-.67,.02);ts.lineTo(-.74,-.2);ts.quadraticCurveTo(-.6,-.05,-.46,0);
 const ds=new THREE.Shape();ds.moveTo(-.16,.15);ds.lineTo(.06,.17);ds.lineTo(-.1,.29);ds.lineTo(-.16,.15);
 const as=new THREE.Shape();as.moveTo(-.2,-.13);as.lineTo(-.05,-.15);as.lineTo(-.18,-.22);as.lineTo(-.2,-.13);
 const parts=[clean(body),clean(new THREE.ShapeGeometry(ts)),clean(new THREE.ShapeGeometry(ds)),clean(new THREE.ShapeGeometry(as))];
 const cols=parts.map((g,pi)=>{const p=g.attributes.position,c=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);let col;
  if(pi>0)col=mid.clone().multiplyScalar(.7);else{const k=smooth((y+.12)/.24);col=belly.clone().lerp(mid,smooth(k*1.6)).lerp(dark,smooth((k-.55)/.45));col.multiplyScalar(.92+.08*Math.sin(x*60))}
  c[i*3]=col.r;c[i*3+1]=col.g;c[i*3+2]=col.b}g.setAttribute('color',new THREE.BufferAttribute(c,3));return g});
 return mergeGeometries(cols)}
export function fishMat(){const m=new THREE.MeshStandardMaterial({vertexColors:true,metalness:.62,roughness:.3,side:THREE.DoubleSide});
 m.onBeforeCompile=s=>{s.uniforms.uTime=fishTime;s.vertexShader='attribute float aPhase;\nuniform float uTime;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfloat tw=smoothstep(.3,-.75,position.x);\ntransformed.z+=sin(uTime*7.5+aPhase-position.x*5.5)*.12*tw;')};return m}
