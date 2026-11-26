// Câmera virtual (lado do celular): conecta direto ao computador pelo PeerJS (WebRTC) usando o código da sala do QR,
// e envia joysticks, giroscópio, lente e comandos ~30 vezes por segundo. Sem three.js: a conta da orientação é feita no computador.
(()=>{
 const H=new URLSearchParams(location.hash.slice(1).replace(/^([^&=]+)(&|$)/,'id=$1$2'));const id=H.get('id'),L=H.get('lang')==='en'?'en':'pt';
 const TX={pt:{ttl:'Câmera virtual',con:'Conectando…',on:'Conectado',off:'Desconectado',sem:'Abra o site no computador, entre no Modo Cinema e toque em “📱 Celular”. Depois aponte a câmera deste celular para o QR code.',
   plano:'Plano',livre:'Câmera livre',gravando:'Gravando',gyro:'Giroscópio',recenter:'Recentrar',rec:'● Gravar',stopRec:'■ Parar',auto:'Planos',mover:'Mover',subir:'Subir / Descer',olhar:'Olhar',
   nt:'Dica: com o giroscópio ligado, mova o próprio celular para enquadrar. O percurso gravado (até 30 s) vira um plano no fim do filme.',naoGiro:'Este aparelho não liberou o giroscópio.',caiu:'A conexão caiu. Abra o QR code de novo no computador.'},
  en:{ttl:'Virtual camera',con:'Connecting…',on:'Connected',off:'Disconnected',sem:'Open the site on a computer, enter Cinema mode and tap “📱 Phone”. Then point this phone camera at the QR code.',
   plano:'Shot',livre:'Free camera',gravando:'Recording',gyro:'Gyroscope',recenter:'Recentre',rec:'● Record',stopRec:'■ Stop',auto:'Shots',mover:'Move',subir:'Up / Down',olhar:'Look',
   nt:'Tip: with the gyroscope on, move the phone itself to frame the shot. The recorded path (up to 30 s) becomes a shot at the end of the film.',naoGiro:'This device did not allow the gyroscope.',caiu:'The connection dropped. Scan the QR code on the computer again.'}}[L];
 const $=s=>document.getElementById(s);document.documentElement.lang=L==='en'?'en':'pt-BR';
 $('ttl').textContent=TX.ttl;$('gyro').textContent=TX.gyro;$('recenter').textContent=TX.recenter;$('rec').textContent=TX.rec;$('auto').textContent='⏯ '+TX.auto;$('lm').textContent=TX.mover;$('lu').textContent=TX.subir;$('ll').textContent=TX.olhar;$('nt').textContent=TX.nt;
 const LENS=[18,24,35,50,85];let mm=35;$('lens').innerHTML=LENS.map(v=>`<button data-mm="${v}" aria-pressed="${v===mm}">${v} mm</button>`).join('');
 const st=t=>{$('st').className='st '+(t==='on'?'on':t==='off'?'off':'');$('stT').textContent=TX[t]};
 if(!id){document.body.classList.add('nohash');$('msg').textContent=TX.sem;st('off');return}

 /* ---------- conexão ---------- */
 const m=/^([^:/]+)(?::(\d+))?(\/.*)?$/.exec(H.get('peer')||'');const opt=m?{host:m[1],port:+(m[2]||443),path:m[3]||'/',secure:!/^(localhost|127\.)/.test(m[1]),debug:0}:{debug:0};
 let conn=null,peer=null,tries=0;
 function connect(){st('con');peer=new Peer(undefined,opt);peer.on('open',()=>{conn=peer.connect(id,{reliable:false});conn.on('open',()=>{st('on');tries=0;send({t:'lens',mm})});conn.on('data',onState);conn.on('close',lost)});
  peer.on('error',()=>{lost()})}
 function lost(){st('off');if(tries++<5)setTimeout(()=>{try{peer&&peer.destroy()}catch(e){}connect()},1500*tries);else{$('iK').textContent='';$('iT').textContent=TX.caiu}}
 const send=o=>{if(conn&&conn.open)try{conn.send(o)}catch(e){}};
 function onState(d){if(!d||d.t!=='st')return;const inf=$('info');inf.classList.toggle('rec',!!d.rec);
  $('iK').textContent=d.rec?TX.gravando+' · '+d.recT.toFixed(1)+' s':d.free?TX.livre:TX.plano+' '+(d.i+1)+' / '+d.n;$('iT').textContent=d.free?mm+' mm':d.title;$('rec').setAttribute('aria-pressed',!!d.rec);$('rec').textContent=d.rec?TX.stopRec:TX.rec}
 connect();
 // tela acesa enquanto controla
 let wl=null;const wake=async()=>{try{wl=await navigator.wakeLock.request('screen')}catch(e){}};wake();document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')wake()});

 /* ---------- joysticks e controle vertical (voltam ao centro ao soltar) ---------- */
 function joy(el,vert){const k=el.querySelector('.knob');const v=[0,0];let pid=null;
  const set=e=>{const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,R=vert?r.height/2-20:r.width/2*.62;let x=vert?0:(e.clientX-cx)/R,y=(e.clientY-cy)/R;const l=Math.hypot(x,y);if(l>1){x/=l;y/=l}
   v[0]=x;v[1]=-y;k.style.transform=`translate(${(x*R).toFixed(1)}px,${(y*R).toFixed(1)}px)`};
  el.addEventListener('pointerdown',e=>{pid=e.pointerId;el.setPointerCapture(pid);el.classList.add('act');set(e)});el.addEventListener('pointermove',e=>{if(e.pointerId===pid)set(e)});
  const up=e=>{if(e.pointerId!==pid)return;pid=null;el.classList.remove('act');v[0]=v[1]=0;k.style.transform=''};el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);return v}
 const jm=joy($('jm')),ju=joy($('ju'),true),jl=joy($('jl'));
 const dz=v=>Math.abs(v)<.08?0:+(v*Math.abs(v)).toFixed(3);   // zona morta e resposta quadrática (precisão perto do centro)

 /* ---------- giroscópio ---------- */
 let g=null,gOn=false;const og=e=>{if(e.alpha!=null)g=[+e.alpha.toFixed(2),+e.beta.toFixed(2),+e.gamma.toFixed(2),(screen.orientation&&screen.orientation.angle)||window.orientation||0]};
 $('gyro').onclick=async()=>{if(gOn){gOn=false;g=null;removeEventListener('deviceorientation',og);$('gyro').setAttribute('aria-pressed',false);return}
  try{if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'&&await DeviceOrientationEvent.requestPermission()!=='granted')throw 0}catch(e){$('iT').textContent=TX.naoGiro;return}
  addEventListener('deviceorientation',og);gOn=true;$('gyro').setAttribute('aria-pressed',true)};
 $('recenter').onclick=()=>send({t:'cmd',c:'recenter'});
 $('rec').onclick=()=>send({t:'rec',on:$('rec').getAttribute('aria-pressed')!=='true'});
 $('auto').onclick=()=>send({t:'cmd',c:'auto'});$('prev').onclick=()=>send({t:'cmd',c:'prev'});$('next').onclick=()=>send({t:'cmd',c:'next'});
 $('lens').querySelectorAll('button').forEach(b=>b.onclick=()=>{mm=+b.dataset.mm;$('lens').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));send({t:'lens',mm})});

 /* ---------- envio ~30 Hz enquanto houver movimento; parado, só um aviso por segundo ---------- */
 let idle=0;setInterval(()=>{const mv=[dz(jm[0]),dz(jm[1])],up=dz(ju[1]),lk=[dz(jl[0]),dz(jl[1])];const act=mv[0]||mv[1]||up||lk[0]||lk[1]||(gOn&&g);
  if(act||idle===0||++idle%30===0){send({t:'in',mv,up,lk,g:gOn?g:null});idle=act?0:idle||1}},33);
})();
