import {libraryReadiness} from '@/lib/library-readiness';
export function LibraryReadinessNotice({sku,category,raw}:{sku:string;category:string|null;raw:unknown}){
 const result=libraryReadiness(sku,category,raw);
 if(!result.issues.length)return null;
 return <details className="my-4 rounded-lg border border-border bg-card p-4" data-library-readiness>
  <summary className="cursor-pointer font-medium">{result.label} · review before reuse</summary>
  <p className="mt-3 text-sm text-muted-foreground">Keep unknown fields blank until the hardware is identified. This entry can still be saved as a reference.</p>
  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{result.issues.map(issue=><li key={issue}>{issue}</li>)}</ul>
 </details>;
}
