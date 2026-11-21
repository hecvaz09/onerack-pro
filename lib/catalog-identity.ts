// Configuration SKUs may change without changing the physical base model.
// This reference is established from a saved Library record, never a name guess.
export function catalogBaseSku(sku:string,raw?:unknown){
 const data=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw as Record<string,unknown>:{};
 const reference=data.catalogReference&&typeof data.catalogReference==='object'&&!Array.isArray(data.catalogReference)?data.catalogReference as Record<string,unknown>:{};
 return typeof reference.baseSku==='string'&&reference.baseSku.trim()?reference.baseSku:sku;
}
