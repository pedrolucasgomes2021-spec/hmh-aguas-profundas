// Modo Cinema: sequência de planos com câmera animada sobre a cena principal, transições (fade, corte com desfoque, giro rápido),
// barras de cinema, correção de cor, granulação e vinheta numa única passada final (barata), legendas e barra de controles.
// Não cria cena nem renderer: usa os da página e só assume a câmera enquanto está ativo.
import * as THREE from 'three';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {wave,clamp,lerp,smooth,V} from './kit.js';

const PI=Math.PI,ease=t=>{t=clamp(t);return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2};
const TX={
 pt:{celular:'Celular',giro:'Giroscópio',voltarPlanos:'Voltar aos planos',livre:'CÂMERA LIVRE · CELULAR',gravando:'GRAVANDO',sair:'Sair',cor:'Cor',luz:'Luz',mar:'Mar',planos:'Planos',fov:'Lente',grao:'Grão',ocultar:'H ocultar',mostrar:'H mostrar controles',play:'REPRODUZINDO · ARRASTE PARA OLHAR',pause:'PAUSADO · ARRASTE PARA OLHAR',
  auto:'Auto',fixo:'Fixo',dia:'Dia',dourada:'Hora dourada',noite:'Noite',
  g:{natural:'Natural',suave:'Brilho suave',frio:'Aço frio',contraste:'Contraste'},
  fim:'Explore por dentro',fimSub:'Entre no equipamento e veja a operação, com dados ao vivo e o clima.',denovo:'Assistir de novo',verSonda:'Ver a sonda',
  ops:{topdrive:'Top drive',mpd:'MPD',pumps:'Bombas de lama',tens:'Tensionadores'}},
 en:{celular:'Phone',giro:'Gyroscope',voltarPlanos:'Back to shots',livre:'FREE CAMERA · PHONE',gravando:'RECORDING',sair:'Exit',cor:'Grade',luz:'Light',mar:'Sea',planos:'Shots',fov:'Lens',grao:'Grain',ocultar:'H hide',mostrar:'H show controls',play:'PLAYING · DRAG TO LOOK',pause:'PAUSED · DRAG TO LOOK',
  auto:'Auto',fixo:'Hold',dia:'Day',dourada:'Golden hour',noite:'Night',
  g:{natural:'Natural',suave:'Soft glow',frio:'Cold steel',contraste:'Contrast'},
  fim:'Explore inside',fimSub:'Step inside the equipment and see the operation, with live data and weather.',denovo:'Watch again',verSonda:'View the rig',
  ops:{topdrive:'Top drive',mpd:'MPD',pumps:'Mud pumps',tens:'Tensioners'}}};
// correção de cor (no espaço da tela, depois do tonemapping): lift, gamma, gain, saturação, contraste, vinheta
const GRADES={
 natural:{lift:[0,0,0],gamma:[1,1,1],gain:[1,1,1],sat:1.02,con:1.04,vig:.32},
 suave:{lift:[.035,.035,.045],gamma:[1.04,1.03,1.02],gain:[1.02,1.0,.97],sat:.9,con:.95,vig:.4},
 frio:{lift:[0,.02,.04],gamma:[.98,1,1.04],gain:[.94,1,1.06],sat:.78,con:1.08,vig:.45},
 contraste:{lift:[-.02,-.02,-.015],gamma:[.96,.96,.96],gain:[1.06,1.04,1.02],sat:1.08,con:1.2,vig:.5}};
const MARES=['calmo','moderado','chuva','tempestade','neblina'];

/* ---------- planos (coordenadas da cena principal: navio na origem, proa em +x, convés ~9 m, torre até ~64 m, leito em y=-200) ----------
   Acima d'água as câmeras ficam à frente (z maior) e olham para o fundo; debaixo d'água ficam dentro da fatia de água (z < 20). */
function shots(SEABED){const orbit=(R,y,a0,a1,n=6)=>Array.from({length:n},(_,i)=>{const a=lerp(a0,a1,i/(n-1));return V(Math.sin(a)*R,y,Math.cos(a)*R)});
 return [
 {D:7.5,tin:'fade',cam:[V(-165,6,120),V(-120,5,96),V(-92,5,78)],tgt:[V(-14,20,0),V(-4,20,0),V(0,21,0)],fov:[30,28],boat:1,shake:1,
  t:['Navio-sonda em águas profundas','Drillship in deep water'],s:['Posicionamento dinâmico, sem âncoras','Dynamically positioned, no anchors']},
 {D:6.5,tin:'cut',cam:[V(84,10,46),V(-26,10,44)],tgt:[V(60,11,0),V(-34,12,0)],fov:[27,27],shake:.6,
  t:['Convés de trabalho','Working deck'],s:['Guindastes, tubos e bombas de lama','Cranes, pipe and mud pumps']},
 {D:6.5,tin:'whip',cam:[V(24,21,36),V(19,30,31)],tgt:[V(0,22,0),V(0,58,0)],fov:[44,40],shake:.5,
  t:['Torre e MH Top Drive','Derrick and MH Top Drive'],s:['Içamento e rotação da coluna','Hoisting and rotating the string']},
 {D:7.5,tin:'cut',cam:orbit(30,27,-.55,.95),tgt:[V(0,23,0),V(0,24,0)],fov:[46,46],shake:.4,
  t:['Piso de perfuração','Drill floor'],s:['Iron roughneck, mesa rotativa e drawworks','Iron roughneck, rotary table and drawworks']},
 {D:6.5,tin:'cut',cam:[V(128,13,62),V(104,11,44)],tgt:[V(52,18,0),V(46,18,0)],fov:[30,28],boat:1,shake:1,
  t:['Proa contra o mar','Bow into the sea'],s:['A operação depende do tempo: veja o painel de clima','Operations depend on the weather: see the weather panel']},
 {D:7.5,tin:'fade',cam:[V(11,-30,18),V(7,-122,18)],tgt:[V(0,-27,0),V(0,-134,0)],fov:[46,42],shake:.25,
  t:['Tensionadores e riser QTR™','Tensioners and QTR™ riser'],s:['Do navio até o leito marinho','From the vessel down to the seabed']},
 {D:8,tin:'cut',cam:[V(38,SEABED+19,64),V(-20,SEABED+14,58)],tgt:[V(2,SEABED+13,0),V(-2,SEABED+11,0)],fov:[32,30],shake:.2,
  t:['BOP no leito marinho','BOP on the seabed'],s:['Hydril® GXP, Compact™ RAM e ionic™ Electric BOP','Hydril® GXP, Compact™ RAM and ionic™ Electric BOP']}]}

export function createCinema({camera,renderer,lang,WX,setNight,getNight,key,SEABED,reduced=false,touch=false,onStart=()=>{},onEnd=()=>{},openScenario=()=>{},remote=()=>{}}){
 const X=k=>TX[lang()][k],L=()=>lang()==='en'?1:0;
 const S=shots(SEABED);let TOT=0,curves=[];const starts=[];
 const mkCurve=s=>({cam:s.cam.length>2?new THREE.CatmullRomCurve3(s.cam,false,'centripetal'):null,tgt:s.tgt.length>2?new THREE.CatmullRomCurve3(s.tgt,false,'centripetal'):null});
 function rebuild(){starts.length=0;let a=0;for(const s of S){starts.push(a);a+=s.D}TOT=a;curves=S.map(mkCurve)}
 // percurso gravado pelo celular: vira um plano a mais no fim da sequência (guardado neste navegador)
 const USERK='hmh-percurso';function userShot(cam,tgt,fov,D){return {D:Math.max(3,D||cam.length*.4),tin:'fade',cam,tgt,fov:[fov,fov],shake:0,user:1,t:['Seu percurso','Your path'],s:['Gravado pelo celular','Recorded from the phone']}}
 try{const j=JSON.parse(localStorage.getItem(USERK)||'null');if(j&&j.c&&j.c.length>=2)S.push(userShot(j.c.map(a=>V(...a)),j.t.map(a=>V(...a)),j.f||30,j.d))}catch(e){}
 rebuild();
 const pt=(arr,c,u,out)=>c?c.getPoint(u,out):out.copy(arr[0]).lerp(arr[arr.length-1],u);
 // passada final única: desfoque de movimento horizontal (nas transições), cor, vinheta, granulação, barras e fade
 const pass=new ShaderPass({uniforms:{tDiffuse:{value:null},uT:{value:0},uGrain:{value:.06},uVig:{value:.35},uBars:{value:0},uFade:{value:0},uBlur:{value:0},uSat:{value:1},uCon:{value:1},uLift:{value:new THREE.Vector3()},uGamma:{value:new THREE.Vector3(1,1,1)},uGain:{value:new THREE.Vector3(1,1,1)},uRes:{value:new THREE.Vector2(1920,1080)}},
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`uniform sampler2D tDiffuse;uniform float uT,uGrain,uVig,uBars,uFade,uBlur,uSat,uCon;uniform vec3 uLift,uGamma,uGain;uniform vec2 uRes;varying vec2 vUv;
   float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
   void main(){vec2 uv=vUv;vec3 c;
    if(uBlur>.002){c=vec3(0.);for(int i=-4;i<=4;i++)c+=texture2D(tDiffuse,uv+vec2(float(i)*uBlur*.011,0.)).rgb;c/=9.;}else c=texture2D(tDiffuse,uv).rgb;
    c=pow(max(c,vec3(0.)),1./uGamma);c=c*uGain+uLift*(1.-c);
    float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,uSat);c=(c-.5)*uCon+.5;
    vec2 q=uv-.5;c*=1.-uVig*dot(q,q)*2.;
    c+=(h(floor(uv*uRes)+fract(uT*7.13)*97.)-.5)*uGrain;
    c*=step(uBars,uv.y)*step(uv.y,1.-uBars);c*=1.-uFade;
    gl_FragColor=vec4(clamp(c,0.,1.),1.);}`});
 pass.enabled=false;

 /* ---------- interface ---------- */
 const root=document.createElement('section');root.className='cine';root.hidden=true;root.setAttribute('aria-label','Modo Cinema');
 root.innerHTML=`<div class="cineHit" id="ciHit"></div><div class="cineTop"><div class="cineSeg" id="ciSeg"></div><div class="cineNo" id="ciNo"></div></div>
 <div class="cineCap" id="ciCap" aria-live="polite"><b id="ciT"></b><span id="ciS"></span></div>
 <div class="cineEnd" id="ciEnd" hidden><h2 id="ciEndT"></h2><p id="ciEndS"></p><div class="ceOps" id="ciOps"></div><div class="ceAlt"><button id="ciAgain"></button><button id="ciView"></button></div></div>
 <footer class="cineBar" id="ciBar"><span class="cbSt" id="ciSt"></span><div class="cbCt" id="ciCt"></div><button class="cbX" id="ciX"></button></footer>`;
 document.body.appendChild(root);const $=q=>root.querySelector(q);
 const st={free:{on:false,pos:V(),yaw:0,pitch:0,mm:35,gq:null,g0:null,base:new THREE.Quaternion(),mv:[0,0],up:0,lk:[0,0],last:0},rec:null,reply:null,stT:0,on:false,T:0,play:true,grade:'suave',luz:'dia',mar:null,auto:true,fov:1,grain:.06,hide:false,yaw:0,pitch:0,drag:null,ended:false,shotI:-1,bars:0,keyCol:null,night0:false};
 const cam=V(),tgt=V(),tmp=V(),out={cy:0,h:260,tgt:V(),pos:V()};
 function ctl(){const i=L(),g=TX[lang()].g;
  $('#ciCt').innerHTML=`<button data-k="cor"><small>${X('cor')}</small> ${g[st.grade]}</button><button data-k="luz"><small>${X('luz')}</small> ${X(st.luz)}</button><button data-k="mar"><small>${X('mar')}</small> ${WX?WX.label():''}</button><button data-k="planos"><small>${X('planos')}</small> ${st.auto?X('auto'):X('fixo')}</button>
   <label><small>${X('fov')}</small><input type="range" min="0.7" max="1.4" step="0.01" value="${st.fov}" data-k="fov" aria-label="${X('fov')}"></label><label><small>${X('grao')}</small><input type="range" min="0" max="0.16" step="0.005" value="${st.grain}" data-k="grao" aria-label="${X('grao')}"></label><button data-k="h" class="cbH">${X('ocultar')}</button><button data-k="cel" class="cbCel">📱 ${X('celular')}</button>${touch&&'DeviceOrientationEvent' in window?`<button data-k="giro" aria-pressed="${!!st.localG}">${X('giro')}</button>`:''}${st.free.on?`<button data-k="auto">↺ ${X('voltarPlanos')}</button>`:''}`;
  $('#ciCt').querySelectorAll('button').forEach(b=>b.onclick=()=>act(b.dataset.k));$('#ciCt').querySelectorAll('input').forEach(n=>n.oninput=()=>{if(n.dataset.k==='fov')st.fov=+n.value;else st.grain=+n.value});
  $('#ciX').textContent='× '+X('sair');$('#ciX').setAttribute('aria-label',X('sair'));$('#ciSt').textContent=st.free.on?X('livre'):st.play?X('play'):X('pause');
  $('#ciSeg').innerHTML=S.map(()=>'<i><b></b></i>').join('');
  $('#ciEndT').textContent=X('fim');$('#ciEndS').textContent=X('fimSub');$('#ciAgain').textContent='↺ '+X('denovo');$('#ciView').textContent=X('verSonda');
  $('#ciOps').innerHTML=Object.entries(TX[lang()].ops).map(([k,v])=>`<button data-k="${k}">${v} <span aria-hidden="true">→</span></button>`).join('');$('#ciOps').querySelectorAll('button').forEach(b=>b.onclick=()=>{stop(true);openScenario(b.dataset.k)});
  st.shotI=-1}
 function act(k){const gk=Object.keys(GRADES),lz=['dia','dourada','noite'];
  if(k==='cor')st.grade=gk[(gk.indexOf(st.grade)+1)%gk.length];
  if(k==='luz'){st.luz=lz[(lz.indexOf(st.luz)+1)%lz.length];applyLuz()}
  if(k==='mar'&&WX){const p=MARES[(Math.max(0,MARES.indexOf(WX.preset))+1)%MARES.length];WX.set(p)}
  if(k==='planos'){st.auto=!st.auto;st.play=st.auto}
  if(k==='h'){st.hide=!st.hide;root.classList.toggle('bare',st.hide)}
  if(k==='cel')remote();if(k==='giro')localGyro();if(k==='auto')input({t:'cmd',c:'auto'});
  ctl()}
 function applyLuz(){setNight(st.luz==='noite');if(st.luz==='dourada'){key.color.setRGB(1,.72,.45)}else key.color.copy(st.keyCol)}
 $('#ciX').onclick=()=>stop();$('#ciAgain').onclick=()=>{$('#ciEnd').hidden=true;st.T=0;st.ended=false;st.play=true;st.shotI=-1};$('#ciView').onclick=()=>stop();
 // olhar em volta arrastando (volta ao enquadramento ao soltar, se estiver reproduzindo)
 const hit=$('#ciHit');hit.addEventListener('pointerdown',e=>{hit.setPointerCapture(e.pointerId);st.drag={x:e.clientX,y:e.clientY,yaw:st.yaw,pitch:st.pitch}});
 hit.addEventListener('pointermove',e=>{if(!st.drag)return;st.yaw=clamp(st.drag.yaw-(e.clientX-st.drag.x)*.003,-1.1,1.1);st.pitch=clamp(st.drag.pitch-(e.clientY-st.drag.y)*.003,-.6,.6)});
 const up=()=>{st.drag=null};hit.addEventListener('pointerup',up);hit.addEventListener('pointercancel',up);
 hit.addEventListener('dblclick',()=>{st.play=!st.play;ctl()});

 function start(){if(st.on)return;st.on=true;st.free.on=false;st.auto=true;st.T=0;st.play=true;st.ended=false;st.shotI=-1;st.yaw=st.pitch=0;st.bars=0;st.keyCol=key.color.clone();st.night0=getNight();
  root.hidden=false;root.classList.toggle('bare',st.hide);$('#ciEnd').hidden=true;document.body.classList.add('cineOn');pass.enabled=true;ctl();onStart();try{history.replaceState(history.state,'','#cinema')}catch(e){}}
 function stop(silent){if(!st.on)return;st.on=false;st.free.on=false;st.rec=null;if(st.localG){removeEventListener('deviceorientation',gl);st.localG=false}root.classList.remove('rec');root.hidden=true;document.body.classList.remove('cineOn');pass.enabled=false;key.color.copy(st.keyCol);if(st.luz!=='dia')setNight(st.night0);st.luz='dia';camera.fov=22;camera.near=5;camera.updateProjectionMatrix();onEnd(silent)}
 function keyH(e){if(e.key==='Escape'){stop();return true}if(e.key===' '){st.play=!st.play;ctl();e.preventDefault();return true}if(e.key==='h'||e.key==='H'){act('h');return true}
  if(e.key==='ArrowRight'){st.T=Math.min(TOT-.01,starts[Math.min(S.length-1,shotAt(st.T)+1)]);return true}if(e.key==='ArrowLeft'){st.T=starts[Math.max(0,shotAt(st.T)-1)];return true}return false}
 /* ---------- câmera livre (celular ou giroscópio local) ---------- */
 const E=new THREE.Euler(),Q1=new THREE.Quaternion(),Q2=new THREE.Quaternion(),ZEE=V(0,0,1),QX=new THREE.Quaternion(-Math.sqrt(.5),0,0,Math.sqrt(.5)),YA=V(0,1,0);
 // orientação do aparelho (alpha, beta, gamma em graus + ângulo da tela) para quaternion, como no DeviceOrientationControls do three.js
 const devQ=(g,q)=>{const d=PI/180;E.set(g[1]*d,g[0]*d,-g[2]*d,'YXZ');q.setFromEuler(E);q.multiply(QX);q.multiply(Q1.setFromAxisAngle(ZEE,-(g[3]||0)*d));return q};
 const fovMM=mm=>2*Math.atan(12/mm)*180/PI;   // sensor full frame (24 mm de altura)
 function freeOn(){const f=st.free;if(f.on)return;f.on=true;st.auto=false;st.play=false;f.pos.copy(camera.position);E.setFromQuaternion(camera.quaternion,'YXZ');f.yaw=E.y;f.pitch=E.x;f.g0=null;f.mm=Math.round(12/Math.tan(camera.fov*PI/360));ctl()}
 function input(m,reply){if(reply)st.reply=reply;if(!st.on)start();const f=st.free;f.last=performance.now();
  if(m.t==='in'){if((m.mv&&(m.mv[0]||m.mv[1]))||m.up||(m.lk&&(m.lk[0]||m.lk[1]))||m.g)freeOn();f.mv=m.mv||[0,0];f.up=m.up||0;f.lk=m.lk||[0,0];
   if(m.g){if(!f.g0){f.g0=devQ(m.g,new THREE.Quaternion()).invert();E.setFromQuaternion(camera.quaternion,'YXZ');f.base.setFromEuler(E.set(f.pitch,0,0,'YXZ'));f.yaw=E.y}f.gq=devQ(m.g,f.gq||new THREE.Quaternion())}else f.gq=null}
  if(m.t==='lens'&&m.mm){freeOn();f.mm=clamp(+m.mm,14,135)}
  if(m.t==='rec'){if(m.on&&!st.rec){freeOn();st.rec={c:[],g:[],t0:performance.now(),last:-1,T:0}}else if(!m.on&&st.rec){saveRec()}}
  if(m.t==='cmd'){const c=m.c;if(c==='auto'){f.on=false;f.gq=null;f.g0=null;st.auto=true;st.play=true;st.yaw=st.pitch=0;camera.up.set(0,1,0)}if(c==='play'){if(f.on)input({t:'cmd',c:'auto'});else st.play=!st.play}
   if(c==='next'||c==='prev'){f.on=false;st.auto=true;st.play=true;const i=shotAt(st.T)+(c==='next'?1:-1);st.T=starts[clamp(i,0,S.length-1)];st.ended=false;$('#ciEnd').hidden=true}
   if(c==='recenter'){f.g0=null;E.setFromQuaternion(camera.quaternion,'YXZ');f.yaw=E.y;f.pitch=E.x}ctl()}
  sendState(true)}
 function saveRec(){const r=st.rec;st.rec=null;if(!r||r.c.length<4||r.T<1.5){sendState(true);return}
  const step=Math.max(1,Math.ceil(r.c.length/40)),c=r.c.filter((_,i)=>i%step===0),t=r.g.filter((_,i)=>i%step===0);
  for(let i=S.length-1;i>=0;i--)if(S[i].user)S.splice(i,1);S.push(userShot(c,t,camera.fov,r.T));rebuild();
  try{localStorage.setItem(USERK,JSON.stringify({c:c.map(v=>v.toArray().map(n=>+n.toFixed(2))),t:t.map(v=>v.toArray().map(n=>+n.toFixed(2))),f:+camera.fov.toFixed(1),d:+r.T.toFixed(1)}))}catch(e){}
  ctl();sendState(true)}
 function sendState(now){if(!st.reply)return;const tN=performance.now();if(!now&&tN-st.stT<500)return;st.stT=tN;const i=shotAt(st.T);
  st.reply({t:'st',i,n:S.length,title:S[i].t[L()],free:st.free.on,mm:st.free.mm,rec:!!st.rec,recT:st.rec?+st.rec.T.toFixed(1):0,play:st.play,user:S.some(s=>s.user)})}
 // giroscópio do próprio aparelho (celular abrindo o site direto)
 let gl=null;async function localGyro(){if(st.localG){removeEventListener('deviceorientation',gl);st.localG=false;input({t:'cmd',c:'auto'});return}
  try{if(typeof DeviceOrientationEvent.requestPermission==='function'&&await DeviceOrientationEvent.requestPermission()!=='granted')return}catch(e){return}
  gl=e=>{if(e.alpha==null)return;input({t:'in',g:[e.alpha,e.beta,e.gamma,(screen.orientation&&screen.orientation.angle)||window.orientation||0]})};addEventListener('deviceorientation',gl);st.localG=true;ctl()}
 function freeUpdate(dt){const f=st.free,sp=14*(1+Math.abs(f.mv[1])*1.5);
  f.yaw-=f.lk[0]*dt*1.5;if(!f.gq)f.pitch=clamp(f.pitch+f.lk[1]*dt*1.1,-1.35,1.35);
  if(f.gq&&f.g0){Q2.setFromAxisAngle(YA,f.yaw);camera.quaternion.copy(Q2).multiply(f.base).multiply(Q1.copy(f.g0).multiply(f.gq))}else camera.quaternion.setFromEuler(E.set(f.pitch,f.yaw,0,'YXZ'));
  const fw=tmp.set(0,0,-1).applyQuaternion(camera.quaternion);fw.y=0;if(fw.lengthSq()<1e-4)fw.set(-Math.sin(f.yaw),0,-Math.cos(f.yaw));fw.normalize();
  f.pos.addScaledVector(fw,f.mv[1]*sp*dt).addScaledVector(tgt.set(-fw.z,0,fw.x),f.mv[0]*sp*dt);f.pos.y=clamp(f.pos.y+f.up*9*dt,SEABED+3,140);
  camera.position.copy(f.pos);const asp=innerWidth/innerHeight,fv=fovMM(f.mm)*(asp<1?1.55:asp<1.4?1.2:1);if(Math.abs(camera.fov-fv)>.01){camera.fov=fv;camera.near=1.5;camera.far=24000;camera.updateProjectionMatrix()}
  tgt.set(0,0,-1).applyQuaternion(camera.quaternion).multiplyScalar(30).add(f.pos);
  if(st.rec){const r=st.rec;r.T=(performance.now()-r.t0)/1000;if(r.T-r.last>=.1){r.last=r.T;r.c.push(f.pos.clone());r.g.push(tgt.clone())}if(r.T>=30)saveRec()}   // relógio real: o plano gravado dura o mesmo que a gravação
  // sem notícias do celular por 4 s: solta os joysticks (evita a câmera andando sozinha se a conexão cair)
  if(performance.now()-f.last>4000){f.mv=[0,0];f.up=0;f.lk=[0,0]}}
 const shotAt=T=>{let i=0;for(let k=0;k<S.length;k++)if(T>=starts[k])i=k;return i};

 /* ---------- quadro a quadro: posiciona a câmera e alimenta a passada final ---------- */
 function update(dt,t){if(!st.on)return out;
  if(st.free.on){freeUpdate(dt);const U=pass.uniforms,G=GRADES[st.grade];U.uT.value=t;U.uGrain.value=st.grain;U.uVig.value=G.vig;U.uSat.value=G.sat;U.uCon.value=G.con;U.uLift.value.set(...G.lift);U.uGamma.value.set(...G.gamma);U.uGain.value.set(...G.gain);U.uFade.value=0;U.uBlur.value=0;
   const asp=innerWidth/innerHeight,want=asp<1.2?0:Math.max(0,(1-asp/2.39)/2);st.bars+=(want-st.bars)*(1-Math.exp(-dt*2));U.uBars.value=st.bars;renderer.getDrawingBufferSize(U.uRes.value);
   $('#ciCap').classList.remove('on');$('#ciNo').textContent=st.rec?'● '+X('gravando')+' '+st.rec.T.toFixed(1)+' s':X('livre');root.classList.toggle('rec',!!st.rec);sendState(false);
   out.cy=tgt.y;out.h=260;out.tgt.copy(tgt);out.pos.copy(camera.position);return out}
  if(st.play&&!st.ended){st.T+=dt;if(st.T>=TOT){st.T=TOT-.001;st.ended=true;$('#ciEnd').hidden=false;$('#ciEnd').querySelector('button')?.focus({preventScroll:true})}}
  if(!st.drag&&st.play){const k=1-Math.exp(-dt*1.6);st.yaw-=st.yaw*k;st.pitch-=st.pitch*k}
  const i=shotAt(st.T),s=S[i],tau=st.T-starts[i],u=ease(tau/s.D),nx=S[i+1];
  pt(s.cam,curves[i].cam,u,cam);pt(s.tgt,curves[i].tgt,u,tgt);
  // câmera embarcada: acompanha a onda e nunca afunda
  if(s.boat){const w=wave(cam.x,cam.z,t);cam.y=Math.max(cam.y+w*.55,w+2.2)}
  // transições
  let fade=0,blur=0,whip=0;
  if(s.tin==='fade')fade=Math.max(fade,1-smooth(tau/.9));
  if(s.tin==='cut')blur=Math.max(blur,(1-smooth(tau/.32))*.9);
  if(s.tin==='whip'){const k=1-smooth(tau/.4);whip-=k*.55;blur=Math.max(blur,k)}
  if(nx){const rem=s.D-tau;if(nx.tin==='fade')fade=Math.max(fade,smooth((.7-rem)/.7));if(nx.tin==='whip'){const k=smooth((.38-rem)/.38);whip+=k*.55;blur=Math.max(blur,k)}}
  if(st.ended)fade=Math.max(fade,.55);if(reduced){blur=0;whip=0}
  // balanço de câmera na mão: mais forte com o mar agitado
  const sea=WX?clamp((WX.s.hs-1)/5):0,sh=(s.shake||0)*(reduced?0:1)*(.0025+sea*.006);
  const n1=Math.sin(t*1.3)*.6+Math.sin(t*2.9+1)*.3+Math.sin(t*6.1)*.1,n2=Math.sin(t*1.1+2)*.6+Math.sin(t*3.3)*.3+Math.sin(t*5.7+.5)*.1;
  camera.position.copy(cam);tmp.subVectors(tgt,cam);const r=tmp.length();let yaw=Math.atan2(tmp.x,-tmp.z)+st.yaw+whip+n1*sh,pitch=Math.asin(clamp(tmp.y/r,-1,1))+st.pitch+n2*sh;
  tmp.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)).multiplyScalar(r).add(cam);camera.up.set(0,1,0);camera.lookAt(tmp);camera.rotateZ(n1*sh*.6);
  const asp=innerWidth/innerHeight,fv=lerp(s.fov[0],s.fov[1],u)*st.fov*(asp<1?1.55:asp<1.4?1.2:1);if(Math.abs(camera.fov-fv)>.01||camera.near!==1.5){camera.fov=fv;camera.near=1.5;camera.far=24000;camera.updateProjectionMatrix()}
  // barras de cinema (2.39:1) entram suavemente; no celular em pé ficam de fora
  const want=asp<1.2?0:Math.max(0,(1-asp/2.39)/2);st.bars+=(want-st.bars)*(1-Math.exp(-dt*2));
  const G=GRADES[st.grade],U=pass.uniforms;U.uT.value=t;U.uGrain.value=st.grain;U.uVig.value=G.vig;U.uSat.value=G.sat*(st.luz==='dourada'?1.08:1);U.uCon.value=G.con;U.uLift.value.set(...G.lift);U.uGamma.value.set(...G.gamma);
  U.uGain.value.set(...G.gain);if(st.luz==='dourada')U.uGain.value.multiply(tmp.set(1.06,.98,.86));U.uBars.value=st.bars;U.uFade.value=fade;U.uBlur.value=blur;renderer.getDrawingBufferSize(U.uRes.value);
  // interface: plano atual, progresso e legenda
  if(i!==st.shotI||$('#ciNo').textContent.indexOf('/')<0){st.shotI=i;root.classList.remove('rec');$('#ciT').textContent=s.t[L()];$('#ciS').textContent=s.s[L()];$('#ciNo').textContent=String(i+1).padStart(2,'0')+' / '+String(S.length).padStart(2,'0')}
  const capOn=tau>.9&&tau<s.D-1.1&&!st.ended;$('#ciCap').classList.toggle('on',capOn);
  root.querySelectorAll('.cineSeg b').forEach((b,k)=>b.style.transform=`scaleX(${k<i?1:k>i?0:clamp(tau/s.D)})`);
  sendState(false);out.cy=tgt.y;out.h=Math.max(200,r*2.2);out.tgt.copy(tgt);out.pos.copy(cam);return out}
 return {pass,start,stop,update,input,key:keyH,seek:v=>{st.T=v;st.ended=false;$('#ciEnd').hidden=true},starts,get TOT(){return TOT},active:()=>st.on,retext:()=>{if(st.on)ctl()},weather:()=>{if(st.on)ctl()}}}
