// Physical face bounds read from the original reference SVGs. These do not
// change the artwork or the separate pocket/specialized chassis renderers.
export function standardFaceGeometry(key:string,face:"front"|"rear",heightRU:number,pocket=false){
 if(pocket||heightRU!==1||!["arista-7050cx3","cisco-92348","smc-510p","arista-7010tx"].includes(key))return null;
 // Arista's rear metal face has its own explicit rectangle; the other faces
 // share the x=18,y=28,width=764,height=64 envelope (SMC hardware inside it).
 return key==="arista-7050cx3"&&face==="rear"?{x:28,y:33,width:744,height:53}:{x:18,y:28,width:764,height:64};
}
export function faceViewport(box:{x:number;y:number;width:number;height:number}){return `${box.x} ${box.y} ${box.width} ${box.height}`;}
