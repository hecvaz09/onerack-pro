import Link from 'next/link';
import {connection} from 'next/server';
import type {Prisma} from '@/generated/prisma/client';
import {prisma} from '@/lib/prisma';
import {readSystemSpecs} from '@/lib/system-specs';

type Query=Record<string,string|string[]|undefined>;
const sections=[['all','All equipment'],['switches','Switches'],['1u','1U systems'],['2u','2U systems'],['4u','4U systems'],['8u','8U systems'],['pdu','PDUs'],['accessories','Accessories']] as const;
const field='h-10 w-full rounded-lg border border-border bg-background px-3 text-sm';
export default async function EquipmentLibrary({searchParams}:{searchParams:Promise<Query>}){
  await connection();
  const params=await searchParams;
  const value=(key:string)=>typeof params[key]==='string'?params[key] as string:'';
  const section=sections.some(([key])=>key===value('section'))?value('section'):'all';
  const sectionWhere:Prisma.CatalogDeviceWhereInput=section==='switches'?{category:'switch'}:section==='pdu'?{category:'pdu'}:section==='accessories'?{category:'accessory'}:/^[1248]u$/.test(section)?{heightRU:Number(section.slice(0,-1)),category:{in:['chassis','server']}}:{};
  const q=value('q').trim(),vendor=value('vendor'),category=value('category'),usage=value('usage');
  const sort=['model','vendor','installed'].includes(value('sort'))?value('sort'):'vendor';
  const pageSize=[25,50,100].includes(Number(value('size')))?Number(value('size')):25;
  const requestedPage=Math.max(1,Math.min(1000000,Math.floor(Number(value('page')))||1));
  const where:Prisma.CatalogDeviceWhereInput={
    AND:[sectionWhere],
    ...(q?{OR:[{model:{contains:q,mode:'insensitive'}},{vendor:{contains:q,mode:'insensitive'}},{sku:{contains:q,mode:'insensitive'}}]}:{}),
    ...(vendor?{vendor}:{}),...(category?{category}:{}),
    ...(usage==='installed'?{instances:{some:{}}}:usage==='unused'?{instances:{none:{}}}:{}),
  };
  const [total,matched,vendors,categories,groups]=await Promise.all([
    prisma.catalogDevice.count(),prisma.catalogDevice.count({where}),
    prisma.catalogDevice.findMany({distinct:['vendor'],select:{vendor:true},orderBy:{vendor:'asc'}}),
    prisma.catalogDevice.groupBy({by:['category'],_count:{_all:true},orderBy:{category:'asc'}}),
    prisma.catalogDevice.groupBy({by:['category','heightRU'],_count:{_all:true}}),
  ]);
  const pages=Math.max(1,Math.ceil(matched/pageSize)),page=Math.min(requestedPage,pages);
  const orderBy:Prisma.CatalogDeviceOrderByWithRelationInput[]=sort==='installed'?[{instances:{_count:'desc'}},{model:'asc'},{id:'asc'}]:sort==='model'?[{model:'asc'},{vendor:'asc'},{id:'asc'}]:[{vendor:'asc'},{model:'asc'},{id:'asc'}];
  const devices=await prisma.catalogDevice.findMany({where,orderBy,skip:(page-1)*pageSize,take:pageSize,include:{_count:{select:{instances:true}}}});
  function href(changes:Record<string,string>){const query=new URLSearchParams({q,vendor,category,usage,sort,section,size:String(pageSize),...changes});for(const [key,v] of [...query])if(!v)query.delete(key);return `/equipment?${query}`;}
  const filtered=!!(q||vendor||category||usage);
  function sectionCount(key:string){return key==='all'?total:groups.filter(g=>key==='switches'?g.category==='switch':key==='pdu'?g.category==='pdu':key==='accessories'?g.category==='accessory':['chassis','server'].includes(g.category||'')&&g.heightRU===Number(key.slice(0,-1))).reduce((sum,g)=>sum+g._count._all,0);}
  return <main className="workspace-page equipment-library">
    <Link href="/projects" className="text-sm text-muted-foreground hover:text-foreground">← Projects</Link>
    <header className="my-6 flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-3xl font-semibold tracking-tight">Equipment library <span className="ml-2 align-middle text-base font-normal text-muted-foreground">{total} configurations</span></h1><p className="mt-2 text-sm text-muted-foreground">Define once. Reuse across every project and rack.</p></div>
      <div className="flex flex-wrap gap-3"><Link href="/equipment/new#ai-research" className="rounded-lg border border-primary/40 px-4 py-2.5 text-sm text-primary">Add with AI</Link><Link href="/equipment/import" className="rounded-lg border border-border px-4 py-2.5 text-sm hover:bg-muted">Import BOM</Link><Link href="/equipment/new" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">+ Add equipment</Link></div>
    </header>
    <nav aria-label="Equipment sections" className="mb-4 flex flex-wrap gap-2">{sections.map(([key,label])=><Link key={key} href={href({section:key,page:'1',category:''})} aria-current={section===key?'page':undefined} className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm ${section===key?'border-primary/40 bg-primary/10 font-semibold text-primary':'border-border bg-card/60 text-muted-foreground hover:text-foreground hover:bg-muted'}`}><span>{label}</span><span className="text-xs tabular-nums opacity-75">{sectionCount(key)}</span></Link>)}</nav>
    <section aria-label="Catalog filters" className="rounded-t-xl border border-border bg-card p-4">
      <form key={[q,vendor,category,usage,section].join("|")} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(220px,2fr)_repeat(3,minmax(130px,1fr))_auto]">
        <label className="space-y-1.5 text-xs font-medium text-muted-foreground"><span>Search catalog</span><input name="q" aria-label="Search equipment library" placeholder="Manufacturer, model or SKU…" defaultValue={q} className={field}/></label>
        <label className="space-y-1.5 text-xs font-medium text-muted-foreground"><span>Manufacturer</span><select name="vendor" defaultValue={vendor} className={field}><option value="">All manufacturers</option>{vendors.map(v=><option key={v.vendor}>{v.vendor}</option>)}</select></label>
        <label className="space-y-1.5 text-xs font-medium text-muted-foreground"><span>Equipment type</span><select name="category" defaultValue={category} className={field}><option value="">All types</option>{categories.filter(c=>c.category).map(c=><option key={c.category} value={c.category!}>{c.category} ({c._count._all})</option>)}</select></label>
        <label className="space-y-1.5 text-xs font-medium text-muted-foreground"><span>Usage</span><select name="usage" defaultValue={usage} className={field}><option value="">All configurations</option><option value="installed">Installed in racks</option><option value="unused">Not installed</option></select></label>
        <input type="hidden" name="section" value={section}/><input type="hidden" name="sort" value={sort}/><input type="hidden" name="size" value={pageSize}/>
        <button className="h-10 rounded-lg border border-border px-5 text-sm font-medium hover:bg-muted">Apply filters</button>
      </form>
    </section>
    <div className="flex flex-wrap items-center justify-between gap-3 border-x border-border bg-card px-4 py-3">
      <div className="flex items-center gap-3 text-sm"><span className="text-muted-foreground">{matched?`${(page-1)*pageSize+1}–${Math.min(page*pageSize,matched)} of ${matched}`:'0'} configurations{filtered?' matching filters':''}</span>{filtered&&<Link href={href({q:"",vendor:"",category:"",usage:"",page:"1"})} className="text-primary underline underline-offset-4">Clear filters</Link>}</div>
      <nav aria-label="Sort equipment" className="flex flex-wrap items-center gap-1 text-xs"><span className="mr-2 text-muted-foreground">Sort by</span>{[['vendor','Manufacturer'],['model','Model'],['installed','Most installed']].map(([key,label])=><Link key={key} href={href({sort:key,page:'1'})} aria-current={sort===key?'page':undefined} className={`rounded-md px-3 py-1.5 ${sort===key?'bg-primary/10 font-medium text-primary':'text-muted-foreground hover:bg-muted'}`}>{label}</Link>)}</nav>
    </div>
    <div className="max-h-[65vh] overflow-auto border border-border" role="region" aria-label="Equipment inventory" tabIndex={0}>
      <table className="w-full min-w-[900px] border-collapse text-left text-sm">
        <caption className="sr-only">Equipment configurations, specifications and usage across all racks</caption>
        <thead className="sticky top-0 z-10 bg-card text-xs text-muted-foreground"><tr>{['Model / configuration','Manufacturer','Type','Size','Specifications','Installed','Actions'].map(h=><th scope="col" key={h} className="border-b border-border px-4 py-3 font-medium">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-border bg-card/70">{devices.map(d=>{const specs=readSystemSpecs(d.rawData),reviewed=specs.status==='verified';return <tr key={d.id} className="group hover:bg-primary/5 focus-within:bg-primary/5">
          <th scope="row" className="max-w-[430px] px-4 py-3 font-normal"><Link href={`/equipment/${d.id}`} className="font-semibold text-foreground hover:text-primary hover:underline">{d.model}</Link><p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{d.sku||'No SKU'}</p></th>
          <td className="px-4 py-3">{d.vendor}</td><td className="px-4 py-3 capitalize text-muted-foreground">{d.category||'Uncategorized'}</td><td className="whitespace-nowrap px-4 py-3 tabular-nums">{d.heightRU===0?(d.category==='pdu'?'0U / rail':'0U'):`${d.heightRU}U`}</td>
          <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs ${reviewed?'text-primary':'text-muted-foreground'}`}><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${reviewed?'bg-primary':'bg-muted-foreground'}`}/>{reviewed?'Reviewed':'Draft'}</span><p className="mt-1 whitespace-nowrap text-xs text-muted-foreground">{specs.components.length} component groups</p></td>
          <td className="px-4 py-3 tabular-nums"><span className={d._count.instances?'font-semibold':'text-muted-foreground'}>{d._count.instances}</span><span className="ml-1.5 text-xs text-muted-foreground">{d._count.instances===1?'system':'systems'}</span></td>
          <td className="px-4 py-3"><div className="flex gap-4"><Link aria-label={`Edit ${d.model}`} href={`/equipment/${d.id}`} className="text-primary hover:underline">Edit</Link><Link aria-label={`Research ${d.model}`} href={`/equipment/${d.id}#ai-research`} className="text-primary hover:underline">AI assistant</Link><Link aria-label={`Duplicate ${d.model}`} href={`/equipment/new?copy=${d.id}`} className="text-muted-foreground hover:text-foreground hover:underline">Duplicate</Link></div></td>
        </tr>;})}</tbody>
      </table>
      {!devices.length&&<div className="p-12 text-center"><h2 className="font-semibold">{filtered?'No matching equipment':'Your equipment library is empty'}</h2><p className="mt-2 text-sm text-muted-foreground">{filtered?'Try a broader search or clear the filters.':'Add a configuration or import a BOM to get started.'}</p></div>}
    </div>
    <footer className="flex flex-wrap items-center justify-between gap-3 rounded-b-xl border border-t-0 border-border bg-card px-4 py-3 text-sm">
      <nav aria-label="Rows per page" className="flex items-center gap-2"><span className="mr-1 text-xs text-muted-foreground">Rows per page</span>{[25,50,100].map(size=><Link key={size} href={href({size:String(size),page:'1'})} aria-current={pageSize===size?'page':undefined} className={`rounded px-2 py-1 ${pageSize===size?'bg-primary/10 font-medium text-primary':'text-muted-foreground hover:bg-muted'}`}>{size}</Link>)}</nav>
      <nav aria-label="Catalog pages" className="flex items-center gap-4">{page>1?<Link href={href({page:String(page-1)})} className="hover:text-primary">← Previous</Link>:<span className="text-muted-foreground/50">← Previous</span>}<span className="text-xs text-muted-foreground">Page {page} of {pages}</span>{page<pages?<Link href={href({page:String(page+1)})} className="hover:text-primary">Next →</Link>:<span className="text-muted-foreground/50">Next →</span>}</nav>
    </footer>
  </main>;
}

