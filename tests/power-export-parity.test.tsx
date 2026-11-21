import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {build} from 'esbuild';
import {createElement,isValidElement,type ReactNode} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PDFDocument,PDFRawStream,decodePDFRawStream} from 'pdf-lib';
import {buildRackPdf,type BuildDocument} from '../lib/build-document';
import {savedRackPowerAssessment} from '../lib/rack-power-assessment';
import {readFeedInputs,type FeedEquipment} from '../lib/feed-rack';
import type {FeedInputs,Supply} from '../lib/feed-power';
import {balanceFeeds} from '../lib/feed-balance';
import {powerOverview} from '../lib/power-overview';
import {RackStatusPane} from '../app/projects/[id]/racks/[rackId]/rack-status-pane';
import {SavedPowerReview} from '../app/projects/[id]/racks/[rackId]/saved-power-review';
import {individualPowerFixture} from './fixtures/individual-power';
import {b300PowerFixture,withCables} from './fixtures/b300-power';

function makeRack(equipment:FeedEquipment[],configuration:unknown){
  return {id:'export-test-rack',projectId:'export-test-project',name:'Synthetic export rack',heightRU:42,configuration,history:null,
    project:{name:'Synthetic export project',customer:null},
    devices:equipment.map(e=>({id:e.id,startRU:e.startRU||1,label:e.name.replace(/ · U\d+$/,''),mounting:e.mounting||'front',details:e.details,
      catalogDevice:{id:'catalog-'+e.id,sku:e.sku||'SYNTHETIC',model:e.model||'Synthetic equipment',vendor:'Synthetic',heightRU:e.category==='pdu'?0:e.id==='b300'?8:1,category:e.category,rawData:e.rawData}})),
  };
}
type TestRack=ReturnType<typeof makeRack>;
function screenEquipment(rack:TestRack):FeedEquipment[]{
  return rack.devices.map(d=>({id:d.id,name:`${d.label||d.catalogDevice.model} · U${d.startRU}`,sku:d.catalogDevice.sku,model:d.catalogDevice.model,startRU:d.startRU,mounting:d.mounting,category:d.catalogDevice.category,rawData:d.catalogDevice.rawData,details:d.details}));
}
function ordinaryRack(kind:'generic'|'apc'|'raritan'='generic',four=false){
  const f=individualPowerFixture(false);
  let equipment=f.equipment.filter(e=>!e.id.startsWith('missing-'));
  if(kind==='apc'){
    const catalog=JSON.parse(readFileSync('data/catalog/apc-apdu11350me.json','utf8'));
    equipment=equipment.map(e=>e.category==='pdu'?{...e,sku:catalog.sku,model:catalog.model,rawData:structuredClone(catalog.rawData)}:e);
  }
  if(kind==='raritan')equipment=equipment.map(e=>e.category==='pdu'?{...e,sku:'PX3-4068YV-V2-K1',model:'PX3-4068YV-V2-K1',rawData:{model:'PX3-4068YV-V2-K1'}}:e);
  if(four){
    equipment.push(...equipment.filter(e=>e.category==='pdu').map(e=>({...structuredClone(e),id:e.id+'2',name:e.name+' second'})));
    f.inputs.budgets.server.cords=4;f.inputs.budgets.server.minimumCords=2;
  }
  f.inputs.headroomPercent=20;
  let inlet=0;
  equipment=equipment.map(e=>e.category==='pdu'?{...e,details:{...e.details as object,outlets:{[kind==='raritan'?7:1]:{deviceId:'server',inlet:++inlet,notes:'Synthetic saved cable'}}}}:e);
  return makeRack(equipment,{feedPower:f.inputs,...(four?{pduPairs:2}:{})});
}

let exportBundle:Promise<string>|undefined;
async function exportRack(rack:TestRack){
  exportBundle??=build({entryPoints:[resolve('app/projects/[id]/racks/[rackId]/export/route.ts')],bundle:true,write:false,platform:'node',format:'cjs',tsconfig:resolve('tsconfig.json'),plugins:[{name:'synthetic-export-adapters',setup(b){
    b.onResolve({filter:/^@\/lib\/(prisma|build-document)$/},args=>({path:args.path,namespace:'export-mock'}));
    b.onLoad({filter:/.*/,namespace:'export-mock'},args=>({contents:args.path.endsWith('/prisma')?'export const prisma=__mocks.prisma;':'export const buildRackPdf=(data)=>__mocks.buildRackPdf(data);',loader:'js'}));
  }}]}).then(r=>r.outputFiles![0].text);
  let document:BuildDocument|undefined;
  const before=structuredClone(rack),mocks={
    prisma:{rack:{findFirst:async()=>rack},connection:{findMany:async()=>[]}},
    buildRackPdf:async(data:BuildDocument)=>{document=data;return buildRackPdf(data);},
  };
  const loaded={exports:{}};
  new Function('module','exports','require','__mocks',await exportBundle)(loaded,loaded.exports,createRequire(import.meta.url),mocks);
  const route=loaded.exports as typeof import('../app/projects/[id]/racks/[rackId]/export/route');
  const response=await route.GET(new Request('https://example.invalid/synthetic/export'),{params:Promise.resolve({id:rack.projectId,rackId:rack.id})});
  assert.equal(response.status,200);assert.equal(response.headers.get('Content-Type'),'application/pdf');assert.equal(response.headers.get('Cache-Control'),'no-store');
  assert.ok(document);assert.deepEqual(rack,before,'export must not migrate or edit saved data');
  const pdf=await PDFDocument.load(await response.arrayBuffer());let content='';
  for(const [,value] of pdf.context.enumerateIndirectObjects())if(value instanceof PDFRawStream){
    const decoded=Buffer.from(decodePDFRawStream(value).decode()).toString('latin1');
    for(const match of decoded.matchAll(/<([0-9a-f]+)>\s*Tj/gi))content+=Buffer.from(match[1],'hex').toString('latin1')+' ';
  }
  return {document,text:content.replace(/\s+/g,' '),pages:pdf.getPageCount()};
}

async function assertParity(rack:TestRack){
  const equipment=screenEquipment(rack),assessment=savedRackPowerAssessment(equipment,rack.configuration),result=await exportRack(rack),power=result.document.feedPower;
  assert.ok(power);assert.equal(result.document.power,undefined,'the export must not fall back to a second power engine');
  assert.deepEqual(power.scenarios,assessment.design.scenarios,'all normal/feed-loss watts, VA, phase, branch and endpoint loads must match the saved screen analysis');
  assert.deepEqual(power.issues,assessment.design.issues);assert.deepEqual(power.verificationNotes,assessment.design.verificationNotes);
  assert.equal(power.ready,assessment.design.ready);assert.equal(power.verificationReady,assessment.strict.ready);assert.deepEqual(power.supplies,assessment.supplies);
  assert.equal(power.headroomPercent,assessment.inputs.headroomPercent);
  const review=renderToStaticMarkup(createElement(SavedPowerReview,{equipment,saved:assessment.inputs,dirty:false}));
  const status=renderToStaticMarkup(<RackStatusPane equipment={equipment} configuration={rack.configuration} devices={[]} heightRU={42} pockets={false} basePath="/synthetic" networkCables={0}>{null}</RackStatusPane>);
  if(power.ready){assert.match(review,/Design checks passed/);assert.match(status,/Plan checked/);assert.match(result.text,/Design checks passed|Within entered PDU capacity limits/);}
  else{assert.doesNotMatch(review,/Design checks passed/);assert.match(status,/Needs review/);assert.match(result.text,/NEEDS REVIEW/);}
  assert.doesNotMatch(result.text,/Four-PDU power|workbook wiring retained|only supports the verified PX3/);
  return {...result,assessment,power};
}

for(const kind of ['generic','apc','raritan'] as const){
  test(`${kind} two-PDU export matches saved screen demand, failover, phases, banks and endpoints`,async()=>{
    const rack=ordinaryRack(kind),{assessment,power,text}=await assertParity(rack);
    assert.equal(power.ready,true);assert.equal(power.scenarios.length,3);
    assert.equal(powerOverview(screenEquipment(rack),assessment.inputs).watts,556,'entered demand excludes headroom');
    for(const s of power.scenarios){
      assert.ok(Math.abs(s.totals.reduce((n,p)=>n+p.watts,0)-667.2)<1e-9);
      assert.ok(Math.abs(s.totals.reduce((n,p)=>n+p.va,0)-667.2/.87)<1e-9);
      assert.equal(s.outletLoads.length,s.lost?1:2);
      for(const p of s.totals){
        const online=!s.lost||p.feed!==s.lost,expectedWatts=online?(s.lost?667.2:333.6):0;
        assert.ok(Math.abs(p.watts-expectedWatts)<1e-9);
        if(online){
          assert.ok(text.includes(`${(p.watts/1000).toFixed(3)} kW / ${(p.va/1000).toFixed(3)} kVA`));
          for(const amps of p.phases)assert.ok(text.includes(`${amps.toFixed(2)} / ${p.limitAmps} A`));
          assert.ok(Object.keys(p.branches).length>0);
          for(const [branch,amps] of Object.entries(p.branches)){
            assert.ok(text.includes(`branch ${branch}`));
            assert.ok(text.includes(`${amps.toFixed(2)} / ${assessment.supplies.find(v=>v.id===p.id)!.branches![branch]} A`));
          }
        }
      }
      for(const cord of s.outletLoads)assert.ok(text.includes(`${cord.watts.toFixed(1)} W / ${cord.va.toFixed(1)} VA / ${cord.amps.toFixed(2)} A`));
    }
    assert.match(text,/PSU 1/);assert.match(text,/PSU 2/);assert.ok(text.replace(/\s+/g,'').includes('20%extraheadroomappliedonce'));
  });
}

test('four-PDU rack uses the same saved calculation and retains every A/B physical input',async()=>{
  const {power}=await assertParity(ordinaryRack('generic',true));
  assert.equal(power.ready,true);assert.equal(power.supplies!.length,4);
  assert.deepEqual(power.scenarios.map(s=>s.outletLoads.length),[4,2,2]);
  for(const scenario of power.scenarios){
    assert.ok(Math.abs(scenario.totals.reduce((n,p)=>n+p.watts,0)-667.2)<1e-9);
    for(const cord of scenario.outletLoads)assert.ok(Math.abs(cord.watts-(scenario.lost?333.6:166.8))<1e-9);
  }
});

test('B300 export retains twelve distinct input identities and capacity-only scope',async()=>{
  const f=b300PowerFixture(),plan=balanceFeeds(f.equipment,f.inputs);
  assert.equal(plan.error,undefined);
  const {power,text}=await assertParity(makeRack(withCables(f.equipment,plan.assignments),{feedPower:f.inputs}));
  assert.equal(power.ready,true);assert.equal(power.scenarios[0].outletLoads.length,12);
  for(const scenario of power.scenarios)assert.equal(scenario.totals.reduce((n,p)=>n+p.watts,0),12000);
  for(let n=1;n<=6;n++)for(let input=1;input<=2;input++)assert.ok(text.includes(`PSU ${n} Input ${input}`));
  assert.match(text,/Server internal redundancy is not evaluated/);
  assert.ok(power.scenarios[0].outletLoads.every(c=>c.inputIdentity==='b300-module-input-v1'));
});

test('legacy-only Raritan inputs migrate consistently, and saved shared edits override stale legacy values',async()=>{
  const rack=ordinaryRack('raritan');
  rack.configuration={px3Power:{voltage:400,pf:.95,inputLimit:40,reserveDedicated:false,supplyConfirmed:true,headroomPercent:10,budgets:{server:{watts:1000,pf:.95,connector:'C13',passive:false,confirmed:true,source:'Synthetic old workbook',psusPerFeed:1,cordAmps:10,psuAcCapacity:2000}}}};
  const server=rack.devices.find(d=>d.id==='server')!;
  server.catalogDevice.rawData={powerLoad:{cords:2,minVoltage:100,maxVoltage:240,connector:'C13',psuAcCapacity:2000,cordLimitAmps:10}};
  const legacy=await assertParity(rack);
  assert.equal(legacy.assessment.inputs.budgets.server.watts,1000);assert.equal(legacy.power.scenarios[0].totals.reduce((n,p)=>n+p.watts,0),1100);
  const imported=structuredClone(legacy.assessment.inputs);imported.headroomPercent=25;imported.budgets.server.watts=800;
  rack.configuration={...rack.configuration as object,feedPower:imported};
  const shared=await assertParity(rack);
  assert.equal(shared.assessment.inputs.budgets.server.watts,800);assert.equal(shared.power.scenarios[0].totals.reduce((n,p)=>n+p.watts,0),1000);
  assert.equal((rack.configuration as {px3Power:{budgets:{server:{watts:number}}}}).px3Power.budgets.server.watts,1000);
});

test('recorded consumption stays usable with pending PSU/site verification while real limits still fail',async()=>{
  const rack=ordinaryRack(),inputs=readFeedInputs(rack.configuration,screenEquipment(rack));
  inputs.headroomPercent=0;inputs.budgets.server={watts:1648.5,pf:.97,measurement:{watts:1648.5,source:'Synthetic recorded reading'},connector:'C13',minVoltage:100,maxVoltage:240};
  for(const d of rack.devices.filter(d=>d.catalogDevice.category==='pdu'))(d.catalogDevice.rawData as {electricalProfile:Supply}).electricalProfile.confirmed=false;
  rack.configuration={feedPower:inputs};
  const planning=await assertParity(rack);
  assert.equal(planning.power.ready,true);assert.equal(planning.power.verificationReady,false);
  assert.equal(planning.power.scenarios[0].totals.reduce((n,p)=>n+p.watts,0),1648.5);
  assert.match(planning.text,/Verification pending/);assert.match(planning.text,/verify supported AC load per PSU/);
  assert.ok(!planning.text.includes('NEEDS REVIEW'));
  (rack.devices[0].catalogDevice.rawData as {electricalProfile:Supply}).electricalProfile.limitAmps=1;
  const overload=await assertParity(rack);
  assert.equal(overload.power.ready,false);assert.ok(overload.power.scenarios.some(s=>s.errors.length));assert.match(overload.text,/FAIL/);
});

test('incomplete B300 assignments remain excluded from capacity totals in the exported review',async()=>{
  const f=b300PowerFixture(),plan=balanceFeeds(f.equipment,f.inputs);
  const {power,text}=await assertParity(makeRack(withCables(f.equipment,plan.assignments.slice(0,1)),{feedPower:f.inputs}));
  assert.equal(power.ready,false);assert.ok(power.scenarios.every(s=>s.outletLoads.length===0));
  assert.ok(power.scenarios.every(s=>s.totals.every(p=>p.watts===0)));
  assert.ok(text.replace(/\s+/g,'').includes('IncompleteB300mappingsareexcludedfromcapacitytotals'));
});

test('old Raritan deep links render the canonical planner with migrated inputs and later shared edits',async()=>{
  const file=resolve('app/projects/[id]/racks/[rackId]/page.tsx'),source=readFileSync(file,'utf8');
  const components=new Map<string,string>();
  for(const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"](\.\/[^'"]+)['"]/g))components.set(match[2],match[1].split(',').map(v=>v.trim()).map(name=>`export const ${name}=${JSON.stringify(name)};`).join('\n'));
  components.set('@/app/appearance-menu','export const AppearanceMenu="AppearanceMenu";');
  const bundle=await build({entryPoints:[file],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',tsconfig:resolve('tsconfig.json'),plugins:[{name:'synthetic-page-adapters',setup(b){
    b.onResolve({filter:/.*/},args=>{
      if(args.path==='@/lib/prisma'||args.path==='next/server'||args.path==='next/navigation'||args.path==='next/link'||args.importer===file&&components.has(args.path))return {path:args.path,namespace:'page-mock'};
    });
    b.onLoad({filter:/.*/,namespace:'page-mock'},args=>({contents:components.get(args.path)||(args.path==='@/lib/prisma'?'export const prisma=__mocks.prisma;':args.path==='next/server'?'export async function connection(){}':args.path==='next/navigation'?'export function notFound(){throw Error("Unexpected missing rack")}':'export default "Link";'),loader:'js'}));
  }}]});
  const rack=ordinaryRack('raritan');
  rack.configuration={px3Power:{voltage:400,pf:1,inputLimit:40,headroomPercent:10,budgets:{server:{watts:900,connector:'C13',psusPerFeed:1}}}};
  const loaded={exports:{}};new Function('module','exports','require','__mocks',bundle.outputFiles![0].text)(loaded,loaded.exports,createRequire(import.meta.url),{prisma:{rack:{findFirst:async()=>rack},catalogDevice:{findMany:async()=>rack.devices.map(d=>d.catalogDevice)},connection:{findMany:async()=>[]}}});
  const page=(loaded.exports as {default:(props:unknown)=>Promise<ReactNode>}).default;
  function find(node:ReactNode,type:string):{initial:FeedInputs}[]{
    if(Array.isArray(node))return node.flatMap(n=>find(n,type));
    if(!isValidElement<{children?:ReactNode;initial:FeedInputs}>(node))return [];
    return [...(node.type===type?[node.props]:[]),...find(node.props.children,type)];
  }
  const props={params:Promise.resolve({id:rack.projectId,rackId:rack.id}),searchParams:Promise.resolve({tab:'power',planner:'raritan'})};
  const oldLink=await page(props),planner=find(oldLink,'FeedPowerPlanner');
  assert.equal(planner.length,1);assert.equal(find(oldLink,'PowerPlanner').length,0);assert.equal(planner[0].initial.budgets.server.watts,900);
  rack.configuration={...rack.configuration as object,feedPower:{headroomPercent:0,budgets:{server:{watts:700,pf:1}}}};
  const edited=find(await page(props),'FeedPowerPlanner');assert.equal(edited.length,1);assert.equal(edited[0].initial.budgets.server.watts,700);
});
