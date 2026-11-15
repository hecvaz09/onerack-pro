export const POWER_MAP_ZOOM={min:50,max:300,step:25,initial:100} as const;
type Rect={left:number;top:number;width:number;height:number};
// DOM rectangles already include CSS zoom. Translate viewport positions into
// scroll-content coordinates so the cord stays attached while panning.
export function powerMapLine(origin:Rect,outlet:Rect,input:Rect,scrollLeft:number,scrollTop:number,width:number,height:number){
 return {x1:outlet.left+outlet.width/2-origin.left+scrollLeft,y1:outlet.top+outlet.height/2-origin.top+scrollTop,x2:input.left+input.width/2-origin.left+scrollLeft,y2:input.top+input.height/2-origin.top+scrollTop,width,height};
}

// Schematic route along a chassis edge and the PDU side gutter. Dimensions are
// in scroll-content coordinates; this is not a measured cable/clearance design.
export function powerMapRoute(line:ReturnType<typeof powerMapLine>,chassis?:Rect,pdu?:Rect){
 const {x1,y1,x2,y2}=line;
 if(!chassis)return `M ${x1} ${y1} L ${x2} ${y2}`;
 const left=x1<chassis.left+chassis.width/2,edge=left?chassis.left:chassis.left+chassis.width;
 const pduEdge=pdu?(left?pdu.left+pdu.width:pdu.left):x1;
 const gutter=(pduEdge+edge)/2,pad=Math.min(8,Math.max(2,chassis.height*.06));
 const y=y2<chassis.top+chassis.height/2?Math.max(0,chassis.top-pad):Math.min(line.height,chassis.top+chassis.height+pad);
 return `M ${x1} ${y1} H ${gutter} V ${y} H ${x2} V ${y2}`;
}
