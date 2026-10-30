import {analyzeFeeds,supplyIssues,type FeedInputs} from './feed-power.ts';
import {feedRack,type FeedEquipment} from './feed-rack.ts';
import {isMeasuredPower} from './power-consumption.ts';
import {powerReviewSummary} from './power-review-summary.ts';
import {powerReviewResult} from './power-review-result.ts';
import {powerAssignmentSummary,scenarioDiagnostic} from './power-assignment-summary.ts';

// Presentation of the saved rack only; does not change allocation or validation.
export function powerOverview(equipment:FeedEquipment[],saved:FeedInputs){
  const {loads,supplies,cords}=feedRack(equipment,saved);
  const analysis=analyzeFeeds(supplies,loads,cords,saved.headroomPercent);
  const review=powerReviewResult(analysis);
  const assignments=powerAssignmentSummary(equipment,supplies,loads,cords,analysis);
  const priority=review.failures.length?{target:'review',label:'Review power checks',text:'The saved plan has electrical or wiring conflicts. Review these before proceeding.'}:assignments.backupFailures.length?{target:'connections',label:'Review backup-power connections',text:'Saved assignments lose required PSU connections in a modeled feed-loss check. Review the affected connections.'}:undefined;
  const recorded=loads.filter(d=>Number.isFinite(d.watts)&&Number(d.watts)>0);
  const missing=loads.filter(d=>!Number.isFinite(d.watts)||Number(d.watts)<=0||!Number.isFinite(d.pf)||Number(d.pf)<=0||Number(d.pf)>1);
  const expected=new Set(loads.flatMap(d=>Array.from({length:Number.isInteger(d.cords)&&d.cords>0?d.cords:0},(_,i)=>`${d.id}:${i+1}`)));
  const connected=new Set(cords.filter(c=>expected.has(`${c.deviceId}:${c.inlet}`)&&supplies.some(p=>p.id===c.pduId&&p.outlets.some(o=>o.n===c.outlet))).map(c=>`${c.deviceId}:${c.inlet}`));
  const documentation=analysis.issues.filter(issue=>issue.endsWith(': verify the PSU voltage range.')||issue.endsWith(': verify supported AC load per PSU and usable cord current.'));
  const findings=powerReviewSummary([...analysis.issues.filter(i=>!documentation.includes(i)&&!assignments.incompleteIssues.has(i)),...analysis.scenarios.flatMap(s=>s.errors.filter(i=>!assignments.incompleteScenarios.has(`${s.lost||'normal'}\n${i}`)).map(i=>scenarioDiagnostic(i,s.lost,equipment)))],equipment);
  const feedsReady=supplies.length>0&&supplies.some(p=>p.feed==='A')&&supplies.some(p=>p.feed==='B')&&supplies.every(p=>supplyIssues(p).length===0);
  const next=!loads.length?{target:'equipment',label:'Review rack equipment',text:'Install powered equipment in the rack elevation to begin planning.'}
    :missing.length?{target:'equipment',label:'Review equipment inputs',text:`${missing.length} ${missing.length===1?'system needs':'systems need'} consumption or power factor information.`}
    :!feedsReady?{target:'feeds',label:'Review power feeds',text:'Review the installed PDUs and confirm their A/B assignments and electrical setup.'}
    :connected.size<expected.size?{target:'connections',label:'Continue connections',text:`${expected.size-connected.size} PSU connections remain. Open the rear elevation to review recommended outlets.`}
    :{target:'review',label:'Review power balance',text:'All expected PSU connections have saved assignments. Review the calculated distribution and feed-loss scenarios.'};
  return {missingAssignments:assignments.missing,backupFailures:assignments.backupFailures,priority,systems:loads.length,pdus:supplies.length,connected:connected.size,expected:expected.size,watts:recorded.reduce((n,d)=>n+Number(d.watts),0),measured:recorded.filter(isMeasuredPower).length,estimated:recorded.filter(d=>!isMeasuredPower(d)&&!!d.estimateSource).length,entered:recorded.filter(d=>!isMeasuredPower(d)&&!d.estimateSource).length,missingWatts:loads.length-recorded.length,documentation:powerReviewSummary(documentation,equipment).actions,findings:findings.actions,assumptions:findings.assumptions,next};
}
