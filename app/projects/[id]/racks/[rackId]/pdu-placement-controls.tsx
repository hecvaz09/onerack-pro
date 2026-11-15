'use client';

import {useRef,useState,useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {availablePduPositions,pduLabel,movePduInDraft,swapPduSides,pairPduFeedsBySide,type PduPlacement,type PduPositionItem} from '@/lib/pdu-placement';
import type {RackConfig} from '@/lib/rack-config';
import {savePduPlacement} from './actions';
import styles from './pdu-placement.module.css';

export function PduPlacementControls({rackId,items,config,revision}:{rackId:string;items:PduPositionItem[];config:RackConfig;revision:string}) {
  const initial=items.map(({id,mounting})=>({id,mounting}));
  const [positions,setPositions]=useState<PduPlacement[]>(initial),[message,setMessage]=useState(''),[error,setError]=useState('');
  const [pending,startTransition]=useTransition(),saving=useRef(false),router=useRouter();
  const options=availablePduPositions(config),detailed=items.length===4,dirty=positions.some(p=>items.find(i=>i.id===p.id)?.mounting!==p.mounting);
  const visiblePositions=options.filter(o=>detailed||positions.some(p=>p.mounting===o.value));
  const tag=(p:PduPositionItem)=>pduLabel(p.feed,p.number,items.map(i=>i.feed));
  const change=(next:PduPlacement[])=>{setPositions(next);setError('');setMessage('Preview only — save positions to apply.');};
  const mirrored=swapPduSides(positions),canSwap=mirrored.every(p=>options.some(o=>o.value===p.mounting));
  const paired=pairPduFeedsBySide(items),canPair=paired?.every(p=>options.some(o=>o.value===p.mounting));
  if(items.length!==2&&items.length!==4)return null;
  return <details className={styles.panel}>
    <summary>Arrange PDUs <span>{detailed?'4 installed · Individual positions':'2 installed · Swap sides'}</span></summary>
    <div className={styles.content}>
      <p>Viewed from the rear. A/B feed assignments and saved cables stay with each PDU.</p>
      <fieldset disabled={pending}>
        <div className={styles.preview} aria-label="PDU position preview">
          {(['left','right'] as const).map(side=><section key={side}><h3>{side==='left'?'Left side':'Right side'}</h3><div className={styles.slots}>{visiblePositions.filter(o=>o.value.includes(side)).sort((a,b)=>side==='left'?b.value.localeCompare(a.value):a.value.localeCompare(b.value)).map(o=>{
            const item=items.find(i=>positions.some(p=>p.id===i.id&&p.mounting===o.value));
            return <div key={o.value} className={styles.slot} data-feed={item?.feed} data-position={o.value}>{detailed&&<small>{o.label.split(' · ')[1]}</small>}<strong>{item?tag(item):'Empty'}</strong><span>{item?.name||'Available position'}</span></div>;
          })}{!visiblePositions.some(o=>o.value.includes(side))&&<div className={styles.slot}><strong>Empty</strong></div>}</div></section>)}
        </div>
        <div className={styles.actions}><button type="button" disabled={!canSwap||pending} onClick={()=>change(mirrored)}>Swap left/right</button>
        {canPair&&<button type="button" onClick={()=>change(paired!)}>Pair A/B on each side</button>}</div>
        {canPair&&<p className={styles.hint}>A1 + B1 left; A2 + B2 right. This places both feeds beside the PSUs. Existing saved cables still need routing review.</p>}
        {detailed?<><div className={styles.rows}>{items.map(item=><label key={item.id}><span><strong>{tag(item)}</strong><small>{item.name}</small></span><select aria-label={`Position for ${tag(item)}`} value={positions.find(p=>p.id===item.id)?.mounting} onChange={e=>change(movePduInDraft(positions,item.id,e.target.value))}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></label>)}</div>
        <p className={styles.hint}>Choosing an occupied position swaps the two PDUs.</p></>:<p className={styles.hint}>Swap the two PDUs between the left and right sides, then save.</p>}
        <div className={styles.actions}><button type="button" className={styles.save} disabled={!dirty||pending} onClick={()=>{
          if(saving.current||!dirty)return;
          saving.current=true;setError('');setMessage('');
          startTransition(async()=>{
            try{const result=await savePduPlacement(rackId,positions,revision);if(result.ok){setMessage('PDU positions saved.');router.refresh();}else setError(result.error);}
            catch{setError('Could not save PDU positions. Try again.');}
            finally{saving.current=false;}
          });
        }}>{pending?'Saving…':'Save positions'}</button><button type="button" disabled={!dirty||pending} onClick={()=>{setPositions(initial);setError('');setMessage('Position changes discarded.');}}>Reset</button></div>
      </fieldset>
      {error?<p role="alert">{error}</p>:<p role="status">{message}</p>}
    </div>
  </details>;
}
