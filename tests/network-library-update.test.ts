import test from 'node:test';
import assert from 'node:assert/strict';
import {emptySystemSpecs,type SystemComponent} from '../lib/system-specs.ts';
import {networkPorts} from '../lib/network-ports.ts';
import {reviewComponentFields} from '../lib/component-review.ts';
import {isNetworkEnrichment,enrichmentConnectionError} from '../lib/network-library-update.ts';
const component=():SystemComponent=>({id:'saved-id',kind:'network',manufacturer:'Example',model:'Adapter',quantity:1,attributes:{ports:'2',slot:'1',connector:'QSFP28'},notes:''});
const raw=(c=component())=>({systemSpecs:{...emptySystemSpecs(),components:[c]}});
test('network reviews survive draft system status without changing saved endpoint IDs',()=>{
 const c=component();Object.assign(c.attributes,{protocol:'Ethernet',speedGbps:'100'});
 const before=raw(c),after=raw(reviewComponentFields(c,'https://manufacturer.example/spec','2026-11-10'));
 assert.deepEqual(networkPorts(after).map(p=>p.id),networkPorts(before).map(p=>p.id));
 assert.ok(networkPorts(after).every(p=>p.reviewed));
 after.systemSpecs.components[0].attributes.speedGbps='25';assert.ok(networkPorts(after).every(p=>!p.reviewed));
});
test('only missing capabilities may be enriched on an existing port topology',()=>{
 const c=component(),before=raw(c),next=structuredClone(c);Object.assign(next.attributes,{protocol:'Ethernet',speedGbps:'100'});
 assert.equal(isNetworkEnrichment(before,raw(next)),true);
 for(const [key,value] of [['ports','3'],['slot','2'],['connector','RJ45']]){const changed=structuredClone(next);changed.attributes[key]=value;assert.equal(isNetworkEnrichment(before,raw(changed)),false,key);}
 const moved=structuredClone(next);moved.id='new-id';assert.equal(isNetworkEnrichment(before,raw(moved)),false);
 const lower=structuredClone(next);lower.attributes.speedGbps='25';assert.equal(isNetworkEnrichment(raw(next),raw(lower)),false);
});
test('enrichment detects a newly incompatible saved connection',()=>{
 const before=raw(),a=component(),b=component();a.attributes.protocol='Ethernet';b.attributes.protocol='InfiniBand';
 const port=networkPorts(before)[0].id;
 const links=[{fromDevice:{catalogDeviceId:'a',catalogDevice:{rawData:before}},toDevice:{catalogDeviceId:'b',catalogDevice:{rawData:raw(b)}},fromPort:port,toPort:port,cableType:'DAC'}];
 assert.match(enrichmentConnectionError('a',raw(a),links)!,/cannot connect directly/);
 b.attributes.protocol='Ethernet';assert.equal(enrichmentConnectionError('a',raw(a),links),undefined);
});
