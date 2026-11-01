import test from 'node:test';
import assert from 'node:assert/strict';
import { actionHarness } from './helpers/action-harness';
import { b300PowerFixture } from './fixtures/b300-power';
import { balanceFeeds, feedRevision } from '../lib/feed-balance';
import { withOutletAssignment } from '../lib/equipment-details';

function fixture() {
  const f = b300PowerFixture();
  for (const d of f.rack.devices.filter(d => d.catalogDevice.category === 'pdu')) {
    d.details = {
      ...d.details as object,
      nodes: { A: { hostname: 'Synthetic', ip: '', serial: '', notes: 'Keep', status: 'active', futureNode: { keep: true } } },
      outlets: Object.fromEntries([1, 6, 12].map(n => [n, { deviceId: '', notes: 'Spare note', futureAssignment: { keep: n } }])),
    };
  }
  return f;
}
function check(h: Awaited<ReturnType<typeof actionHarness>>, id: string) {
  const rack = h.snapshot() as ReturnType<typeof fixture>['rack'];
  const raw = rack.devices.find(d => d.id === id)!.details as { nodes: { A: { futureNode: unknown } }; outlets: Record<string, { futureAssignment: unknown }> };
  assert.deepEqual(raw.nodes.A.futureNode, { keep: true });
  assert.deepEqual(raw.outlets['12'].futureAssignment, { keep: 12 });
}
function equipment(rack: ReturnType<typeof fixture>['rack']) {
  return rack.devices.map(d => ({ id: d.id, name: `${d.label} \u00b7 U${d.startRU}`, sku: d.catalogDevice.sku, model: d.catalogDevice.model, startRU: d.startRU, mounting: d.mounting, category: d.catalogDevice.category, rawData: d.catalogDevice.rawData, details: d.details }));
}

test('visual connect and clear preserve unrelated raw outlet and node metadata', async () => {
  const f = fixture(), h = await actionHarness({ rack: f.rack }), c = balanceFeeds(f.equipment, f.inputs).assignments[0];
  assert.equal((await h.visual.connectVisualPower(f.rack.id, c.pduId, c.outlet, 'b300', c.inlet)).ok, true);
  check(h, c.pduId);
  assert.equal((await h.visual.disconnectVisualPower(f.rack.id, c.pduId, c.outlet, 'b300', c.inlet)).ok, true);
  check(h, c.pduId);
});
test('manual B300 save preserves raw metadata including fields on the selected outlet', async () => {
  const f = fixture(), h = await actionHarness({ rack: f.rack }), c = balanceFeeds(f.equipment, f.inputs).assignments[11];
  assert.equal((await h.actions.saveOutlet(f.rack.id, c.pduId, c.outlet, 'b300', 'Updated note', 12)).ok, true);
  check(h, c.pduId);
  const d = (h.snapshot() as typeof f.rack).devices.find(d => d.id === c.pduId)!.details as { outlets: Record<string, { futureAssignment: unknown }> };
  assert.deepEqual(d.outlets[c.outlet].futureAssignment, { keep: c.outlet });
});
test('bulk shared apply preserves unknown outlet and node metadata across repeated applications', async () => {
  const f = fixture(), h = await actionHarness({ rack: f.rack });
  for (let attempt = 0; attempt < 2; attempt++) {
    const rack = h.snapshot() as typeof f.rack;
    const result = await h.feed.applyFeedBalance(f.rack.id, feedRevision(equipment(rack), f.inputs));
    assert.ok('ok' in result && result.ok);
    check(h, 'pdu-a');
    check(h, 'pdu-b');
    const d = (h.snapshot() as typeof f.rack).devices.find(d => d.id === 'pdu-a')!.details as { outlets: Record<string, { notes: string }> };
    assert.equal(d.outlets['1'].notes, 'Spare note');
  }
});
test('replacing an outlet binding preserves future metadata without leaking prior B300 identity or lock', () => {
  const raw = { deviceId: 'old', inlet: 12, locked: true, inputIdentity: 'b300-module-input-v1', notes: 'Old', futureAssignment: { keep: true } };
  const replacement = withOutletAssignment(raw, { deviceId: 'legacy', notes: 'New', inlet: 2 });
  assert.deepEqual(replacement, { deviceId: 'legacy', inlet: 2, notes: 'New', futureAssignment: { keep: true } });
  assert.equal(raw.inputIdentity, 'b300-module-input-v1');
  assert.equal(raw.deviceId, 'old');
});
