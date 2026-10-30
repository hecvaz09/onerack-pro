import {catalogInputError,type CatalogInput} from './system-specs.ts';
export type GuidedEquipmentAnswers={vendor:string;model:string;sku:string;category:string;heightRU:string;psuModel:string;psuQuantity:string};
export function prepareGuidedEquipment(current:CatalogInput,a:GuidedEquipmentAnswers):CatalogInput{
  if(!a.heightRU.trim())throw Error('Enter the confirmed rack height; it cannot be inferred from the model name.');
  const proposal=structuredClone(current);
  Object.assign(proposal,{vendor:a.vendor.trim(),model:a.model.trim(),sku:a.sku.trim(),category:a.category,heightRU:Number(a.heightRU)});
  proposal.specs.status='draft';
  if(a.psuModel.trim()||a.psuQuantity.trim()){
    if(!a.psuModel.trim()||!/^\d+$/.test(a.psuQuantity)||Number(a.psuQuantity)<1||Number(a.psuQuantity)>6)throw Error('Enter an exact PSU model and quantity (1–6), or leave both blank.');
    const matching=proposal.specs.components.find(c=>c.kind==='psu'&&c.model.toLowerCase()===a.psuModel.trim().toLowerCase());
    if(matching){if(matching.quantity!==Number(a.psuQuantity))throw Error('This PSU already has a different quantity in the form. Resolve it in the component editor.');}
    else proposal.specs.components.push({id:`guided-psu-${proposal.specs.components.length}`,kind:'psu',manufacturer:'',model:a.psuModel.trim(),quantity:Number(a.psuQuantity),attributes:{},notes:'Installed model and quantity entered by the user. Electrical specifications pending.'});
  }
  const error=catalogInputError(proposal);if(error)throw Error(error);
  return proposal;
}
