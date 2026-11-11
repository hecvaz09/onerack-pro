import {b300PowerFixture} from './fixtures/b300-power';
import {balanceFeeds} from '../lib/feed-balance';
import test from 'node:test';
import assert from 'node:assert/strict';
import {libraryPowerFactors} from '../lib/library-power-factor';
import {feedRack,readFeedInputs,type FeedEquipment} from '../lib/feed-rack';
import {feedInputsError,type FeedInputs} from '../lib/feed-power';
const device:FeedEquipment={id:'server',name:'SMC 1U Server · U1',sku:'SYS-510P-WTR',model:'SMC 1U Server',category:'server',details:{},rawData:{systemSpecs:{version:1,status:'verified',description:'',sourceUrl:'',notes:'',custom:[],components:[{id:'psu',kind:'psu',manufacturer:'Supermicro',model:'PWS-504P-1R',quantity:2,attributes:{},notes:''}]}}};
test('Library PF fills missing values, preserves measured watts and persists independent provenance',()=>{
 const inputs:FeedInputs={headroomPercent:0,budgets:{server:{watts:450,pf:0,measurement:{watts:450,source:'Meter reading'}}}};
 const result=libraryPowerFactors([device],inputs);assert.equal(result.changes.length,1);
 const b=result.inputs.budgets.server;assert.equal(b.watts,450);assert.equal(b.pf,.87);assert.deepEqual(b.measurement,inputs.budgets.server.measurement);assert.equal(inputs.budgets.server.pf,0);assert.match(b.pfEstimateSource!,/230 V/);assert.equal(feedInputsError(result.inputs),null);
 const reloaded=readFeedInputs(JSON.parse(JSON.stringify({feedPower:result.inputs})));assert.deepEqual(reloaded.budgets.server,b);assert.equal(feedRack([device],reloaded).loads[0].pfEstimateSource,b.pfEstimateSource);assert.equal(libraryPowerFactors([device],reloaded).changes.length,0);
});
test('existing PF, other PSU variants, missing PSU identity and absent demand are never replaced',()=>{
 for(const pf of [.95,1,1.2]){const inputs:FeedInputs={headroomPercent:0,budgets:{server:{watts:450,pf}}};assert.equal(libraryPowerFactors([device],inputs).inputs,inputs);}
 for(const model of ['PWS-504P-1R2','']){const d={...device,rawData:{systemSpecs:{version:1,status:'verified',description:'',sourceUrl:'',notes:'',custom:[],components:[{kind:'psu',model,quantity:2}]}}};assert.equal(libraryPowerFactors([d],{headroomPercent:0,budgets:{server:{watts:450,pf:0}}}).changes.length,0);}
 assert.equal(libraryPowerFactors([device],{headroomPercent:0,budgets:{}}).changes.length,0);
});

test('a sourced PF remains pending even when watts are a recorded measurement',()=>{
 const f=b300PowerFixture();const b=f.inputs.budgets.b300;b.measurement={watts:b.watts,source:'Meter'};b.pfEstimateSource='Documented planning PF';
 const plan=balanceFeeds(f.equipment,f.inputs,{planning:true});assert.equal(plan.error,undefined);assert.ok(plan.pendingChecks.some(s=>s.includes('power factor')));
 assert.ok(balanceFeeds(f.equipment,f.inputs).error);
});
