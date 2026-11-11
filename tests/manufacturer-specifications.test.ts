import test from 'node:test';
import assert from 'node:assert/strict';
import {manufacturerSpecifications} from '../lib/manufacturer-specifications.ts';
import {emptySystemSpecs,type SystemComponent} from '../lib/system-specs.ts';
import {catalogPowerLimits} from '../lib/catalog-power-limits.ts';
import {networkPorts} from '../lib/network-ports.ts';
import {portCompatibility} from '../lib/network-ports.ts';
import {BREAKOUT_CABLE} from '../lib/network-breakout.ts';
const psu: SystemComponent={id:'psu',kind:'psu',manufacturer:'Supermicro',model:'PWS-504P-1R',quantity:2,attributes:{inputVoltage:'100–240 VAC',outputWatts:'500'},notes:'keep'};
test('sourced draft fields persist and inherit without promoting DC capacity or installation demand',()=>{
 const before={...emptySystemSpecs(),components:[psu]},saved=JSON.parse(JSON.stringify(manufacturerSpecifications('SYS-510P-WTR',before).specs));
 assert.equal(saved.status,'draft');assert.equal(saved.components[0].id,psu.id);assert.equal(saved.components[0].notes,'keep');
 assert.deepEqual(catalogPowerLimits({systemSpecs:saved}),{minVoltage:100,maxVoltage:240});
 assert.equal(manufacturerSpecifications('SYS-510P-WTR',saved).changes.length,0);
 assert.equal(psu.attributes.inputVoltage,'100–240 VAC');
});
test('different variants and conflicting existing values are never overwritten',()=>{
 const before={...emptySystemSpecs(),components:[{...psu,attributes:{inputVoltage:'200-240 VAC'}}]};
 assert.equal(manufacturerSpecifications('SYS-510P-WTR-EU',before).changes.length,0);
 const result=manufacturerSpecifications('SYS-510P-WTR',before);assert.equal(result.changes.length,0);assert.equal(result.conflicts.length,1);
 assert.equal(result.specs.components[0].attributes.inputVoltage,'200-240 VAC');
});
test('reviewing onboard specifications preserves every network endpoint ID',()=>{
 const c:SystemComponent={id:'existing-nic',kind:'network',manufacturer:'Intel',model:'Intel X550 onboard LAN',quantity:1,notes:'',attributes:{slot:'Onboard',ports:'2',protocol:'Ethernet',connector:'RJ45',speedGbps:'10'}};
 const before={...emptySystemSpecs(),components:[c]},result=manufacturerSpecifications('SYS-510P-WTR',before);
 assert.deepEqual(networkPorts({systemSpecs:before}).map(p=>p.id),networkPorts({systemSpecs:result.specs}).map(p=>p.id));
 assert.ok(networkPorts({systemSpecs:result.specs}).every(p=>p.reviewed));
});
test('installed AOC capabilities do not invent a configured 100G link or reject a supported 25G leg',()=>{
 const c:SystemComponent={id:'installed-card',kind:'network',manufacturer:'Supermicro',model:'AOC-S100G-M2C-P',quantity:1,notes:'',attributes:{ports:'2',connector:'QSFP28',slot:'AIOM1',node:'A'}};
 const result=manufacturerSpecifications('CUSTOM',{...emptySystemSpecs(),components:[c]}),ports=networkPorts({systemSpecs:result.specs});
 assert.equal(ports[0].speedGbps,null);assert.deepEqual(ports[0].supportedSpeedsGbps,[10,25,40,50,100]);assert.equal(ports[0].reviewed,true);
 const leg={...ports[0],id:'leg',lane:1,speedGbps:25,connector:'SFP28'};
 assert.equal(portCompatibility(leg,ports[0],BREAKOUT_CABLE).error,undefined);
 assert.ok(portCompatibility(leg,ports[0],BREAKOUT_CABLE).warnings.includes('Link speed is unspecified.'));
 assert.match(portCompatibility(leg,{...ports[0],speedGbps:100},BREAKOUT_CABLE).error!,/25G/);
});
