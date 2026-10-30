import type {RackGridDevice} from './physical-rack-grid';

export function NodeConnections({device,nodeName}:{device:RackGridDevice;nodeName:string}){
 const node=nodeName.replace(/^Node\s*/i,'');
 const ports=(device.networkPorts||[]).filter(p=>p.node===node);
 return <section className="my-4 rounded-lg border border-border p-3" aria-label={`${nodeName} connections`}><h3 className="mb-2 font-semibold">Connections</h3>{!ports.length?<p className="text-sm text-muted-foreground">No network ports configured for this node.</p>:<ul className="space-y-2">{ports.map(port=>{const used=device.connectedPorts?.includes(port.id);return <li key={port.id} className="flex items-center justify-between gap-3 text-sm"><span>{port.position==='mgmt'?'MGMT':`AIOM${port.aiom} · P${port.number}`} <small className={used?'text-primary':'text-muted-foreground'}>{used?'Connected':'Available'}</small></span>{device.networkHref&&<a className="text-primary underline" href={`${device.networkHref}&fromDeviceId=${encodeURIComponent(device.id)}&fromPort=${encodeURIComponent(port.id)}`}>{used?'View connection':'Connect'}</a>}</li>;})}</ul>}</section>;
}
