"use client";
import {useEffect,useRef,useState,type RefObject} from 'react';
import {createPortal} from 'react-dom';

// Mirror the pane's native scrollbar at the viewport edge while its own footer
// is out of reach. Both bars always scroll the same rack container.
export function RackHorizontalScroll({surface}:{surface:RefObject<HTMLDivElement|null>}){
 const scroller=useRef<HTMLElement|null>(null);
 const bar=useRef<HTMLDivElement|null>(null);
 const [view,setView]=useState({visible:false,left:0,max:0,x:0,width:0});
 useEffect(()=>{
  const root=surface.current;if(!root)return;
  let frame=0;
  function update(){
   frame=0;
   let target:HTMLElement|null=null;
   for(let node:HTMLElement|null=root;node;node=node.parentElement){
    if(/auto|scroll/.test(getComputedStyle(node).overflowX)&&node.scrollWidth>node.clientWidth+1){target=node;break;}
   }
   if(!target&&document.documentElement.scrollWidth>window.innerWidth+1)target=document.scrollingElement as HTMLElement;
   scroller.current=target;
   const rect=root!.getBoundingClientRect();
   const pane=target?.getBoundingClientRect();
   const page=target===document.scrollingElement;
   const x=Math.max(0,page?0:(pane?.left||0)+(target?.clientLeft||0));
   const right=Math.min(document.documentElement.clientWidth,page?window.innerWidth:(pane?.left||0)+(target?.clientLeft||0)+(target?.clientWidth||0));
   const width=Math.max(0,right-x);
   const max=target?target.scrollWidth-target.clientWidth:0;
   const next={visible:max>1&&width>0&&rect.bottom>window.innerHeight&&rect.top<window.innerHeight-40,left:target?.scrollLeft||0,max,x,width};
   setView(old=>Object.keys(next).every(k=>old[k as keyof typeof old]===next[k as keyof typeof next])?old:next);
  }
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
  const observer=new ResizeObserver(schedule);
  for(let node:HTMLElement|null=root;node;node=node.parentElement)observer.observe(node);
  window.addEventListener('scroll',schedule,true);window.addEventListener('resize',schedule);
  update();
  return()=>{observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener('scroll',schedule,true);window.removeEventListener('resize',schedule);};
 },[surface]);
 useEffect(()=>{if(bar.current&&Math.abs(bar.current.scrollLeft-view.left)>1)bar.current.scrollLeft=view.left;},[view]);
 if(!view.visible)return null;
 return createPortal(<div ref={bar} className="rack-horizontal-scroll" role="region" aria-label="Rack horizontal scrollbar" tabIndex={0} style={{left:view.x,width:view.width}} onScroll={e=>{if(scroller.current)scroller.current.scrollLeft=e.currentTarget.scrollLeft;}}>
  <div style={{width:view.width+view.max,height:1}}/>
 </div>,document.body);
}
