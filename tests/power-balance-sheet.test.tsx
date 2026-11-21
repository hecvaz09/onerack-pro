import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createElement,isValidElement,type ReactNode,type ReactElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PowerBalanceSheet} from '../app/projects/[id]/racks/[rackId]/power-balance-sheet';
import {SavedPowerReview} from '../app/projects/[id]/racks/[rackId]/saved-power-review';
import {rackPowerAssessment} from '../lib/rack-power-assessment';
import {overviewFixture} from './fixtures/power-overview';
import {b300PowerFixture,withCables} from './fixtures/b300-power';
import {B300_INPUT_IDENTITY} from '../lib/b300-power-inputs';

function connectedFixture(){
  const fixture=overviewFixture();
  fixture.equipment=withCables(fixture.equipment,[
    {pduId:'qa-pdu-a',outlet:1,deviceId:'qa-device',inlet:1},
    {pduId:'qa-pdu-b',outlet:1,deviceId:'qa-device',inlet:2},
  ]);
  return fixture;
}
function rendered(fixture=connectedFixture(),basis:'saved'|'proposed'='saved',useDesign=false){
  const assessment=rackPowerAssessment(fixture.equipment,fixture.saved);
  const html=renderToStaticMarkup(createElement(PowerBalanceSheet,{analysis:useDesign?assessment.design:assessment.strict,supplies:assessment.supplies,headroomPercent:fixture.saved.headroomPercent,basis}));
  return {assessment,html,text:html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()};
}
function scenario(html:string,name:string){
  const match=[...html.matchAll(/<article\b[^>]*data-balance-scenario="([^"]+)"[^>]*>([\s\S]*?)<\/article>/g)].find(item=>item[1]===name);
  assert.ok(match,`Missing ${name} scenario`);
  return match[0];
}
function nodes(tree:ReactNode):ReactElement<Record<string,unknown>>[]{
  if(Array.isArray(tree))return tree.flatMap(nodes);
  if(!isValidElement<Record<string,unknown>>(tree))return [];
  return [tree,...nodes(tree.props.children as ReactNode)];
}

test('visible saved balance uses the shared headroom calculation for normal and both feed losses',()=>{
  const {html,text,assessment}=rendered();
  assert.equal(assessment.strict.ready,true);
  assert.match(text,/Saved plan/);assert.match(text,/20% planning headroom/);
  assert.match(scenario(html,'normal'),/0\.75 kW/);assert.match(scenario(html,'normal'),/3\.26 \/ 16 A/);
  for(const lost of ['A','B']){
    assert.match(scenario(html,lost),/1\.50 kW/);assert.match(scenario(html,lost),/6\.52 \/ 16 A/);
    assert.equal((scenario(html,lost).match(/· Offline/g)||[]).length,1);
  }
  assert.equal((html.match(/data-balance-status="passed"/g)||[]).length,3);
  assert.ok(html.indexOf('data-balance-scenario="B"')<html.indexOf('<details'),'all main scenarios must precede the optional phase/bank disclosure');
  assert.match(text,/Phase and bank detail/);assert.match(text,/Bank one: 6\.52 \/ 16 A/);
});

test('proposal basis is explicit and does not change the analyzer figures',()=>{
  const saved=rendered(),proposed=rendered(undefined,'proposed');
  assert.deepEqual(proposed.assessment.strict.scenarios,saved.assessment.strict.scenarios);
  assert.match(proposed.text,/Proposed plan · Not saved/);assert.match(proposed.text,/Saved inputs and proposed connections/);
  assert.match(proposed.html,/data-power-balance="proposed"/);
});

test('empty racks and completely missing demand never show a passing zero-load plan',()=>{
  const empty=rendered({equipment:[],saved:{headroomPercent:0,budgets:{}}});
  assert.match(empty.text,/No PDU loads available/);assert.doesNotMatch(empty.html,/data-balance-status="passed"|0\.00 kW/);
  const missing=connectedFixture();missing.saved.budgets={};
  const unknown=rendered(missing);
  assert.match(unknown.text,/Incomplete inputs or connections/);assert.match(unknown.text,/Load unavailable/);
  assert.equal((unknown.html.match(/data-balance-status="incomplete"/g)||[]).length,3);
  assert.doesNotMatch(unknown.html,/data-balance-status="passed"|0\.00 kW/);
});

test('partial known demand remains visible while missing systems keep every scenario incomplete',()=>{
  const fixture=connectedFixture();
  fixture.equipment.push({...fixture.equipment[2],id:'qa-missing',name:'Synthetic missing demand'});
  fixture.equipment=withCables(fixture.equipment,[
    {pduId:'qa-pdu-a',outlet:1,deviceId:'qa-device',inlet:1},{pduId:'qa-pdu-b',outlet:1,deviceId:'qa-device',inlet:2},
    {pduId:'qa-pdu-a',outlet:2,deviceId:'qa-missing',inlet:1},{pduId:'qa-pdu-b',outlet:2,deviceId:'qa-missing',inlet:2},
  ]);
  const {html,text}=rendered(fixture);
  assert.match(text,/Known load/);assert.match(text,/0\.75 kW/);assert.match(text,/do not establish a complete rack total/);
  assert.equal((html.match(/data-balance-status="incomplete"/g)||[]).length,3);assert.doesNotMatch(html,/data-balance-status="passed"/);
});

test('a normal pass cannot hide a line overload in either failover scenario',()=>{
  const fixture=connectedFixture();fixture.saved.headroomPercent=0;fixture.saved.budgets['qa-device'].watts=4000;
  const {html}=rendered(fixture);
  assert.match(scenario(html,'normal'),/data-balance-status="passed"/);
  for(const lost of ['A','B']){
    assert.match(scenario(html,lost),/data-balance-status="failed"/);
    assert.match(scenario(html,lost),/17\.39 \/ 16 A/);
    assert.match(scenario(html,lost),/exceeds 16 A/);
  }
});

test('missing mappings are incomplete while a complete plan on one feed fails loss of that feed',()=>{
  const partial=connectedFixture();partial.equipment[1].details={outlets:{}};
  const incomplete=rendered(partial);
  assert.equal((incomplete.html.match(/data-balance-status="incomplete"/g)||[]).length,3);
  assert.doesNotMatch(incomplete.html,/data-balance-status="passed"/);
  const wrongFeed=connectedFixture();wrongFeed.equipment=withCables(wrongFeed.equipment,[
    {pduId:'qa-pdu-a',outlet:1,deviceId:'qa-device',inlet:1},{pduId:'qa-pdu-a',outlet:2,deviceId:'qa-device',inlet:2},
  ]);
  const complete=rendered(wrongFeed);
  assert.match(scenario(complete.html,'A'),/data-balance-status="failed"/);
  assert.match(scenario(complete.html,'A'),/0 surviving cords; needs at least 1/);
});

test('pending site and downstream PSU verification remains separate from a calculated design pass',()=>{
  const fixture=connectedFixture();
  for(const supply of Object.values(fixture.saved.supplies!))supply.confirmed=false;
  fixture.equipment[2].rawData={powerLoad:{cords:2,minimumCords:1,connector:'C13',minVoltage:200,maxVoltage:240}};
  for(const useDesign of [false,true]){
    const {html,text,assessment}=rendered(fixture,'saved',useDesign);
    assert.equal(assessment.strict.ready,false);assert.equal(assessment.design.ready,true);
    assert.equal((html.match(/data-balance-status="passed"/g)||[]).length,3);
    assert.match(text,/Pending site and equipment verification/);
    assert.match(text,/verify supported AC load per PSU and usable cord current/);
    assert.doesNotMatch(text,/Incomplete inputs or connections/);
  }
});

test('B300 incomplete inputs stay out of totals and completed capacity checks retain their scope',()=>{
  const fixture=b300PowerFixture();
  const cords=Array.from({length:12},(_,i)=>({pduId:i<6?'pdu-a':'pdu-b',outlet:i%6+1,deviceId:'b300',inlet:i+1,inputIdentity:B300_INPUT_IDENTITY}));
  const partial=rendered({equipment:withCables(fixture.equipment,cords.slice(0,11)),saved:fixture.inputs});
  assert.equal((partial.html.match(/data-balance-status="incomplete"/g)||[]).length,3);
  assert.doesNotMatch(partial.html,/data-balance-status="passed"|0\.00 kW/);
  assert.match(partial.text,/Incomplete B300 mappings are excluded from capacity totals/);
  const complete=rendered({equipment:withCables(fixture.equipment,cords),saved:fixture.inputs});
  assert.match(complete.text,/PDU capacity scenarios/);assert.match(complete.text,/6\.00 kW/);assert.match(complete.text,/12\.00 kW/);
  assert.match(complete.text,/Highest line \/ limit/);assert.match(complete.text,/Server internal redundancy is not evaluated/);
  assert.equal((complete.html.match(/data-balance-status="passed"/g)||[]).length,3);
});

test('saved review defaults to one visible sheet and can omit it without hiding conflicts or actions',()=>{
  const fixture=connectedFixture();fixture.saved.headroomPercent=0;fixture.saved.budgets['qa-device'].watts=4000;
  const withBalance=renderToStaticMarkup(createElement(SavedPowerReview,{...fixture,dirty:false}));
  assert.equal((withBalance.match(/data-power-balance="saved"/g)||[]).length,1);
  const reviewOnly=renderToStaticMarkup(createElement(SavedPowerReview,{...fixture,dirty:true,showBalance:false}));
  assert.doesNotMatch(reviewOnly,/data-power-balance/);
  assert.match(reviewOnly,/Conflicts to resolve/);assert.match(reviewOnly,/Review affected connections/);
  assert.match(reviewOnly,/Unsaved edits are excluded/);assert.match(reviewOnly,/Full diagnostic list/);
});

test('saved review input and connection actions open every enclosing disclosure before focusing',()=>{
  const previousDocument=Object.getOwnPropertyDescriptor(globalThis,'document');
  const previousDetails=Object.getOwnPropertyDescriptor(globalThis,'HTMLDetailsElement');
  class Details{open=false;parentElement:Details|null=null;}
  try{
    Object.defineProperty(globalThis,'HTMLDetailsElement',{configurable:true,value:Details});
    for(const targetId of ['power-equipment','power-connections']){
      const outer=new Details(),inner=new Details();inner.parentElement=outer;
      let focused=false,scrolled=false;
      const target={parentElement:inner,focus(){assert.equal(outer.open,true);assert.equal(inner.open,true);focused=true;},scrollIntoView(){scrolled=true;}};
      Object.defineProperty(globalThis,'document',{configurable:true,value:{getElementById:(id:string)=>{assert.equal(id,targetId);return target;}}});
      const fixture=connectedFixture();
      if(targetId==='power-equipment')fixture.saved.budgets={};
      else fixture.saved.budgets['qa-device'].watts=4000;
      const tree=SavedPowerReview({...fixture,dirty:false,showBalance:false});
      const label=targetId==='power-equipment'?'Review equipment power inputs':'Review affected connections';
      const button=nodes(tree).find(node=>node.type==='button'&&node.props.children===label);
      assert.ok(button,`Missing action ${label}`);(button.props.onClick as ()=>void)();
      assert.equal(focused,true);assert.equal(scrolled,true);
    }
  }finally{
    if(previousDocument)Object.defineProperty(globalThis,'document',previousDocument);else Reflect.deleteProperty(globalThis,'document');
    if(previousDetails)Object.defineProperty(globalThis,'HTMLDetailsElement',previousDetails);else Reflect.deleteProperty(globalThis,'HTMLDetailsElement');
  }
});
