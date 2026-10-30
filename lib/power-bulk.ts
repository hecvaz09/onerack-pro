import type {PowerBudget, PowerEquipment} from './px3-power';

export function matchingPowerEquipment(equipment:PowerEquipment[], budgets:Record<string,PowerBudget>, source:PowerEquipment){
  if(!source.model.trim()||source.category==='pdu'||budgets[source.id]?.passive)return [];
  return equipment.filter(d=>d.model===source.model&&d.category===source.category&&!budgets[d.id]?.passive);
}

// Copy demand only: each installed system retains its own connection settings.
export function applyMatchingWatts(equipment:PowerEquipment[], budgets:Record<string,PowerBudget>, source:PowerEquipment){
  const watts=budgets[source.id]?.watts;
  if(watts===undefined||!Number.isFinite(watts)||watts<=0||watts>100000)return budgets;
  const next={...budgets};
  for(const d of matchingPowerEquipment(equipment,budgets,source)){
    next[d.id]={...(budgets[d.id]??{connector:'C13',passive:false,confirmed:false,source:''}),watts};
  }
  return next;
}
