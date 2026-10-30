"use client";
import {useRef,useState,type FormEvent} from 'react';
import {Menu} from '@base-ui/react/menu';
import {Dialog} from '@base-ui/react/dialog';
import {Button} from '@/components/ui/button';
import {changeProjectTrash} from './trash-actions';
import {projectTrashDestination} from '@/lib/project-lifecycle';
const normalizedProjectName=(value:string)=>value.trim().replace(/\s+/gu,' ').toLowerCase();
export const projectNameMatches=(value:string,name:string)=>Boolean(normalizedProjectName(value))&&normalizedProjectName(value)===normalizedProjectName(name);
export type ProjectActionTarget={id:string;name:string;rackCount:number};
export function ProjectConfirmation({project,trash,value,onValue,pending,error,onSubmit,onCancel}:{project:ProjectActionTarget;trash:boolean;value:string;onValue:(value:string)=>void;pending:boolean;error:string;onSubmit:(event:FormEvent<HTMLFormElement>)=>void;onCancel:()=>void}){
 return <form onSubmit={onSubmit} className="mt-4 space-y-4">
  <p className="text-sm text-muted-foreground">{trash?`${project.rackCount} ${project.rackCount===1?'rack':'racks'}, installed equipment, saved connections and history will be preserved. You can restore this project from Trash.`:'The same project, racks, connections and history will become available again.'}</p>
  <p className="break-all text-xs text-muted-foreground">Project ID: {project.id}</p>
  {trash&&<label className="block text-sm">Type the project name to confirm: <strong>{project.name}</strong><input autoComplete="off" aria-label="Confirm project name" aria-describedby={`project-trash-name-${project.id}`} disabled={pending} value={value} onChange={e=>onValue(e.target.value)} className="mt-2 block h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"/></label>}
  {trash&&<p id={`project-trash-name-${project.id}`} role="status" aria-live="polite" className="text-sm text-muted-foreground">{projectNameMatches(value,project.name)?"Project name matches. You can move this project to Trash.":"Enter the project name shown above. Capitalization and extra spaces are ignored."}</p>}
  {error&&<p role="alert" className="text-sm">{error}</p>}
  <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="outline" disabled={pending} onClick={onCancel}>Cancel</Button><Button type="submit" disabled={pending||(trash&&!projectNameMatches(value,project.name))}>{pending?'Saving…':trash?'Move project to Trash':'Restore project'}</Button></div>
 </form>;
}
export function ProjectActions({project,trashed=false}:{project:ProjectActionTarget;trashed?:boolean}){
 const [open,setOpen]=useState(false),[value,setValue]=useState(''),[pending,setPending]=useState(false),[error,setError]=useState('');
 const busy=useRef(false),trigger=useRef<HTMLButtonElement>(null),trash=!trashed;
 function close(){if(!busy.current){setOpen(false);setValue('');setError('');}}
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy.current||(trash&&!projectNameMatches(value,project.name)))return;
  busy.current=true;setPending(true);setError('');
  try{
   const result=await changeProjectTrash(project.id,project.name,trash);
   if(!result.ok){setError(result.error);return;}
   if(result.destination!==projectTrashDestination(trash)){setError('The result could not be confirmed. Refresh Projects before trying again.');return;}
   // Full replacement clears the active project/rack client state. Never select
   // another project, rack, or user-provided destination after this operation.
   window.location.replace(result.destination);
  }catch{setError('Could not confirm the change. Refresh Projects before trying again.');}
  finally{busy.current=false;setPending(false);}
 }
 return <><Menu.Root><Menu.Trigger ref={trigger} disabled={pending} aria-label={`Actions for project ${project.name}`} title="Project actions" className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-xl text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"><svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg></Menu.Trigger><Menu.Portal><Menu.Positioner align="end" sideOffset={6} className="z-50"><Menu.Popup className="min-w-48 rounded-lg border border-border bg-card p-1 text-card-foreground shadow-lg"><Menu.Item className="cursor-pointer rounded-md px-3 py-2 text-sm outline-none data-highlighted:bg-muted" onClick={()=>{setValue('');setError('');setOpen(true);}}>{trashed?'Restore project…':'Delete project…'}</Menu.Item></Menu.Popup></Menu.Positioner></Menu.Portal></Menu.Root>
 <Dialog.Root open={open} onOpenChange={next=>{if(!busy.current){if(next)setOpen(true);else close();}}}><Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50"/><Dialog.Popup finalFocus={trigger} className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,30rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl"><Dialog.Title className="text-lg font-semibold">{trash?'Move project to Trash?':'Restore project?'}</Dialog.Title><Dialog.Description className="mt-2 break-words font-medium">{project.name}</Dialog.Description><ProjectConfirmation project={project} trash={trash} value={value} onValue={setValue} pending={pending} error={error} onSubmit={submit} onCancel={close}/></Dialog.Popup></Dialog.Portal></Dialog.Root></>;
}
