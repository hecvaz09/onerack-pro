/* eslint-disable @next/next/no-img-element -- Local SVG schematics are standalone downloadable assets. */
import {catalogProfile,artworkUrl,catalogReferenceDimensions} from '@/lib/catalog-artwork';
import {networkPorts} from '@/lib/network-ports';
import type {SystemSpecs} from '@/lib/system-specs';
import {GrandTwinPanel} from '@/app/projects/[id]/racks/[rackId]/grandtwin-panel';
export function CatalogVisuals({sku,model,specs}:{sku:string;model:string;specs?:SystemSpecs}){
 const profile=catalogProfile(sku,model);if(!profile)return null;
 const test=sku.startsWith('TEST-');
 return <section className="spec-section"><div className="flex flex-wrap items-center justify-between gap-3"><h2>Front & rear reference</h2><span className="text-xs text-muted-foreground">{test?'Synthetic configuration · base-model illustration':profile.drawing.kind==='unknown'?'Exact model needed':'Schematic · not to scale'}</span></div>
 <div className="catalog-reference-stack mt-4 grid grid-cols-1 gap-4">{(['front','rear'] as const).map(face=>{
  const dimensions=catalogReferenceDimensions(profile,face);
  return <figure key={face} className="min-w-0 rounded-lg border border-border bg-background/60 p-4"><figcaption className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm"><strong className="capitalize">{face}</strong><span className="flex gap-4"><a href={artworkUrl(profile,face,sku)} target="_blank" rel="noreferrer" className="text-primary underline">Open full size ↗</a><a href={artworkUrl(profile,face,sku)} download className="text-primary underline">Download SVG</a></span></figcaption>{profile.key==='smc-grandtwin'?<div className="relative w-full" style={{aspectRatio:'5 / 1'}}><GrandTwinPanel face={face} ports={networkPorts({systemSpecs:specs})} connected={[]} deviceId="catalog-reference"/></div>:<img src={artworkUrl(profile,face,sku)} alt={`${profile.label} ${face} schematic`} {...dimensions} style={dimensions?{width:'100%',maxWidth:dimensions.width,height:'auto',aspectRatio:`${dimensions.width} / ${dimensions.height}`,marginInline:'auto'}:undefined} className="block h-auto w-full object-contain"/>}</figure>;
 })}</div>
 <p className="mt-3 text-sm">{profile.drawing.audit}</p>
 {profile.key==='smc-b3008u'&&<p role="note" className="mt-3 text-sm text-amber-300">Power mapping needs review: each PSU has two AC inputs. The current visual power mapper does not validate this paired-input topology; the rear inputs are reference artwork only.</p>}
 <p className="mt-3 text-xs text-muted-foreground">Bay outlines show chassis capacity, not installed parts. Simplified drawings are reference illustrations; confirm physical connector positions against the manufacturer drawing before cable routing.{test?' Test ports and power inputs remain synthetic.':''}</p>
 {(profile.drawing.reference||profile.source)&&<a href={profile.drawing.reference||profile.source} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-primary underline">Manufacturer layout reference ↗</a>}
 {!!profile.unknowns.length&&<details className="mt-4"><summary className="cursor-pointer text-sm text-amber-300">{profile.unknowns.length} configuration details still needed</summary><ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">{profile.unknowns.map(q=><li key={q}>{q}</li>)}</ul></details>}
 </section>;
}
