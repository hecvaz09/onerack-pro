import type {SystemComponent,SystemSpecs} from './system-specs.ts';
export function reviewedComponentField(specs:SystemSpecs,component:SystemComponent,key:string){
 const value=component.attributes[key];
 if(!value)return undefined;
 if(specs.status==='verified')return value;
 const review=component.fieldReviews?.[key];
 return review&&review.value===value&&review.model===component.model&&review.manufacturer===component.manufacturer?value:undefined;
}
export function reviewComponentFields(component:SystemComponent,source:string,date:string):SystemComponent{
 if(new URL(source).protocol!=='https:')throw new Error('Use an HTTPS manufacturer reference.');
 return {...component,fieldReviews:Object.fromEntries(Object.entries(component.attributes).filter(([,value])=>value.trim()).map(([key,value])=>[key,{value,model:component.model,manufacturer:component.manufacturer,source,reviewedAt:date}]))};
}
