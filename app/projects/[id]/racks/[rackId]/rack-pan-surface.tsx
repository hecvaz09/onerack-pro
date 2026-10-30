"use client";
import {useEffect,useRef,type ReactNode} from 'react';

import {RackHorizontalScroll} from './rack-horizontal-scroll';

// Background gestures scroll the nearest scrollable ancestor. Equipment and
// connector gestures belong to their own controls, never to the pan surface.
export function RackPanSurface({children}:{children:ReactNode}) {
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const element=root.current!;
  let cleanup=()=>{};
  let suppressClick=false;
  function down(event:PointerEvent){
   cleanup(); suppressClick=false;
   const target=event.target instanceof Element?event.target:null;
   if(event.button!==0||!event.isPrimary||!target||target.closest('[data-device-block],.physical-pdu,a,input,select,textarea,[role="button"],button:not(.physical-slot):not(.empty-pocket)'))return;
   const scroller=(axis:'x'|'y')=>{
    for(let node:HTMLElement|null=element;node;node=node.parentElement){
     const style=getComputedStyle(node);
     if(/auto|scroll/.test(axis==='y'?style.overflowY:style.overflowX)&&(axis==='y'?node.scrollHeight>node.clientHeight:node.scrollWidth>node.clientWidth))return node;
    }
    return document.scrollingElement as HTMLElement;
   };
   const vertical=scroller('y'),horizontal=scroller('x');
   const x=event.clientX,y=event.clientY,left=horizontal.scrollLeft,top=vertical.scrollTop;
   const move=(e:PointerEvent)=>{
    if(e.pointerId!==event.pointerId)return;
    if(!suppressClick&&Math.hypot(e.clientX-x,e.clientY-y)<5)return;
    suppressClick=true; e.preventDefault(); element.dataset.panning='true';
    horizontal.scrollLeft=left+x-e.clientX;
    vertical.scrollTop=top+y-e.clientY;
   };
   const stop=()=>{delete element.dataset.panning;window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stop);window.removeEventListener('pointercancel',stop);window.removeEventListener('blur',stop);};
   cleanup=stop;
   window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',stop);window.addEventListener('pointercancel',stop);window.addEventListener('blur',stop);
  }
  function click(event:MouseEvent){if(suppressClick){event.preventDefault();event.stopPropagation();suppressClick=false;}}
  element.addEventListener('pointerdown',down);element.addEventListener('click',click,true);
  return()=>{cleanup();element.removeEventListener('pointerdown',down);element.removeEventListener('click',click,true);};
 },[]);
 return <div ref={root} className="rack-pan-surface">{children}<RackHorizontalScroll surface={root}/></div>;
}
