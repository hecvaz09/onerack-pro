"use client";
import {createContext,useContext,useImperativeHandle,useMemo,useState,type ReactNode,type Ref} from 'react';
export type EquipmentDrawerHandle={show:()=>void};
const DrawerContext=createContext({open:true,toggle:()=>{}});
// Keep visibility updates outside the expensive rack and SVG component tree.
export function EquipmentDrawerScope({children,ref}:{children:ReactNode;ref:Ref<EquipmentDrawerHandle>}){
 const [open,setOpen]=useState(true);
 useImperativeHandle(ref,()=>({show:()=>setOpen(true)}),[]);
 const value=useMemo(()=>({open,toggle:()=>setOpen(v=>!v)}),[open]);
 return <DrawerContext.Provider value={value}><div className={open?'equipment-visibility library-open':'equipment-visibility library-closed'}>{children}</div></DrawerContext.Provider>;
}
export function EquipmentDrawerToggle({disabled}:{disabled:boolean}){
 const {open,toggle}=useContext(DrawerContext);
 return <button type="button" aria-expanded={open} aria-controls="equipment-drawer" disabled={disabled} onClick={e=>{e.stopPropagation();toggle();}} className="rounded-md border border-border px-3 py-2 text-sm">{open?'Hide equipment ←':'Equipment →'}</button>;
}
export function EquipmentDrawer({children}:{children:ReactNode}){
 const {open}=useContext(DrawerContext);
 return <aside id="equipment-drawer" aria-label="Equipment panel" inert={!open} className="elevation-tools">{children}</aside>;
}
