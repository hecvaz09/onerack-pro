export const POWER_MAP_ZOOM={min:50,max:300,step:25,initial:100} as const;
type Rect={left:number;top:number;width:number;height:number};
// DOM rectangles already include CSS zoom. Translate viewport positions into
// scroll-content coordinates so the cord stays attached while panning.
export function powerMapLine(origin:Rect,outlet:Rect,input:Rect,scrollLeft:number,scrollTop:number,width:number,height:number){
 return {x1:outlet.left+outlet.width/2-origin.left+scrollLeft,y1:outlet.top+outlet.height/2-origin.top+scrollTop,x2:input.left+input.width/2-origin.left+scrollLeft,y2:input.top+input.height/2-origin.top+scrollTop,width,height};
}
