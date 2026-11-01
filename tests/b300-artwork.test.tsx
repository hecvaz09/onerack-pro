import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {catalogProfile,artworkUrl,catalogReferenceDimensions} from '../lib/catalog-artwork';
import {networkPorts} from '../lib/network-ports';
import {b300NetworkBox} from '../lib/b300-network-layout';
import {FaceConnections} from '../app/projects/[id]/racks/[rackId]/face-connections';
import {RackGrid,type RackGridDevice} from '../app/projects/[id]/racks/[rackId]/physical-rack-grid';
import {RackOverview3D} from '../app/projects/[id]/racks/[rackId]/rack-overview-3d';
import {CatalogVisuals} from '../app/equipment/catalog-visuals';
import {readRackConfig} from '../lib/rack-config';
import type {CatalogInput} from '../lib/system-specs';

const entry=JSON.parse(readFileSync('data/catalog/supermicro-as-8126gs-nb3rt.json','utf8')) as CatalogInput;
const profile=catalogProfile(entry.sku)!;
const ports=networkPorts({systemSpecs:entry.specs});
const svg=(face:'front'|'rear')=>readFileSync(`public${artworkUrl(profile,face)}`,'utf8');
const device:RackGridDevice={id:'sample-b300',label:'Sample B300',startRU:9,mounting:'front',networkPorts:ports,connectedPorts:[ports[3].id],networkHref:'/projects/sample/racks/sample?tab=network',catalogDevice:{sku:entry.sku,model:entry.model,vendor:entry.vendor,category:'chassis',heightRU:8}};

test('B300 resolves only its exact model to a separate proportional front/rear reference',()=>{
 assert.equal(profile.key,'smc-b3008u');assert.equal(profile.heightRU,8);
 assert.equal(catalogProfile('AS-8126GS-TNMR-2CX8-IB-DRAFT')!.key,'smc-as8126');
 for(const face of ['front','rear'] as const){
  assert.deepEqual(catalogReferenceDimensions(profile,face),{width:800,height:640});
  assert.match(svg(face),/width="800" height="640" viewBox="0 0 800 640"/);
  assert.ok(!svg(face).includes('preserveAspectRatio="none"'));
 }
});

test('all eight OSFP cages and three RJ45 openings align exactly with unchanged saved-port identities',()=>{
 const front=svg('front');assert.equal((front.match(/data-network-endpoint="CX8-/g)||[]).length,8);
 const originals=ports.map(p=>p.id);assert.equal(ports.length,11);
 for(const p of ports){
  const [component,card,n]=JSON.parse(p.id);
  const name=component==='smc-b300-nb3rt-cx8'?`CX8-${card}`:component==='smc-b300-nb3rt-lan'?`LAN${n}`:'MGMT';
  const group=front.split(`data-network-endpoint="${name}"`)[1]?.split('</g>')[0];assert.ok(group,name);
  const opening=group.match(/<rect[^>]*class="port-opening"[^>]*\/>/)?.[0];assert.ok(opening,name);
  const value=(key:string)=>Number(opening.match(new RegExp(` ${key}="([^"]+)"`))![1]);
  assert.deepEqual(b300NetworkBox(p),{x:value('x'),y:value('y'),w:value('width'),h:value('height')},name);
 }
 assert.deepEqual(networkPorts({systemSpecs:entry.specs}).map(p=>p.id),originals);
});

test('malformed, foreign, out-of-range and additional adapter-port IDs cannot invent face positions',()=>{
 for(const id of ['bad','null','[]',JSON.stringify(['foreign',1,1]),JSON.stringify(['smc-b300-nb3rt-cx8',0,1]),JSON.stringify(['smc-b300-nb3rt-cx8',9,1]),JSON.stringify(['smc-b300-nb3rt-cx8',1,2]),JSON.stringify(['smc-b300-nb3rt-cx8',1,1,2])]){
  assert.equal(b300NetworkBox({...ports[0],id}),undefined,id);
 }
});

test('real front overlays link all eleven fixed ports to the existing editor with independent connected state',()=>{
 const html=renderToStaticMarkup(createElement('svg',null,createElement(FaceConnections,{profile,face:'front',ports,connected:[ports[3].id],href:device.networkHref,deviceId:device.id})));
 assert.equal((html.match(/class="connection-socket"/g)||[]).length,11);
 assert.equal((html.match(/data-connected="true"/g)||[]).length,1);
 for(const p of ports)assert.ok(html.includes(encodeURIComponent(p.id)),p.id);
 assert.ok(html.includes('fromDeviceId=sample-b300'));
 const tree=FaceConnections({profile,face:'front',ports,deviceId:device.id});
 const groups=tree.props.children[0];assert.equal(groups.length,11);
 let stopped=false;groups[0].props.onPointerDown({stopPropagation(){stopped=true;}});assert.equal(stopped,true);
});

test('rear reference includes ten fan modules, two dummy bays and twelve distinct AC input controls',()=>{
 const rear=svg('rear');assert.equal((rear.match(/data-rear-fan="/g)||[]).length,10);
 assert.equal((rear.match(/data-psu-module="/g)||[]).length,6);assert.equal((rear.match(/data-module-input="/g)||[]).length,12);
 assert.equal((rear.match(/data-dummy-fan="true"/g)||[]).length,2);
 assert.ok(!rear.includes('data-network-endpoint='));
 const overlay=renderToStaticMarkup(createElement('svg',null,createElement(FaceConnections,{profile,face:'rear',ports,psus:[1,2,3,4,5,6],deviceId:device.id})));
 assert.equal((overlay.match(/class="psu-hit"/g)||[]).length,12);assert.ok(overlay.includes('PSU 6 · Input 2'));assert.ok(!overlay.includes('PSU 7 ·'));
});

test('Library shows both B300 references with correct dimensions and visible paired-power limitation',()=>{
 const html=renderToStaticMarkup(createElement(CatalogVisuals,{sku:entry.sku,model:entry.model,specs:entry.specs}));
 for(const face of ['front','rear'])assert.ok(html.includes(`smc-b3008u-${face}.svg`));
 assert.equal((html.match(/aspect-ratio:800 \/ 640/g)||[]).length,2);
 assert.ok(html.includes('role="note"'));assert.ok(html.includes('two AC inputs'));
 assert.ok(!html.includes('smc-as8126-'));
});

test('B300 front/rear faces fill their existing eight-RU slot with the same artwork/port transform across rack types',()=>{
 for(const heightRU of [42,48])for(const pockets of [false,true])for(const rear of [false,true])for(const zoom of [50,100,150]){
  const html=renderToStaticMarkup(createElement(RackGrid,{heightRU,config:readRackConfig({pockets,profile:pockets?'onerack-u60':heightRU===42?'apc-netshelter-42':'generic-48'}),devices:[device],rear,zoom}));
  assert.ok(html.includes(`zoom:${zoom/100}`));
  assert.ok(html.includes('b300-chassis'));assert.ok(html.includes(`grid-row:${heightRU-15} / span 8`));
  assert.ok(html.includes('<svg class="catalog-face-connections" viewBox="0 0 800 640" preserveAspectRatio="none"'));
  assert.ok(html.includes('<image href="/equipment-artwork/smc-b3008u-'));
  assert.ok(html.includes('width="800" height="640" preserveAspectRatio="none"'));
  assert.ok(html.includes(`smc-b3008u-${rear?'rear':'front'}.svg`));
  assert.ok(!html.includes('class="equipment-name"'));
  assert.equal((html.match(/class="connection-socket"/g)||[]).length,rear?12:11);
 }
});

test('3D reuses both new original-vector faces without generic server artwork or additional interactive controls',()=>{
 const html=renderToStaticMarkup(createElement(RackOverview3D,{heightRU:42,config:readRackConfig({pockets:false,profile:'apc-netshelter-42'}),devices:[device],onEdit:()=>{}}));
 for(const face of ['front','rear'])assert.ok(html.includes(`smc-b3008u-${face}.svg`));
 assert.ok(html.includes('viewBox="0 0 800 640" preserveAspectRatio="xMidYMid meet"'));
 assert.ok(!html.includes('smc-as8126-'));assert.ok(!html.includes('class="psu-hit"'));
});
