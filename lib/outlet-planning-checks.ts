import {SITE_SUPPLY_CHECK,type analyzeFeeds} from './feed-power.ts';
// Outlet planning uses the entered AC demand/PF and documented PDU limits.
// These disclosures concern assumptions or downstream equipment/cable verification,
// not missing inputs for the outlet calculation. Known violations stay in errors.
const separateVerification=[
 `: ${SITE_SUPPLY_CHECK}.`,
 ': cable compatibility is pending; outlet-only planning.',
 ': verify usable input cord current.',
 ': verify supported AC load per PSU and usable cord current.',
 ': power estimate uses unverified efficiency, power factor and load assumptions.',
];
export function outletPlanningChecks(checks:{errors:string[];pendingChecks:string[]}){
 const verificationNotes=checks.pendingChecks.filter(s=>separateVerification.some(suffix=>s.endsWith(suffix)));
 const pendingChecks=checks.pendingChecks.filter(s=>!verificationNotes.includes(s));
 return {errors:checks.errors,pendingChecks,verificationNotes};
}
// Present design validity without changing the strict electrical-verification result
// or setting a supply's saved confirmation flag.
export function designPowerAnalysis(analysis:ReturnType<typeof analyzeFeeds>){
 const {pendingChecks:issues,verificationNotes}=outletPlanningChecks({errors:[],pendingChecks:analysis.issues});
 return {...analysis,issues,ready:issues.length===0&&analysis.scenarios.every(s=>!s.errors.length),verificationNotes};
}
