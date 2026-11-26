// Simulação de condições de tempo: mar (altura e vagas), vento, chuva, neblina e raios.
// Controla o estado do mar (SEA, usado pelo shader do oceano e pelo movimento do navio), a chuva na GPU,
// os relâmpagos, o som e a resposta dos equipamentos (limites operacionais típicos, ilustrativos).
import * as THREE from 'three';
import {SEA,clamp,lerp,smooth} from './kit.js';

// uniforms compartilhados com o céu e a névoa (app.js) e com os cenários internos
export const WXU={storm:{value:0},flash:{value:0}};

// presets. hs: altura significativa de onda (m) · tp: período (s) · vento e raj: nós · chuva: mm/h · vis: km · nevoa: 0..1 · raio: 0..1
const PRE=[
 {id:'calmo',     hs:1.0,tp:8, vento:8, raj:12,chuva:0, vis:20, nevoa:0,  raio:0},
 {id:'moderado',  hs:2.5,tp:10,vento:22,raj:28,chuva:2, vis:10, nevoa:.1, raio:0},
 {id:'chuva',     hs:3.2,tp:10,vento:28,raj:36,chuva:25,vis:2,  nevoa:.35,raio:0},
 {id:'tempestade',hs:6.5,tp:13,vento:48,raj:62,chuva:45,vis:.8, nevoa:.55,raio:1},
 {id:'neblina',   hs:.8, tp:7, vento:5, raj:8, chuva:0, vis:.3, nevoa:1,  raio:0}];
const ICO={
 calmo:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
 moderado:'<path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h7"/>',
 chuva:'<path d="M7 15a4.5 4.5 0 1 1 1.2-8.8A5.5 5.5 0 0 1 18.5 8 3.5 3.5 0 0 1 17.5 15Z"/><path d="M8 18.5 7 21M12 18.5 11 21M16 18.5 15 21"/>',
 tempestade:'<path d="M7 14a4.5 4.5 0 1 1 1.2-8.8A5.5 5.5 0 0 1 18.5 7 3.5 3.5 0 0 1 17.5 14"/><path d="m12.5 11-3 5h4l-2.5 5"/>',
 neblina:'<path d="M4 9h16M2.5 13h19M5 17h14M8 5h8"/>',
 custom:'<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'};
export const wxIcon=id=>`<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICO[id]||ICO.custom}</svg>`;

const TX={
 pt:{titulo:'Condições de tempo',sub:'Simulação',calmo:'Calmo',moderado:'Moderado',chuva:'Chuva forte',tempestade:'Tempestade',neblina:'Neblina',custom:'Personalizado',
  hs:'Onda (Hs)',tp:'Período',vento:'Vento',raj:'Rajadas',chuvaL:'Chuva',vis:'Visibilidade',ajuste:'Ajuste fino',resp:'Resposta dos equipamentos',
  nota:'Limites típicos e ilustrativos de uma sonda de posicionamento dinâmico. Cada unidade segue os seus (WSOG e manual de operações).',
  ok:'Operando',warn:'Restrito',stop:'Suspenso',wow:'Aguardando o tempo (WOW): perfuração suspensa, coluna pendurada com o compensador ativo e poço seguro.',
  fechar:'Fechar',min:'Minimizar',exp:'Expandir',kt:'nós',mmh:'mm/h',
  eq:{drill:'Perfuração (top drive)',pipe:'Manuseio de tubos',crane:'Guindastes',tens:'Tensionadores do riser',heli:'Helideck',rov:'ROV (lançar e recolher)',alto:'Trabalho em altura (torre)',bop:'BOP e poço'},
  r:{
   drill_ok:'Compensador de movimento absorve o heave; peso sobre a broca estável.',drill_warn:'Heave alto: compensador perto do curso máximo, taxa de penetração reduzida.',drill_stop:'Acima do limite: broca tirada do fundo, coluna pendurada (hang-off).',
   pipe_ok:'Racker e roughneck em ritmo normal.',pipe_warn:'Piso molhado e rajadas: manobra de tubos mais lenta.',pipe_stop:'Rajadas e balanço acima do limite: sem manobra de tubos.',
   crane_ok:'Içamentos liberados.',crane_warn:'Vento ou visibilidade no limite: só içamentos leves no convés.',crane_stop:'Lanças recolhidas no descanso; içamentos proibidos.',
   tens_ok:'Curso pequeno, tensão constante.',tens_warn:'Curso grande dos tensionadores e da junta telescópica.',tens_stop:'Curso no limite: preparar desconexão de emergência (EDS).',
   heli_ok:'Voos liberados.',heli_warn:'Vento forte: pouso só com aprovação do piloto.',heli_stop:'Voos suspensos (visibilidade, vento ou raios).',
   rov_ok:'Lançamento e recolhimento liberados.',rov_warn:'Mar agitado: só ROV já na água opera.',rov_stop:'Sem lançar ou recolher o ROV pela zona de respingo.',
   alto_ok:'Liberado com permissão de trabalho.',alto_warn:'Vento ou chuva forte: só tarefas essenciais.',alto_stop:'Proibido: vento acima do limite ou raios.',
   bop_ok:'As ondas perdem força com a profundidade: no leito marinho o BOP não sente o mar agitado.'}},
 en:{titulo:'Weather conditions',sub:'Simulation',calmo:'Calm',moderado:'Moderate',chuva:'Heavy rain',tempestade:'Storm',neblina:'Fog',custom:'Custom',
  hs:'Wave (Hs)',tp:'Period',vento:'Wind',raj:'Gusts',chuvaL:'Rain',vis:'Visibility',ajuste:'Fine tuning',resp:'Equipment response',
  nota:'Typical, illustrative limits for a dynamically positioned rig. Each unit follows its own (WSOG and operations manual).',
  ok:'Operating',warn:'Restricted',stop:'Suspended',wow:'Waiting on weather (WOW): drilling suspended, string hung off with the compensator active, well secured.',
  fechar:'Close',min:'Minimise',exp:'Expand',kt:'kn',mmh:'mm/h',
  eq:{drill:'Drilling (top drive)',pipe:'Pipe handling',crane:'Cranes',tens:'Riser tensioners',heli:'Helideck',rov:'ROV (launch and recovery)',alto:'Work at height (derrick)',bop:'BOP and well'},
  r:{
   drill_ok:'Motion compensator absorbs heave; weight on bit is steady.',drill_warn:'High heave: compensator near full stroke, lower rate of penetration.',drill_stop:'Above the limit: bit off bottom, string hung off.',
   pipe_ok:'Racker and roughneck at normal pace.',pipe_warn:'Wet floor and gusts: slower pipe handling.',pipe_stop:'Gusts and roll above the limit: no pipe handling.',
   crane_ok:'Lifts allowed.',crane_warn:'Wind or visibility at the limit: light deck lifts only.',crane_stop:'Booms in their rests; lifting forbidden.',
   tens_ok:'Small stroke, constant tension.',tens_warn:'Large tensioner and telescopic joint stroke.',tens_stop:'Stroke at the limit: prepare emergency disconnect (EDS).',
   heli_ok:'Flights allowed.',heli_warn:'Strong wind: landing only with pilot approval.',heli_stop:'Flights suspended (visibility, wind or lightning).',
   rov_ok:'Launch and recovery allowed.',rov_warn:'Rough sea: only an ROV already in the water operates.',rov_stop:'No ROV launch or recovery through the splash zone.',
   alto_ok:'Allowed under a work permit.',alto_warn:'Strong wind or rain: essential tasks only.',alto_stop:'Forbidden: wind above the limit or lightning.',
   bop_ok:'Waves lose energy with depth: on the seabed the BOP does not feel rough seas.'}}};

// avaliação dos limites (valores típicos de sondas DP; ilustrativos)
export function avaliar(w){const S=(stop,warn)=>stop?'stop':warn?'warn':'ok';
 return {
  drill:S(w.hs>=5.5||w.raj>=60,w.hs>=3),
  pipe:S(w.hs>=5||w.raj>=55,w.hs>=2.8||w.raj>=32||w.chuva>=15),
  crane:S(w.vento>=40||w.raj>=50||w.raio>.5,w.vento>=28||w.vis<1.5||w.hs>=3.5),
  tens:S(w.hs>=7.5,w.hs>=4.5),
  heli:S(w.vis<1||w.vento>=50||w.raio>.5,w.vento>=35||w.vis<3),
  rov:S(w.hs>=4.5,w.hs>=3),
  alto:S(w.vento>=40||w.raio>.5,w.vento>=28||w.chuva>=20),
  bop:'ok'}}

/* ---------- chuva na GPU: cada gota é um segmento que cai em loop dentro de uma caixa que acompanha a câmera ---------- */
export function makeRain(n=6000){
 const P=new Float32Array(n*6),S=new Float32Array(n*8),E=new Float32Array(n*2);
 for(let i=0;i<n;i++){const s=[Math.random(),Math.random(),Math.random(),Math.random()];for(let k=0;k<2;k++){S.set(s,(i*2+k)*4);E[i*2+k]=k}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('aS',new THREE.BufferAttribute(S,4));g.setAttribute('aE',new THREE.BufferAttribute(E,1));
 const U={uT:{value:0},uC:{value:new THREE.Vector3()},uSz:{value:new THREE.Vector3(100,100,100)},uV:{value:new THREE.Vector3(0,-30,0)},uL:{value:.035},uA:{value:0},uN:{value:0},uY0:{value:0},uCol:{value:new THREE.Color(.78,.84,.9)}};
 const m=new THREE.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,fog:false,blending:THREE.NormalBlending,
  vertexShader:`attribute vec4 aS;attribute float aE;uniform float uT,uL,uN,uY0;uniform vec3 uC,uSz,uV;varying float vA;
   void main(){vec3 b=uC-uSz*.5;vec3 q=aS.xyz*uSz*7.31+uV*uT*(.8+aS.w*.4);vec3 p=b+mod(q-b,uSz);p-=uV*uL*aE;
    vA=(1.-aE*.85)*step(aS.w,uN)*smoothstep(uY0,uY0+1.5,p.y)*smoothstep(0.,.08,mod(q.y-b.y,uSz.y)/uSz.y);
    gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);if(aS.w>uN)gl_Position=vec4(2.,2.,2.,1.);}`,
  fragmentShader:`uniform float uA;uniform vec3 uCol;varying float vA;void main(){gl_FragColor=vec4(uCol,uA*vA);}`});
 const mesh=new THREE.LineSegments(g,m);mesh.frustumCulled=false;mesh.renderOrder=20;mesh.visible=false;
 return {mesh,U,set(o){if(o.c)U.uC.value.copy(o.c);if(o.size)U.uSz.value.copy(o.size);if(o.v)U.uV.value.copy(o.v);if(o.a!=null)U.uA.value=o.a;if(o.n!=null)U.uN.value=o.n;if(o.len!=null)U.uL.value=o.len;if(o.y0!=null)U.uY0.value=o.y0;if(o.t!=null)U.uT.value=o.t;mesh.visible=U.uA.value>.001&&U.uN.value>.001}}}

// raio: linha quebrada e luminosa, desenhada por alguns décimos de segundo
export function makeBolt(){const n=26,P=new Float32Array(n*3),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));
 const m=new THREE.LineBasicMaterial({color:0xeaf2ff,transparent:true,opacity:0,fog:false,depthWrite:false});const l=new THREE.Line(g,m);l.frustumCulled=false;l.renderOrder=3;
 return {line:l,strike(x,top,bot,z){let px=x;for(let i=0;i<n;i++){const k=i/(n-1);px+=(Math.random()-.5)*(top-bot)*.06;P[i*3]=px;P[i*3+1]=lerp(top,bot,k);P[i*3+2]=z}g.attributes.position.needsUpdate=true}}}

/* ---------- módulo principal ---------- */
export function createClima({scene,lang,audio,onChange=()=>{},reduced=false}){
 const L=()=>lang(),X=k=>TX[L()][k];
 const tgt={...PRE[0]};let preset='calmo';
 // estado suavizado (o mar e o céu mudam aos poucos, como numa frente de tempo real)
 const s={hs:tgt.hs,tp:tgt.tp,vento:tgt.vento,raj:tgt.raj,chuva:0,vis:20,nevoa:0,raio:0,cloud:0,fogk:0};
 const k={drill:1,pipe:1,crane:1};   // 1 = operação liberada, 0 = parada (suavizado para as animações)
 let st=avaliar(tgt),wowOn=false,flashT=0,nextBolt=6,thunder=[];
 const rain=makeRain(7000);scene.add(rain.mesh);const bolt=makeBolt();scene.add(bolt.line);

 /* ---------- painel ---------- */
 const card=document.createElement('aside');card.className='wxp mcard glass dw';card.hidden=true;card.setAttribute('role','dialog');card.setAttribute('aria-labelledby','wxT');
 card.innerHTML=`<header><span class="wxIco" id="wxIco"></span><div class="opt"><small id="wxSub"></small><b id="wxT"></b></div><button class="mn" id="wxMn">–</button><button class="x2" id="wxX">×</button></header>
 <div class="mbody"><div class="wxPre" id="wxPre" role="radiogroup"></div>
  <div class="wxRead" id="wxRead"></div>
  <details class="wxAdv"><summary id="wxAdvT"></summary><div class="wxSl" id="wxSl"></div></details>
  <h4 id="wxRespT"></h4><ul class="wxSt" id="wxSt"></ul><small class="wxNote" id="wxNote"></small></div>`;
 document.body.appendChild(card);
 const ban=document.createElement('div');ban.className='wxBan';ban.hidden=true;ban.setAttribute('role','status');ban.setAttribute('aria-live','polite');document.body.appendChild(ban);
 const $=q=>card.querySelector(q);
 const SL=[['hs',.5,9,.1,'m'],['vento',0,70,1,'kt'],['chuva',0,60,1,'mmh']];
 function build(){
  $('#wxPre').innerHTML=PRE.map(p=>`<button role="radio" data-p="${p.id}" aria-checked="${preset===p.id}">${wxIcon(p.id)}<span>${X(p.id)}</span></button>`).join('');
  $('#wxPre').querySelectorAll('button').forEach(b=>b.onclick=()=>set(b.dataset.p));
  $('#wxSl').innerHTML=SL.map(([id,a,b,st])=>`<label><span>${id==='chuva'?X('chuvaL'):X(id)}</span><input type="range" min="${a}" max="${b}" step="${st}" data-k="${id}" value="${tgt[id]}"><output></output></label>`).join('');
  $('#wxSl').querySelectorAll('input').forEach(i=>i.oninput=()=>{tgt[i.dataset.k]=+i.value;custom()});texts()}
 const num=(v,d=0)=>v.toLocaleString(L()==='pt'?'pt-BR':'en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
 const fmt={hs:v=>num(v,1)+' m',tp:v=>num(v)+' s',vento:v=>num(v)+' '+X('kt'),raj:v=>num(v)+' '+X('kt'),chuva:v=>num(v)+' '+X('mmh'),vis:v=>v>=10?'> 10 km':v<1?num(v*1000)+' m':num(v,1)+' km'};
 function texts(){$('#wxT').textContent=X('titulo');$('#wxSub').textContent=X('sub');$('#wxAdvT').textContent=X('ajuste');$('#wxRespT').textContent=X('resp');$('#wxNote').textContent=X('nota');
  $('#wxIco').innerHTML=wxIcon(preset);$('#wxMn').setAttribute('aria-label',card.classList.contains('min')?X('exp'):X('min'));$('#wxX').setAttribute('aria-label',X('fechar'));
  $('#wxPre').querySelectorAll('button').forEach(b=>{b.setAttribute('aria-checked',b.dataset.p===preset);b.querySelector('span').textContent=X(b.dataset.p)});
  $('#wxRead').innerHTML=[['hs','hs'],['tp','tp'],['vento','vento'],['raj','raj'],['chuva','chuvaL'],['vis','vis']].map(([k2,l])=>`<div><small>${X(l)}</small><b>${fmt[k2](tgt[k2])}</b></div>`).join('');
  $('#wxSl').querySelectorAll('label').forEach(l=>{const i=l.querySelector('input');i.value=tgt[i.dataset.k];l.querySelector('output').textContent=fmt[i.dataset.k](+i.value);l.querySelector('span').textContent=i.dataset.k==='chuva'?X('chuvaL'):X(i.dataset.k)});
  const R=TX[L()].r,E=TX[L()].eq;$('#wxSt').innerHTML=Object.keys(E).map(id=>`<li class="${st[id]}"><i aria-hidden="true"></i><div><b>${E[id]}</b><span>${X(st[id])} · ${R[id+'_'+st[id]]}</span></div></li>`).join('');
  ban.innerHTML=`${wxIcon('tempestade')}<span>${X('wow')}</span>`;ban.hidden=!wowOn||document.body.classList.contains('scnOn')}
 function custom(){preset='custom';tgt.raj=Math.round(tgt.vento*1.3);tgt.tp=Math.round(lerp(6,14,clamp(tgt.hs/8)));tgt.vis=Math.min(20,tgt.chuva>0?lerp(10,.8,clamp(tgt.chuva/45)):tgt.nevoa>.5?tgt.vis:20);tgt.raio=tgt.chuva>=40&&tgt.vento>=40?1:0;changed()}
 function set(id){const p=PRE.find(q=>q.id===id);if(!p)return;Object.assign(tgt,p);preset=id;changed()}
 function changed(){st=avaliar(tgt);wowOn=st.drill==='stop';texts();onChange(api)}
 card.querySelector('#wxX').onclick=()=>open(false);
 card.querySelector('#wxMn').onclick=()=>{const m=card.classList.toggle('min');card.querySelector('#wxMn').textContent=m?'+':'–';texts()};
 function open(v){card.hidden=!v;if(v){card.classList.remove('in');void card.offsetWidth;card.classList.add('in')}onChange(api)}
 addEventListener('keydown',e=>{if(e.key==='Escape'&&!card.hidden&&card.contains(document.activeElement)){open(false)}});

 /* ---------- som: chuva, vento e trovão (só se o som ambiente estiver ligado) ---------- */
 let snd=null;
 function sound(){if(!audio||!audio.ready||snd)return;const C=audio.ctx;
  const src=()=>{const b=C.createBufferSource();b.buffer=audio.white;b.loop=true;b.start(0,Math.random()*3);return b},bq=(t,f,q=.7)=>{const x=C.createBiquadFilter();x.type=t;x.frequency.value=f;x.Q.value=q;return x},gn=v=>{const g=C.createGain();g.gain.value=v;return g};
  const rainG=gn(0),windG=gn(0);src().connect(bq('highpass',1200)).connect(bq('lowpass',7000)).connect(rainG).connect(audio.surf);
  const wf=bq('bandpass',420,1.6);src().connect(wf).connect(windG).connect(audio.surf);const o=C.createOscillator();o.frequency.value=.13;const og=gn(160);o.connect(og).connect(wf.frequency);o.start();
  snd={rainG,windG}}
 function thunderNow(dist){if(!audio||!audio.on||!audio.ready)return;const C=audio.ctx,t=C.currentTime;const b=C.createBufferSource();b.buffer=audio.white;const f=C.createBiquadFilter();f.type='lowpass';f.frequency.value=lerp(240,90,dist);const g=C.createGain();
  b.connect(f).connect(g).connect(audio.surf);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(lerp(1.1,.5,dist),t+.08);g.gain.exponentialRampToValueAtTime(.001,t+3.2);b.start(t,Math.random()*2);b.stop(t+3.4)}

 /* ---------- quadro a quadro ---------- */
 const tmp=new THREE.Vector3(),tmpS=new THREE.Vector3(),tmpV=new THREE.Vector3();
 function frame(dt,t,o={}){
  const a=1-Math.exp(-dt*.7),b=1-Math.exp(-dt*1.6);   // o mar responde mais devagar que o céu
  s.hs+=(tgt.hs-s.hs)*a;s.tp+=(tgt.tp-s.tp)*a;s.vento+=(tgt.vento-s.vento)*b;s.raj+=(tgt.raj-s.raj)*b;s.chuva+=(tgt.chuva-s.chuva)*b;s.vis+=(tgt.vis-s.vis)*b;s.nevoa+=(tgt.nevoa-s.nevoa)*b;s.raio+=(tgt.raio-s.raio)*b;
  s.cloud=clamp(Math.max(s.chuva/40,(s.vento-12)/40,s.nevoa*.7));
  // névoa: coeficiente pela visibilidade (3/vis = 95% de perda de contraste na distância de visibilidade)
  s.fogk=clamp(3/(Math.max(.15,s.vis)*1000)-.00015,0,.03);
  SEA.amp=s.hs/1.82;   // Hs = 4σ e σ² = Σa²/2 das ondas de swell (kit.js): com escala 1 o mar tem Hs = 1,82 m
  SEA.chop=clamp((s.vento-10)/38)*1.25;
  WXU.storm.value=clamp(s.cloud*.95);
  for(const kk of['drill','pipe','crane']){const on=st[kk]==='stop'?0:st[kk]==='warn'?.55:1;k[kk]+=(on-k[kk])*(1-Math.exp(-dt*.8))}
  // relâmpagos
  flashT=Math.max(0,flashT-dt);let fl=0;
  if(s.raio>.5&&!reduced){nextBolt-=dt;if(nextBolt<0){nextBolt=4+Math.random()*9;flashT=.55;const dist=Math.random();bolt.strike((Math.random()-.5)*1400,900,-2,-1600-dist*2500);thunder.push({t:.6+dist*2.6,d:dist})}}
  if(flashT>0){const u=.55-flashT;fl=(u<.06?1:u<.12?.25:u<.2?.85:Math.max(0,1-(u-.2)*3))*.9}
  WXU.flash.value=fl;bolt.line.material.opacity=flashT>.25?1:flashT>0?flashT*2:0;bolt.line.visible=flashT>0;
  thunder=thunder.filter(q=>{q.t-=dt;if(q.t<=0){thunderNow(q.d);return false}return true});
  // chuva: caixa em volta do alvo da câmera, só acima da água
  if(o.camT&&o.viewH){const vh=o.viewH,w=vh*o.asp;tmp.set(o.camT.x,o.camT.y+vh*.1,10);tmpS.set(w*1.3,vh*1.4,90);
   const fall=lerp(9,11,clamp(s.chuva/45)),wind=s.vento*.5144*.9;tmpV.set(wind,-fall,wind*.15);   // velocidade real da gota (m/s) e do vento (nós -> m/s)
   rain.set({c:tmp,size:tmpS,v:tmpV,t,a:clamp(.38+vh/1200,.38,.62)*(o.above?1:0),n:clamp(s.chuva/45)*(o.above?1:0),len:clamp(vh/650,.05,.22),y0:.4})}
  rain.U.uCol.value.setRGB(.78,.84,.9).multiplyScalar(lerp(1,.55,o.night||0));
  if(audio&&audio.ready){sound();const tt=audio.ctx.currentTime,u=o.surf??1;snd.rainG.gain.setTargetAtTime(clamp(s.chuva/45)*.22*u,tt,.6);snd.windG.gain.setTargetAtTime(clamp((s.vento-10)/50)*.16*u,tt,.6)}
 }
 const api={s,k,tgt,get preset(){return preset},get status(){return st},get wow(){return wowOn},rain,set,open,toggle:()=>open(card.hidden),isOpen:()=>!card.hidden,frame,retext:texts,label:id=>X(id||preset),fmt,
  // resumo curto para chips: "Tempestade · Hs 6,5 m · 48 nós"
  resumo:()=>`${X(preset)} · Hs ${fmt.hs(tgt.hs)} · ${fmt.vento(tgt.vento)}`,X,icon:()=>wxIcon(preset),banner:v=>{ban.hidden=!(v&&wowOn)}};
 build();return api}
