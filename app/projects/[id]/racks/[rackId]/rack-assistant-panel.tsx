'use client';
import Link from 'next/link';
import {useRef,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {MessageCircle,Send,RefreshCw} from 'lucide-react';
import {askRackAssistant} from './assistant-actions';
import type {AssistantTopic} from '@/lib/rack-assistant';

const topics:{topic:AssistantTopic;label:string}[]=[{topic:'balance',label:'Is my rack balanced?'},{topic:'failover',label:'What if a feed fails?'},{topic:'checks',label:'Explain pending checks'},{topic:'equipment',label:'Review consumption'},{topic:'setup',label:'Help me add equipment'}];
type Turn={question:string;text:string;checkedAt?:string;error?:boolean};
export function RackAssistantPanel({projectId,rackId,rackName,basePath,aiEnabled}:{projectId:string;rackId:string;rackName:string;basePath:string;aiEnabled:boolean}){
  const [turns,setTurns]=useState<Turn[]>([]),[question,setQuestion]=useState(''),[pending,start]=useTransition();
  const busy=useRef(false);const router=useRouter();
  function ask(label:string,topic?:AssistantTopic){
    if(busy.current)return;busy.current=true;
    start(async()=>{try{
      const result=await askRackAssistant(projectId,rackId,topic?{topic}:{question:label});
      setTurns(old=>[...old.slice(-9),{question:label,...('error' in result?{text:result.error,error:true}:result)}]);
      if(!topic)setQuestion('');
    }catch{setTurns(old=>[...old.slice(-9),{question:label,text:'The request could not complete. No changes were made. Try a guided topic again.',error:true}]);}finally{busy.current=false;}});
  }
  return <details className="mb-5 rounded-xl border border-primary/30 bg-card/80 p-4" id="guided-setup">
    <summary className="cursor-pointer text-primary"><span className="inline-flex items-center gap-2 font-semibold"><MessageCircle size={19}/>Guided setup · {rackName}</span></summary>
    <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">
      <div className="min-w-0"><p className="text-sm text-muted-foreground">What would you like to work on? I can explain this rack’s saved power plan or help prepare equipment for review. Nothing in this conversation changes your rack.</p>
        <div className="my-4 flex flex-wrap gap-2">{topics.map(t=><button key={t.topic} type="button" disabled={pending} onClick={()=>ask(t.label,t.topic)} className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm hover:border-primary disabled:opacity-50">{t.label}</button>)}</div>
        <div role="log" aria-label="Rack assistant conversation" aria-live="polite" aria-busy={pending} className="max-h-[28rem] space-y-4 overflow-y-auto">
          {turns.map((t,i)=><article key={i} className="rounded-lg border border-border p-4"><p className="mb-2 font-medium">{t.question}</p><p className={`whitespace-pre-wrap text-sm ${t.error?'text-amber-300':'text-muted-foreground'}`}>{t.text}</p>{t.checkedAt&&<p className="mt-3 text-xs text-muted-foreground">Saved rack data checked {new Date(t.checkedAt).toLocaleTimeString()}. Ask again after making changes.</p>}</article>)}
        </div>
        {pending&&<p role="status" className="mt-3 text-sm text-primary">Reading your request and current rack data…</p>}
        {aiEnabled?<form className="mt-4" onSubmit={e=>{e.preventDefault();if(question.trim())ask(question.trim());}}><label className="text-sm" htmlFor="rack-assistant-question">Ask about this rack</label><div className="mt-2 flex gap-2"><input id="rack-assistant-question" value={question} onChange={e=>setQuestion(e.target.value)} maxLength={2000} disabled={pending} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2" placeholder="How much load remains if feed A fails?"/><button disabled={pending||!question.trim()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"><Send size={16}/>Ask</button></div><p className="mt-2 text-xs text-muted-foreground">Only your typed question is sent to OpenAI for topic interpretation. Rack records stay in OneRack. Each question uses the configured AI allowance; topic buttons make no AI calls.</p></form>:<p className="mt-3 text-xs text-muted-foreground">AI free-text interpretation is paused. Guided topics and equipment drafts are available without AI calls.</p>}
      </div>
      <aside className="space-y-3 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0"><h3 className="font-semibold">Continue in the workspace</h3><Link href="/equipment/new#guided-equipment" className="block rounded-lg bg-primary px-4 py-3 text-center text-sm font-medium text-primary-foreground">Prepare equipment draft</Link><Link href={`${basePath}?tab=power`} className="block rounded-lg border border-border px-4 py-3 text-center text-sm">Open Power Calculator</Link><Link href={`${basePath}?tab=elevation`} className="block rounded-lg border border-border px-4 py-3 text-center text-sm">Open rack layout</Link><button type="button" disabled={pending} onClick={()=>{setTurns([]);router.refresh();}} className="inline-flex items-center gap-2 text-sm text-muted-foreground"><RefreshCw size={14}/>Clear conversation and refresh</button><p className="text-xs text-muted-foreground">Answers describe saved data at the time shown. Unsaved form edits are not included. This conversation clears when you leave the page.</p></aside>
    </div>
  </details>;
}
