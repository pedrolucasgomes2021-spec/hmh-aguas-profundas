/* Oclusão ambiente (AO) em espaço de tela, só com a profundidade que a cena já gera:
 * escurece cantos, encaixes e o contato entre peças, o que dá volume ao equipamento.
 *   1) AO em meia resolução (10 amostras no hemisfério da normal reconstruída da profundidade)
 *   2) desfoque que respeita a profundidade (2 passadas), sem halos nas bordas dos objetos
 *   3) multiplica a cor da cena (ainda linear, antes do tonemapping)
 * Não faz uma segunda renderização da cena: lê o depthTexture dos alvos do EffectComposer.
 */
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const VERT = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';

const FRAG_AO = `
uniform sampler2D tDepth;uniform mat4 uProj;uniform mat4 uProjInv;uniform vec2 uRes;uniform float uRadius;uniform float uBias;uniform vec2 uBand;uniform vec3 uKernel[10];
varying vec2 vUv;
vec3 vp(vec2 uv,float d){vec4 v=uProjInv*vec4(uv*2.-1.,d*2.-1.,1.);return v.xyz/v.w;}
float ign(vec2 p){return fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715))));}
void main(){
  float d=textureLod(tDepth,vUv,0.).x;
  if(d>=.99999){gl_FragColor=vec4(1.);return;}
  vec3 P=vp(vUv,d);vec2 px=1./uRes;
  // só atua na faixa de distância onde ficam os equipamentos; céu e mar distante ficam intactos (a profundidade ali é imprecisa e o horizonte ganharia uma borda dura)
  float dist=-P.z;float band=smoothstep(uBand.x-60.,uBand.x,dist)*(1.-smoothstep(uBand.y,uBand.y+60.,dist));
  if(band<.01){gl_FragColor=vec4(1.);return;}
  vec2 ur=vUv+vec2(px.x,0.),ul=vUv-vec2(px.x,0.),uu=vUv+vec2(0.,px.y),ud=vUv-vec2(0.,px.y);
  vec3 Pr=vp(ur,textureLod(tDepth,ur,0.).x),Pl=vp(ul,textureLod(tDepth,ul,0.).x),Pu=vp(uu,textureLod(tDepth,uu,0.).x),Pd=vp(ud,textureLod(tDepth,ud,0.).x);
  vec3 dx=abs(Pr.z-P.z)<abs(P.z-Pl.z)?Pr-P:P-Pl;
  vec3 dy=abs(Pu.z-P.z)<abs(P.z-Pd.z)?Pu-P:P-Pd;
  vec3 N=cross(dx,dy);float nl=dot(N,N);if(nl<1e-12){gl_FragColor=vec4(1.);return;}
  N*=inversesqrt(nl);if(dot(N,-P)<0.)N=-N;
  band*=smoothstep(.12,.32,dot(N,normalize(-P)));   // superfícies rasantes (mar visto de lado) não recebem AO
  float a=ign(gl_FragCoord.xy)*6.2831853;vec3 rv=vec3(cos(a),sin(a),0.);
  vec3 T=rv-N*dot(rv,N);float tl=dot(T,T);T=tl>1e-8?T*inversesqrt(tl):vec3(1.,0.,0.);
  mat3 TBN=mat3(T,cross(N,T),N);
  float occ=0.;
  for(int i=0;i<10;i++){
    vec3 S=P+N*uBias+TBN*uKernel[i]*uRadius;
    vec4 pj=uProj*vec4(S,1.);vec2 suv=pj.xy/pj.w*.5+.5;
    vec3 SP=vp(suv,textureLod(tDepth,suv,0.).x);
    float range=smoothstep(0.,1.,uRadius/max(abs(P.z-SP.z),1e-4));
    occ+=(SP.z>=S.z+uBias?1.:0.)*range;
  }
  gl_FragColor=vec4(vec3(1.-band*occ/10.),1.);
}`;

const FRAG_BLUR = `
uniform sampler2D tAO;uniform sampler2D tDepth;uniform vec2 uDir;uniform mat4 uProjInv;
varying vec2 vUv;
float lin(vec2 uv){float d=textureLod(tDepth,uv,0.).x;vec4 v=uProjInv*vec4(uv*2.-1.,d*2.-1.,1.);return v.z/v.w;}
void main(){
  float zc=lin(vUv);float sum=0.,wsum=0.;
  for(int i=-3;i<=3;i++){
    vec2 uv=vUv+uDir*float(i);
    float w=exp(-float(i*i)*.25)*exp(-abs(lin(uv)-zc)*1.2);
    sum+=textureLod(tAO,uv,0.).r*w;wsum+=w;
  }
  gl_FragColor=vec4(vec3(sum/max(wsum,1e-4)),1.);
}`;

const FRAG_COMP = `
uniform sampler2D tDiffuse;uniform sampler2D tAO;uniform float uStrength;
varying vec2 vUv;
void main(){
  vec4 c=texture2D(tDiffuse,vUv);
  float ao=textureLod(tAO,vUv,0.).r;
  c.rgb*=mix(1.,ao*ao,uStrength);
  gl_FragColor=c;
}`;

export class SSAOPass extends Pass {
  constructor(camera, width, height) {
    super();
    this.camera = camera;
    this.needsSwap = true;
    this.radius = 3.2;
    this.strength = .95;
    this.bias = .06;
    this.band = new THREE.Vector2(0, 1e5);
    const kernel = [];
    for (let i = 0; i < 10; i++) {
      // hemisfério (z>0), mais amostras perto do ponto
      const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * .9 + .1).normalize();
      const s = i / 10;
      kernel.push(v.multiplyScalar(.15 + .85 * s * s));
    }
    const rtOpts = { type: THREE.UnsignedByteType, format: THREE.RGBAFormat, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.rtAO = new THREE.WebGLRenderTarget(1, 1, rtOpts);
    this.rtBlur = new THREE.WebGLRenderTarget(1, 1, rtOpts);
    const mk = (fragmentShader, uniforms) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader, uniforms, depthTest: false, depthWrite: false });
    this.matAO = mk(FRAG_AO, { tDepth: { value: null }, uProj: { value: new THREE.Matrix4() }, uProjInv: { value: new THREE.Matrix4() }, uRes: { value: new THREE.Vector2(1, 1) }, uRadius: { value: this.radius }, uBias: { value: this.bias }, uBand: { value: this.band }, uKernel: { value: kernel } });
    this.matBlur = mk(FRAG_BLUR, { tAO: { value: null }, tDepth: { value: null }, uDir: { value: new THREE.Vector2() }, uProjInv: { value: new THREE.Matrix4() } });
    this.matComp = mk(FRAG_COMP, { tDiffuse: { value: null }, tAO: { value: null }, uStrength: { value: this.strength } });
    this.quad = new FullScreenQuad(this.matAO);
    this.setSize(width, height);
  }

  setSize(width, height) {
    this.w = Math.max(2, width >> 1);
    this.h = Math.max(2, height >> 1);
    this.rtAO.setSize(this.w, this.h);
    this.rtBlur.setSize(this.w, this.h);
    this.matAO.uniforms.uRes.value.set(this.w, this.h);
  }

  render(renderer, writeBuffer, readBuffer) {
    const depth = readBuffer.depthTexture;
    const cam = this.camera;
    const ao = this.matAO.uniforms, bl = this.matBlur.uniforms, co = this.matComp.uniforms;
    ao.tDepth.value = bl.tDepth.value = depth;
    ao.uProj.value.copy(cam.projectionMatrix);
    ao.uProjInv.value.copy(cam.projectionMatrixInverse);
    bl.uProjInv.value.copy(cam.projectionMatrixInverse);
    ao.uRadius.value = this.radius; ao.uBias.value = this.bias; co.uStrength.value = this.strength;

    this.quad.material = this.matAO;
    renderer.setRenderTarget(this.rtAO); this.quad.render(renderer);

    this.quad.material = this.matBlur;
    bl.tAO.value = this.rtAO.texture; bl.uDir.value.set(1 / this.w, 0);
    renderer.setRenderTarget(this.rtBlur); this.quad.render(renderer);
    bl.tAO.value = this.rtBlur.texture; bl.uDir.value.set(0, 1 / this.h);
    renderer.setRenderTarget(this.rtAO); this.quad.render(renderer);

    this.quad.material = this.matComp;
    co.tDiffuse.value = readBuffer.texture; co.tAO.value = this.rtAO.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.quad.render(renderer);
  }

  dispose() {
    this.rtAO.dispose(); this.rtBlur.dispose();
    this.matAO.dispose(); this.matBlur.dispose(); this.matComp.dispose(); this.quad.dispose();
  }
}
