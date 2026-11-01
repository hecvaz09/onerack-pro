// Physical inlet identity and PDU capacity scope; no server redundancy model.
export const B300_INPUT_IDENTITY='b300-module-input-v1' as const;
export const B300_POWER_SCOPE='B300: all 12 AC inputs must be assigned. PDU capacity checks assume equal sharing across connected inputs and redistribution onto the surviving feed. Incomplete B300 mappings are excluded from capacity totals; completed proposals include their full entered demand. Server internal redundancy is not evaluated. These are calculated loads, not live readings.';
export function isB300PowerDevice(device:{sku?:string|null;model?:string|null}|undefined){return device?.sku==='AS-8126GS-NB3RT'||(!device?.sku&&device?.model==='AS-8126GS-NB3RT');}
export function powerInputLabel(device:{sku?:string|null;model?:string|null}|undefined,inlet:number){return isB300PowerDevice(device)&&Number.isInteger(inlet)&&inlet>=1&&inlet<=12?`PSU ${Math.ceil(inlet/2)} · Input ${(inlet-1)%2+1}`:`PSU ${inlet}`;}
// Coordinates of the unchanged rear SVG inlet rectangles, in its 800x640 space.
export const b300PowerInputBoxes=[{x:13,y:324},{x:207,y:324},{x:401,y:324},{x:595,y:324},{x:13,y:480},{x:595,y:480}].flatMap((p,index)=>[0,1].map(input=>({n:index*2+input+1,box:{x:p.x+7,y:p.y+12+input*67,w:29,h:54}})));

export function powerAssignmentLabel(device:{sku?:string|null;model?:string|null}|undefined,assignment:{inlet?:number;inputIdentity?:string}){return isB300PowerDevice(device)&&assignment.inputIdentity!==B300_INPUT_IDENTITY?`Legacy PSU ${assignment.inlet||"?"} - exact input needs review`:powerInputLabel(device,assignment.inlet||0);}
