export const SMC_CX8_IB_PROFILE = {
  id:'as-8126gs-tnmr-2cx8-ib',
  model:'AS-8126GS-TNMR',
  status:'proposed',
  onboard:[
    {id:'bmc',name:'Management / BMC',protocol:'Ethernet',speed:'1 Gb/s',connector:'RJ45'},
    {id:'lan1',name:'LAN 1',protocol:'Ethernet',speed:'10 Gb/s',connector:'RJ45'},
    {id:'lan2',name:'LAN 2',protocol:'Ethernet',speed:'10 Gb/s',connector:'RJ45'},
  ],
  adapters:[
    {id:'cx8-1',name:'ConnectX-8 · Adapter 1',protocol:'InfiniBand'},
    {id:'cx8-2',name:'ConnectX-8 · Adapter 2',protocol:'InfiniBand'},
  ],
  source:'https://www.supermicro.com/en/products/system/gpu/8u/as-8126gs-tnmr',
} as const;

export function readNetworkProfiles(configuration:unknown):Record<string,string>{
  if(!configuration||typeof configuration!=='object')return {};
  const raw=(configuration as Record<string,unknown>).networkProfiles;
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return {};
  return Object.fromEntries(Object.entries(raw).filter(([,value])=>value===SMC_CX8_IB_PROFILE.id));
}
