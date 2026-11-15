# Power cable routing

The existing `balanceFeeds` calculator still selects outlets bottom-up and
checks voltage, connectors, outlet/bank/input limits, phase balance and both
feed-loss cases. Electrical scores take precedence over routing. Among
electrically equal choices, it prefers the nearer mounted PDU rail.

Once those outlets are selected, `routePowerAssignments` matches **only new,
unfixed inputs on the same device** to the checked endpoints. The current load
model shares demand equally between inputs. This permutation changes no
outlet's device, watts, bank, phase or feed load, nor the device's A/B input
counts. The full resulting plan passes `analyzeFeeds` again before saving.
If per-input loads or compatibility become configurable, this permutation must
be constrained to equivalent inputs or replaced with per-input validation.

Routing uses the same rear input coordinates as the existing artwork and actual
PDU mounting, independent of feed labels and PSU numbering. This applies to
two- and four-PDU racks, including mixed A/B rail positions. Moving a PDU changes
the proposal revision. Existing saved wiring, including manual alternatives,
remains fixed. New proposals do not repair a crossed saved connection silently.

Distance matching is bounded to the calculator's maximum of twelve inputs
using a bit-mask dynamic program, not factorial enumeration. Original input
choices break equal-distance ties. B300 physical input identities and the
existing PDU-only assessment scope are preserved.

The review shows an exception when available checked endpoints/fixed wiring
require reaching the opposite side. Missing artwork/mounting, rotated side
pockets and reversed server faces retain electrical assignments with routing
explicitly unverified. The rule minimizes avoidable left/right crossings; it
does not certify a physical cable installation. Cable lengths, dressing,
vertical ordering within bundles, bend radii and service/airflow clearance
remain installation checks.

The selected cable highlight follows a chassis edge and side gutter using
current DOM geometry, including zoom/pan. It is a schematic suggested path.
It does not change the hardware artwork or indicate live electrical power.
