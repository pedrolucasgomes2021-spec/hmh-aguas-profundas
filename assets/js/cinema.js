// Modo Cinema: sequência de planos com câmera animada sobre a cena principal, transições (fade, corte com desfoque, giro rápido),
// barras de cinema, correção de cor, granulação e vinheta numa única passada final (barata), legendas e barra de controles.
// Não cria cena nem renderer: usa os da página e só assume a câmera enquanto está ativo.
import * as THREE from 'three';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {wave,clamp,lerp,smooth,V} from './kit.js';

const PI=Math.PI,ease=t=>{t=clamp(t);return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2};
const TX={
 pt:{sair:'Sair',cor:'Cor',luz:'Luz',mar:'Mar',planos:'Planos',fov:'Lente',grao:'Grão',ocultar:'H ocultar',mostrar:'H mostrar controles',play:'REPRODUZINDO · ARRASTE PARA OLHAR',pause:'PAUSADO · ARRASTE PARA OLHAR',
  auto:'Auto',fixo:'Fixo',dia:'Dia',dourada:'Hora dourada',noite:'Noite',
  g:{natural:'Natural',suave:'Brilho suave',frio:'Aço frio',contraste:'Contraste'},
  fim:'Explore por dentro',fimSub:'Entre no equipamento e veja a operação, com dados ao vivo e o clima.',denovo:'Assistir de novo',verSonda:'Ver a sonda',
  ops:{topdrive:'Top drive',mpd:'MPD',pumps:'Bombas de lama',tens:'Tensionadores'}},
 en:{sair:'Exit',cor:'Grade',luz:'Light',mar:'Sea',planos:'Shots',fov:'Lens',grao:'Grain',ocultar:'H hide',mostrar:'H show controls',play:'PLAYING · DRAG TO LOOK',pause:'PAUSED · DRAG TO LOOK',
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

export function createCinema({camera,renderer,lang,WX,setNight,getNight,key,SEABED,reduced=false,onStart=()=>{},onEnd=()=>{},openScenario=()=>{}}){
 const X=k=>TX[lang()][k],L=()=>lang()==='en'?1:0;
 const S=shots(SEABED),TOT=S.reduce((a,s)=>a+s.D,0),starts=[];{let a=0;for(const s of S){starts.push(a);a+=s.D}}
 const curves=S.map(s=>({cam:s.cam.length>2?new THREE.CatmullRomCurve3(s.cam,false,'centripetal'):null,tgt:s.tgt.length>2?new THREE.CatmullRomCurve3(s.tgt,false,'centripetal'):null}));
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
 const st={on:false,T:0,play:true,grade:'suave',luz:'dia',mar:null,auto:true,fov:1,grain:.06,hide:false,yaw:0,pitch:0,drag:null,ended:false,shotI:-1,bars:0,keyCol:null,night0:false};
 const cam=V(),tgt=V(),tmp=V(),out={cy:0,h:260,tgt:V(),pos:V()};
 function ctl(){const i=L(),g=TX[lang()].g;
  $('#ciCt').innerHTML=`<button data-k="cor"><small>${X('cor')}</small> ${g[st.grade]}</button><button data-k="luz"><small>${X('luz')}</small> ${X(st.luz)}</button><button data-k="mar"><small>${X('mar')}</small> ${WX?WX.label():''}</button><button data-k="planos"><small>${X('planos')}</small> ${st.auto?X('auto'):X('fixo')}</button>
   <label><small>${X('fov')}</small><input type="range" min="0.7" max="1.4" step="0.01" value="${st.fov}" data-k="fov" aria-label="${X('fov')}"></label><label><small>${X('grao')}</small><input type="range" min="0" max="0.16" step="0.005" value="${st.grain}" data-k="grao" aria-label="${X('grao')}"></label><button data-k="h" class="cbH">${X('ocultar')}</button>`;
  $('#ciCt').querySelectorAll('button').forEach(b=>b.onclick=()=>act(b.dataset.k));$('#ciCt').querySelectorAll('input').forEach(n=>n.oninput=()=>{if(n.dataset.k==='fov')st.fov=+n.value;else st.grain=+n.value});
  $('#ciX').textContent='× '+X('sair');$('#ciX').setAttribute('aria-label',X('sair'));$('#ciSt').textContent=st.play?X('play'):X('pause');
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
  ctl()}
 function applyLuz(){setNight(st.luz==='noite');if(st.luz==='dourada'){key.color.setRGB(1,.72,.45)}else key.color.copy(st.keyCol)}
 $('#ciX').onclick=()=>stop();$('#ciAgain').onclick=()=>{$('#ciEnd').hidden=true;st.T=0;st.ended=false;st.play=true;st.shotI=-1};$('#ciView').onclick=()=>stop();
 // olhar em volta arrastando (volta ao enquadramento ao soltar, se estiver reproduzindo)
 const hit=$('#ciHit');hit.addEventListener('pointerdown',e=>{hit.setPointerCapture(e.pointerId);st.drag={x:e.clientX,y:e.clientY,yaw:st.yaw,pitch:st.pitch}});
 hit.addEventListener('pointermove',e=>{if(!st.drag)return;st.yaw=clamp(st.drag.yaw-(e.clientX-st.drag.x)*.003,-1.1,1.1);st.pitch=clamp(st.drag.pitch-(e.clientY-st.drag.y)*.003,-.6,.6)});
 const up=()=>{st.drag=null};hit.addEventListener('pointerup',up);hit.addEventListener('pointercancel',up);
 hit.addEventListener('dblclick',()=>{st.play=!st.play;ctl()});

 function start(){if(st.on)return;st.on=true;st.T=0;st.play=true;st.ended=false;st.shotI=-1;st.yaw=st.pitch=0;st.bars=0;st.keyCol=key.color.clone();st.night0=getNight();
  root.hidden=false;root.classList.toggle('bare',st.hide);$('#ciEnd').hidden=true;document.body.classList.add('cineOn');pass.enabled=true;ctl();onStart();try{history.replaceState(history.state,'','#cinema')}catch(e){}}
 function stop(silent){if(!st.on)return;st.on=false;root.hidden=true;document.body.classList.remove('cineOn');pass.enabled=false;key.color.copy(st.keyCol);if(st.luz!=='dia')setNight(st.night0);st.luz='dia';camera.fov=22;camera.near=5;camera.updateProjectionMatrix();onEnd(silent)}
 function keyH(e){if(e.key==='Escape'){stop();return true}if(e.key===' '){st.play=!st.play;ctl();e.preventDefault();return true}if(e.key==='h'||e.key==='H'){act('h');return true}
  if(e.key==='ArrowRight'){st.T=Math.min(TOT-.01,starts[Math.min(S.length-1,shotAt(st.T)+1)]);return true}if(e.key==='ArrowLeft'){st.T=starts[Math.max(0,shotAt(st.T)-1)];return true}return false}
 const shotAt=T=>{let i=0;for(let k=0;k<S.length;k++)if(T>=starts[k])i=k;return i};

 /* ---------- quadro a quadro: posiciona a câmera e alimenta a passada final ---------- */
 function update(dt,t){if(!st.on)return out;
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
  if(i!==st.shotI){st.shotI=i;$('#ciT').textContent=s.t[L()];$('#ciS').textContent=s.s[L()];$('#ciNo').textContent=String(i+1).padStart(2,'0')+' / '+String(S.length).padStart(2,'0')}
  const capOn=tau>.9&&tau<s.D-1.1&&!st.ended;$('#ciCap').classList.toggle('on',capOn);
  root.querySelectorAll('.cineSeg b').forEach((b,k)=>b.style.transform=`scaleX(${k<i?1:k>i?0:clamp(tau/s.D)})`);
  out.cy=tgt.y;out.h=Math.max(200,r*2.2);out.tgt.copy(tgt);out.pos.copy(cam);return out}
 return {pass,start,stop,update,key:keyH,seek:v=>{st.T=v;st.ended=false;$('#ciEnd').hidden=true},starts,TOT,active:()=>st.on,retext:()=>{if(st.on)ctl()},weather:()=>{if(st.on)ctl()}}}
