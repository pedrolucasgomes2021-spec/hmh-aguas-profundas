// Câmera virtual pelo celular (lado do computador): cria uma sala PeerJS, mostra o QR code para o celular abrir
// controle.html e recebe os comandos (joysticks, giroscópio, lente, gravação) por um canal de dados WebRTC direto
// entre os dois aparelhos. O servidor do PeerJS só apresenta os dois; nenhum dado de controle passa por ele.
// As bibliotecas ficam no próprio site (assets/vendor) e só são baixadas quando o painel é aberto.
const TX={
 pt:{titulo:'Controlar pelo celular',passo:'Aponte a câmera do celular para o código. O celular vira a câmera: joysticks, giroscópio, lentes e gravação de percurso.',
  criando:'Criando a sala…',esperando:'Aguardando o celular',conectado:'Celular conectado',caiu:'Celular desconectado',erro:'Não foi possível criar a sala. Verifique a conexão e tente de novo.',
  codigo:'Código da sala',abrir:'Ou abra no celular:',fechar:'Fechar',desconectar:'Desconectar',privacidade:'Conexão direta entre os aparelhos (WebRTC). O código é aleatório e vale só enquanto esta página estiver aberta.'},
 en:{titulo:'Control from your phone',passo:'Point your phone camera at the code. The phone becomes the camera: joysticks, gyroscope, lenses and path recording.',
  criando:'Creating the room…',esperando:'Waiting for the phone',conectado:'Phone connected',caiu:'Phone disconnected',erro:'Could not create the room. Check the connection and try again.',
  codigo:'Room code',abrir:'Or open on the phone:',fechar:'Close',desconectar:'Disconnect',privacidade:'Direct connection between the devices (WebRTC). The code is random and only valid while this page is open.'}};
const loadScript=src=>new Promise((ok,err)=>{if(document.querySelector(`script[data-src="${src}"]`))return ok();const s=document.createElement('script');s.src=src;s.dataset.src=src;s.onload=ok;s.onerror=err;document.head.appendChild(s)});
// ?peer=host:porta/caminho usa um servidor PeerJS próprio (testes ou produção); sem ele, o servidor público do PeerJS
export function peerOptions(){const m=/[?&]peer=([^&#]+)/.exec(location.search+location.hash);if(!m)return{debug:0};const v=decodeURIComponent(m[1]),r=/^([^:/]+)(?::(\d+))?(\/.*)?$/.exec(v);
 return r?{host:r[1],port:+(r[2]||443),path:r[3]||'/',secure:!/^(localhost|127\.)/.test(r[1]),debug:0}:{debug:0}}

export function createRemoto({lang,onInput,onStatus=()=>{}}){
 const X=k=>TX[lang()][k];let peer=null,conn=null,id=null,state='off';
 const card=document.createElement('aside');card.className='rmt';card.hidden=true;card.setAttribute('role','dialog');card.setAttribute('aria-labelledby','rmT');
 card.innerHTML=`<header><b id="rmT"></b><button class="rmX" id="rmX">×</button></header><p class="rmP" id="rmP"></p><div class="rmQ" id="rmQ"></div>
  <div class="rmS" id="rmS"><i></i><span></span></div><div class="rmC"><small id="rmCL"></small><b id="rmCode">——</b></div><small class="rmU"><span id="rmUL"></span> <a id="rmU" target="_blank" rel="noopener"></a></small>
  <small class="rmPv" id="rmPv"></small><button class="rmD" id="rmD" hidden></button>`;
 document.body.appendChild(card);const $=q=>card.querySelector(q);
 function status(s){state=s;const el=$('#rmS');el.className='rmS '+s;el.querySelector('span').textContent=X(s==='wait'?'esperando':s==='on'?'conectado':s==='lost'?'caiu':s==='err'?'erro':'criando');$('#rmD').hidden=s!=='on';onStatus(s)}
 function texts(){$('#rmT').textContent=X('titulo');$('#rmP').textContent=X('passo');$('#rmCL').textContent=X('codigo');$('#rmUL').textContent=X('abrir');$('#rmPv').textContent=X('privacidade');
  $('#rmX').setAttribute('aria-label',X('fechar'));$('#rmD').textContent=X('desconectar');status(state)}
 function url(){const base=location.href.replace(/[#?].*$/,'').replace(/[^/]*$/,'');const pm=/[?&]peer=([^&#]+)/.exec(location.search);return base+'controle.html#'+id+(pm?'&peer='+pm[1]:'')+'&lang='+lang()}
 function qr(u){const q=window.qrcode(0,'M');q.addData(u);q.make();$('#rmQ').innerHTML=q.createSvgTag({cellSize:4,margin:2,scalable:true});$('#rmQ').querySelector('svg')?.setAttribute('aria-label',X('titulo'))}
 async function start(){if(peer&&!peer.destroyed)return;status('make');
  try{await Promise.all([loadScript('assets/vendor/peerjs/peerjs.min.js'),loadScript('assets/vendor/qrcode/qrcode.js')])}catch(e){status('err');return}
  const ab='abcdefghjkmnpqrstuvwxyz23456789';id='hmh-'+Array.from(crypto.getRandomValues(new Uint8Array(6)),b=>ab[b%ab.length]).join('');
  peer=new window.Peer(id,peerOptions());
  peer.on('open',()=>{$('#rmCode').textContent=id.slice(4).toUpperCase();const u=url();$('#rmU').href=u;$('#rmU').textContent=u.replace(/^https?:\/\//,'').replace(/#.*/,'')+'#'+id;qr(u);status('wait')});
  peer.on('connection',c=>{if(conn&&conn.open)conn.close();conn=c;c.on('open',()=>{status('on');card.classList.add('min')});c.on('data',d=>{if(d&&typeof d==='object')onInput(d,send)});c.on('close',()=>{if(conn===c){conn=null;status('lost');card.classList.remove('min')}})});
  peer.on('disconnected',()=>{try{peer.reconnect()}catch(e){}});peer.on('error',e=>{if(e&&e.type==='peer-unavailable')return;if(state!=='on')status('err')})}
 function send(m){if(conn&&conn.open)try{conn.send(m)}catch(e){}}
 function open(v=true){card.hidden=!v;if(v){texts();start()}}
 function stop(){try{conn&&conn.close()}catch(e){}try{peer&&peer.destroy()}catch(e){}peer=null;conn=null;status('off');card.hidden=true;card.classList.remove('min')}
 $('#rmX').onclick=()=>{if(state==='on')card.hidden=true;else stop()};$('#rmD').onclick=stop;
 return {open,stop,send,connected:()=>!!(conn&&conn.open),retext:()=>{if(!card.hidden)texts()},isOpen:()=>!card.hidden}}
