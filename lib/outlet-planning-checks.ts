// Outlet planning uses the entered AC demand/PF and documented PDU limits.
// These disclosures concern assumptions or downstream equipment/cable verification,
// not missing inputs for the outlet calculation. Known violations stay in errors.
const separateVerification=[
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
