import {analyzeFeeds} from './feed-power.ts';
import {feedRack,readFeedInputs,type FeedEquipment} from './feed-rack.ts';
import {consumptionLabel} from './power-consumption.ts';

export const assistantTopics=['balance','failover','checks','equipment','setup','help'] as const;
export type AssistantTopic=typeof assistantTopics[number];
export function isAssistantTopic(value:unknown):value is AssistantTopic {
  return typeof value==='string' && assistantTopics.includes(value as AssistantTopic);
}
export function explainRack(topic:AssistantTopic,equipment:FeedEquipment[],configuration:unknown):string {
  if(topic==='setup')return 'Start with the exact equipment model and its installed options. Use Guided equipment setup to prepare a draft, review the fields, then choose Save equipment. Rack placement and power connections remain under your control. Measured consumption belongs to the rack installation; PSU ratings are recorded separately.';
  if(topic==='help')return 'I can explain saved power balance, feed-loss scenarios, pending checks, and equipment consumption, or help you prepare an equipment draft. I cannot save rack changes from this conversation. Choose a topic below.';
  const inputs=readFeedInputs(configuration,equipment),model=feedRack(equipment,inputs);
  const result=analyzeFeeds(model.supplies,model.loads,model.cords,inputs.headroomPercent);
  if(topic==='equipment')return model.loads.length?model.loads.map(d=>`${d.name}: ${d.watts??'Not recorded'} W · ${consumptionLabel(d)} · ${d.cords} configured PSU cords.`).join('\n'):'No powered equipment is installed in this rack yet. Start by preparing an equipment configuration.';
  if(topic==='checks'){
    const messages=[...result.issues,...result.scenarios.flatMap(s=>s.errors.map(e=>`${s.lost?`Feed ${s.lost} lost`:'Normal operation'}: ${e}`))];
    return messages.length?`The calculator reports these checks:\n${[...new Set(messages)].join('\n')}\nMissing PSU documentation is separate from measured consumption. Existing measurement evidence has not been changed.`:'The calculator reports no validation issues for these saved inputs and connections. This is a calculated result, not a live electrical measurement.';
  }
  if(!model.supplies.length)return 'No PDU supplies are configured in this rack. Open Power Calculator to configure the available feeds before reviewing balance.';
  const scenarios=topic==='balance'?result.scenarios.filter(s=>!s.lost):result.scenarios.filter(s=>s.lost);
  const lines=scenarios.map(s=>{
    const totals=s.totals.filter(t=>t.online);
    const feeds=(['A','B'] as const).map(f=>`Feed ${f}: ${(totals.filter(t=>t.feed===f).reduce((n,t)=>n+t.watts,0)/1000).toFixed(2)} kW`).join(' · ');
    return `${s.lost?`Feed ${s.lost} lost`:'Normal operation'}\n${feeds}\n${totals.map(t=>{
      const p=model.supplies.find(p=>p.id===t.id)!;
      const phases=p.topology==='single-phase'?[t.amps]:t.phases;
      const phaseText=phases.map((a,i)=>`L${i+1}: ${a.toFixed(2)} / ${t.limitAmps} A`).join(' · ');
      const branches=Object.entries(t.branches).map(([b,a])=>`Branch ${b}: ${a.toFixed(2)} / ${p.branches?.[b]??'unknown'} A`).join(' · ');
      return `${t.name}\n${phaseText}${phases.length>1?`\nPhase spread: ${(Math.max(...phases)-Math.min(...phases)).toFixed(2)} A`:''}${branches?`\n${branches}`:''}`;
    }).join('\n\n')}${s.errors.length?`\nChecks: ${s.errors.join(' ')}`:''}`;
  });
  return `${lines.join('\n\n')}\n\nCalculated from saved wiring and recorded consumption, with ${inputs.headroomPercent}% headroom. Missing watts or power factor can exclude loads from totals. ${result.ready?'No calculator validation issues were found.':'Validation remains incomplete; review Pending checks before treating this as an approved plan.'} These are calculated currents, not live PDU readings.`;
}
