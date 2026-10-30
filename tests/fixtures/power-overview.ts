import type {FeedInputs} from '../../lib/feed-power';
import type {FeedEquipment} from '../../lib/feed-rack';

export function overviewFixture(){
 const supply=(feed:'A'|'B')=>({feed,confirmed:true,topology:'single-phase' as const,voltage:230,limitAmps:16,branches:{one:16},outlets:[1,2].map(n=>({n,connectors:['C13'],branch:'one',phase:'L1' as const,limitAmps:10}))});
 const equipment:FeedEquipment[]=[
  {id:'qa-pdu-a',name:'Synthetic PDU A',category:'pdu',mounting:'rear-right',rawData:{},details:{outlets:{}}},
  {id:'qa-pdu-b',name:'Synthetic PDU B',category:'pdu',mounting:'rear-left',rawData:{},details:{outlets:{}}},
  {id:'qa-device',name:'Synthetic system',model:'Synthetic model',category:'chassis',rawData:{powerLoad:{cords:2,minimumCords:1,connector:'C13',minVoltage:200,maxVoltage:240,cordLimitAmps:10,psuAcCapacity:5000}},details:{}},
 ];
 const saved:FeedInputs={headroomPercent:20,supplies:{'qa-pdu-a':supply('A'),'qa-pdu-b':supply('B')},budgets:{'qa-device':{watts:1250,pf:1}}};
 return {equipment,saved};
}
