import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {catalogProfile,catalogReferenceDimensions} from '../lib/catalog-artwork';

let component:Promise<typeof import('../app/equipment/catalog-visuals')>|undefined;
function visuals(){return component??=build({entryPoints:[resolve('app/equipment/catalog-visuals.tsx')],bundle:true,write:false,platform:'node',format:'cjs',tsconfig:resolve('tsconfig.json'),external:['react','react/jsx-runtime']}).then(result=>{
 const mod={exports:{}};
 new Function('module','exports','require',result.outputFiles![0].text)(mod,mod.exports,createRequire(import.meta.url));
 return mod.exports as typeof import('../app/equipment/catalog-visuals');
});}
const sku='AS-8126GS-TNMR-2CX8-IB-DRAFT';

test('each affected Library face reserves its own original SVG viewBox dimensions',()=>{
 const profile=catalogProfile(sku)!;
 for(const face of ['front','rear'] as const){
  const svg=readFileSync(`public/equipment-artwork/${profile.key}-${face}.svg`,'utf8');
  const viewBox=svg.match(/^<svg\b[^>]*viewBox="0 0 ([\d.]+) ([\d.]+)"/)!
  assert.ok(viewBox);assert.deepEqual(catalogReferenceDimensions(profile,face),{width:Number(viewBox[1]),height:Number(viewBox[2])});
 }
});

test('actual Library component renders proportional responsive dimensions instead of relying on a default SVG height',async()=>{
 const {CatalogVisuals}=await visuals();
 const html=renderToStaticMarkup(createElement(CatalogVisuals,{sku,model:'AS-8126GS-TNMR'}));
 const images=html.match(/<img\b[^>]*>/g)!;assert.equal(images.length,2);
 for(const [i,height] of [640,440].entries()){
  assert.match(images[i],/width="800"/);assert.ok(images[i].includes(`height="${height}"`));
  assert.ok(images[i].includes(`aspect-ratio:800 / ${height}`));
  for(const style of ['width:100%','max-width:800px','height:auto','margin-inline:auto'])assert.ok(images[i].includes(style),style);
 }
 assert.equal((html.match(/>Download SVG</g)||[]).length,2);assert.equal((html.match(/target="_blank"/g)||[]).length,3);
});

test('no other existing Library image is resized by the correction',async()=>{
 const {CatalogVisuals}=await visuals();
 for(const other of ['DCS-7010TX-48-R','SYS-510P-WTR','BLANK-1U']){
  assert.equal(catalogReferenceDimensions(catalogProfile(other)!,'front'),undefined);
  const html=renderToStaticMarkup(createElement(CatalogVisuals,{sku:other,model:other}));
  const images=html.match(/<img\b[^>]*>/g)!;assert.equal(images.length,2);
  assert.ok(images.every(img=>!img.includes('aspect-ratio:')&&!img.includes('max-width:800px')));
 }
});

test('any future catalog SVG that disables intrinsic proportions must declare a Library reference size',()=>{
 for(const file of readdirSync('public/equipment-artwork').filter(f=>/-(front|rear)\.svg$/.test(f))){
  const root=readFileSync(`public/equipment-artwork/${file}`,'utf8').match(/^<svg\b[^>]*>/)![0];
  if(!root.includes('preserveAspectRatio="none"'))continue;
  const face=file.endsWith('-front.svg')?'front':'rear';
  const key=file.replace(/-(front|rear)\.svg$/,'');
  assert.equal(key,catalogProfile(sku)!.key,`Review new stretchable artwork ${file} before enabling it in the Library`);
  assert.ok(catalogReferenceDimensions(catalogProfile(sku)!,face),file);
 }
});

test('new B300 model does not acquire the different TNMR reference through this display fix',async()=>{
 const {CatalogVisuals}=await visuals();
 const html=renderToStaticMarkup(createElement(CatalogVisuals,{sku:'AS-8126GS-NB3RT',model:'AS-8126GS-NB3RT'}));
 assert.ok(html.includes('smc-b3008u-front.svg')&&html.includes('smc-b3008u-rear.svg'));
 assert.ok(!html.includes('smc-as8126-'));
});
