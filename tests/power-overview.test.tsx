import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PowerOverview} from '../app/projects/[id]/racks/[rackId]/power-overview';
import {overviewFixture} from './fixtures/power-overview';

function render(equipment=overviewFixture().equipment,saved=overviewFixture().saved,dirty=false){
 const html=renderToStaticMarkup(createElement(PowerOverview,{equipment,saved,dirty}));
 const text=html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
 return {html,text};
}
test('recorded demand remains before headroom and never becomes PSU nameplate capacity',()=>{
 const {text}=render();assert.match(text,/Recorded equipment demand/);assert.match(text,/1\.25 kW/);assert.doesNotMatch(text,/1\.50 kW|5\.00 kW/);assert.match(text,/Before planning headroom/);
});
test('empty rack shows unknown demand and no invented completion',()=>{
 const {text,html}=render([],{headroomPercent:0,budgets:{}});
 assert.match(text,/No powered systems yet/);assert.match(text,/No demand recorded/);assert.doesNotMatch(text,/0\.00|0 \/ 0|100%|Checks passed/);assert.doesNotMatch(html,/<progress/);
});
test('missing watts show a partial known total instead of treating missing systems as zero',()=>{
 const {equipment,saved}=overviewFixture();equipment.push({...equipment[2],id:'qa-missing',name:'Synthetic missing system'});
 const {text}=render(equipment,saved);assert.match(text,/1\.25 kW/);assert.match(text,/Partial total/);assert.match(text,/1 system still needs watts/);assert.match(text,/Review equipment inputs/);
});
test('all missing consumption shows an unknown total rather than zero kW',()=>{
 const {equipment,saved}=overviewFixture();saved.budgets={};const {text}=render(equipment,saved);
 assert.match(text,/No demand recorded/);assert.doesNotMatch(text,/0\.00/);
});
test('measured estimated and entered provenance remains visible',()=>{
 const {equipment,saved}=overviewFixture();
 equipment.push({...equipment[2],id:'qa-estimate',name:'Synthetic estimate'},{...equipment[2],id:'qa-entered',name:'Synthetic entered'});
 saved.budgets={'qa-device':{watts:1000,pf:1,measurement:{watts:1000,source:'Synthetic measured reading'}},'qa-estimate':{watts:200,pf:1,estimateSource:'Synthetic estimate assumption'},'qa-entered':{watts:300,pf:1}};
 const {text}=render(equipment,saved);assert.match(text,/1 recorded measurement/);assert.match(text,/1 estimated/);assert.match(text,/1 entered/);assert.match(text,/1\.50 kW/);
});
test('dirty inputs show saved values and exactly one contextual save-navigation action',()=>{
 const {html,text}=render(undefined,undefined,true);
 assert.match(text,/Unsaved edits are not included/);assert.match(text,/Review and save inputs/);assert.match(text,/1\.25 kW/);assert.equal((html.match(/<button/g)||[]).length,1);
});
test('saved assignment progress does not claim physical installation or tested readiness',()=>{
 const {equipment,saved}=overviewFixture();
 equipment[0].details={outlets:{'1':{deviceId:'qa-device',inlet:1,notes:''}}};
 const {text,html}=render(equipment,saved);
 assert.match(text,/Saved PSU assignments/);assert.match(text,/1 \/ 2/);assert.match(html,/<progress/);assert.match(text,/do not confirm physical installation, testing or electrical capacity/);
});
test('power factor still prevents proceeding even when all watts are recorded',()=>{
 const {equipment,saved}=overviewFixture();saved.budgets['qa-device'].pf=0;
 const {text}=render(equipment,saved);assert.match(text,/1\.25 kW/);assert.match(text,/power factor/);assert.match(text,/Review equipment inputs/);assert.doesNotMatch(text,/Checks passed/);
});
test('grouped checks remain available in a single collapsed disclosure',()=>{
 const {equipment,saved}=overviewFixture();equipment[2].rawData={powerLoad:{cords:2,minimumCords:1,connector:'C13'}};
 const {text,html}=render(equipment,saved);assert.match(text,/Checks and assumptions/);assert.match(text,/PSU documentation/);assert.doesNotMatch(html,/<details[^>]* open/);
});

test('complete saved mappings do not hide an existing electrical conflict',()=>{
 const {equipment,saved}=overviewFixture();
 equipment[0].details={outlets:{'1':{deviceId:'qa-device',inlet:1,notes:''}}};
 equipment[1].details={outlets:{'1':{deviceId:'qa-device',inlet:2,notes:''}}};
 saved.budgets['qa-device'].watts=50000;
 const {text}=render(equipment,saved);assert.match(text,/2 \/ 2/);assert.match(text,/electrical or wiring conflicts/);assert.match(text,/Review power checks/);assert.doesNotMatch(text,/Checks passed/);
});
test('a known saved conflict remains the priority while dirty values stay excluded',()=>{
 const {equipment,saved}=overviewFixture();saved.budgets['qa-device'].watts=50000;
 equipment[0].details={outlets:{'1':{deviceId:'qa-device',inlet:1,notes:''}}};
 equipment[1].details={outlets:{'1':{deviceId:'qa-device',inlet:2,notes:''}}};
 const {text,html}=render(equipment,saved,true);
 assert.match(text,/Unsaved edits are not included/);assert.match(text,/Review power checks/);assert.equal((html.match(/<button/g)||[]).length,1);
});

test('the single next action precedes demand and assignment metrics',()=>{
 const {html,text}=render();
 assert.ok(html.indexOf('<button')<html.indexOf('Recorded equipment demand'));
 assert.ok(html.indexOf('<button')<html.indexOf('Saved PSU assignments'));
 assert.match(text,/What to do next/);
 assert.match(text,/Recommendations depend on the saved inputs and configured limits/);
});
test('dirty saved-state and conflict navigation retain their contextual button labels',()=>{
 const {equipment,saved}=overviewFixture();
 const dirty=render(equipment,saved,true);
 assert.ok(dirty.html.indexOf('<button')<dirty.html.indexOf('Recorded equipment demand'));
 assert.match(dirty.text,/Review and save inputs/);assert.match(dirty.text,/Unsaved edits are not included/);
 saved.budgets['qa-device'].watts=50000;
 equipment[0].details={outlets:{'1':{deviceId:'qa-device',inlet:1,notes:''}}};
 equipment[1].details={outlets:{'1':{deviceId:'qa-device',inlet:2,notes:''}}};
 const conflict=render(equipment,saved,true);
 assert.match(conflict.text,/Review power checks/);assert.doesNotMatch(conflict.text,/Review and save inputs/);
});
