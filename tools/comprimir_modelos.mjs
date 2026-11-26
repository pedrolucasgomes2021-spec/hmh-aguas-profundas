// Comprime modelos GLB com meshopt (solda vértices, quantiza e codifica a geometria; as texturas ficam como estão).
// Reduz ~70% do download sem mudança visível. O site já decodifica (assets/vendor/three/examples/jsm/libs/meshopt_decoder.module.js).
//
// Uso (as dependências ficam numa pasta à parte, fora do projeto):
//   mkdir /tmp/gt && cd /tmp/gt && npm init -y && npm i @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4 meshoptimizer@0.22
//   cp <projeto>/tools/comprimir_modelos.mjs . && node comprimir_modelos.mjs <projeto> assets/modelos/novo.glb [outros.glb ...]
// Sobrescreve os arquivos indicados. NÃO use em bop_sim.glb e riser_sim.glb: a animação deles mexe na escala dos nós,
// e a quantização guarda a escala no nó.
import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';import {dedup,prune,meshopt,weld} from '@gltf-transform/functions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';import fs from 'fs';import path from 'path';
await MeshoptEncoder.ready;await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const [raiz,...arqs]=process.argv.slice(2);
for(const f of arqs){const p=path.join(raiz,f);if(/(bop_sim|riser_sim)\.glb$/.test(f)){console.log('pulado',f);continue}
 const s0=fs.statSync(p).size;const doc=await io.read(p);
 if(doc.getRoot().listExtensionsUsed().some(e=>e.extensionName==='EXT_meshopt_compression')){console.log('já comprimido',f);continue}
 await doc.transform(dedup(),weld(),prune(),meshopt({encoder:MeshoptEncoder,level:'high'}));await io.write(p,doc);
 console.log(f,(s0/1e6).toFixed(2),'->',(fs.statSync(p).size/1e6).toFixed(2),'MB')}
