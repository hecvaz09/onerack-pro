import type {analyzeFeeds} from './feed-power.ts';

// Presentation only. A passing result always comes from the existing engine.
export function powerReviewResult(analysis:ReturnType<typeof analyzeFeeds>){
 const documentation=(s:string)=>s.endsWith(': verify the PSU voltage range.')||s.endsWith(': verify supported AC load per PSU and usable cord current.');
 const connection=(s:string)=>/not all .*power cords are connected|surviving cords|saved cable|Duplicate outlet|incompatible connector|outside its documented|reserved for facility/.test(s);
 const failures=[...new Set([...analysis.scenarios.flatMap(s=>s.errors).filter(s=>!s.includes('surviving cords')),...analysis.issues.filter(s=>/invalid device|Duplicate outlet|incompatible connector|outside its documented|reserved for facility/.test(s))])];
 const docs=analysis.issues.filter(documentation);
 const wiring=[...new Set([...analysis.issues,...analysis.scenarios.flatMap(s=>s.errors)].filter(connection))];
 const remaining=analysis.issues.filter(s=>!documentation(s)&&!connection(s));
 const feedIssue=(s:string)=>/supply|phase|branch|outlet|feed|PDUs|neutral current limit/i.test(s.slice(s.lastIndexOf(':')+1));
 const actions:{label:string;target:string;description:string}[]=[];
 if(failures.length)actions.push({label:'Review affected connections',target:'power-connections',description:'The saved plan has electrical or wiring conflicts. Review the affected equipment before changing assignments.'});
 else if(wiring.length)actions.push({label:'Complete or correct connections',target:'power-connections',description:'Missing or invalid connections prevent verification of the saved plan.'});
 if(remaining.some(feedIssue))actions.push({label:'Review power feed settings',target:'power-feeds',description:'PDU setup or feed information needs verification.'});
 if(remaining.some(s=>!feedIssue(s)))actions.push({label:'Review equipment power inputs',target:'power-equipment',description:'Consumption values or planning assumptions need review.'});
 if(docs.length)actions.push({label:'Review missing PSU specifications',target:'power-equipment',description:'Missing PSU specifications prevent complete verification. Recorded consumption is unchanged.'});
 return {title:analysis.ready?'Calculated checks passed':failures.length?'Saved plan needs correction':'Verification incomplete',description:analysis.ready?'Your saved plan stays within configured limits during normal operation and if either feed fails.':failures.length?'Resolve the findings below, then review the saved plan again.':'Complete the outstanding information or connections to finish checking your saved plan.',failures,docs,actions};
}
