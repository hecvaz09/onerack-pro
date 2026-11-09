import type {PWS_504P_1R_TEST} from '@/lib/psu-test-reference';

export function PsuTestReference({report}:{report:typeof PWS_504P_1R_TEST}){
 return <section className="mt-5 space-y-3" aria-label="PSU test reference">
  <h3 className="font-semibold">{report.model} · 80 PLUS test reference</h3>
  <p className="text-sm text-muted-foreground">One {report.ratedDcWatts} W DC-output PSU, tested at {report.testVoltage} V / {report.testFrequency} Hz on {report.testedAt}. Rated input: {report.minVoltage}–{report.maxVoltage} V, {report.ratedInputAmps} A, {report.frequencyHz} Hz. Confirm the installed PSU label matches this exact part.</p>
  <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border"><th className="p-2">PSU load</th><th className="p-2">AC input</th><th className="p-2">DC output</th><th className="p-2">Efficiency</th><th className="p-2">Power factor</th></tr></thead>
   <tbody>{report.points.map(p=><tr key={p.loadPercent} className="border-b border-border/50"><td className="p-2">{p.loadPercent}%</td><td className="p-2 whitespace-nowrap">{p.inputWatts} W</td><td className="p-2 whitespace-nowrap">{p.outputWatts} W</td><td className="p-2">{p.efficiencyPercent.toFixed(2)}%</td><td className="p-2">{p.powerFactor.toFixed(2)}</td></tr>)}</tbody>
  </table></div>
  <p className="text-sm text-muted-foreground">These are PSU bench measurements, not this server’s measured demand. Efficiency and power factor vary with load; the calculator’s selected demand and assumptions are unchanged. The 547 W test point is not an approved AC budget or cord-current limit. Fan power is excluded from efficiency calculations; the 10% point is informational and excluded from certification requirements.</p>
  <a href={report.source} target="_blank" rel="noreferrer" className="text-sm text-primary underline">80 PLUS report {report.reportId} ↗</a>
 </section>;
}
