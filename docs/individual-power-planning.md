# Individual outlet assignments

Selecting one PSU and a free PDU outlet now checks that connection without requiring the whole-rack automatic allocator to succeed. An unconnected switch's missing demand does not prevent recording a server's outlet assignment.

The browser and server share `individualPowerReview`. The server reloads current rack data inside the existing mutation lock. Endpoint identity, occupancy, reservation, connector rules, documented voltage/PSU/cord limits and known outlet, branch, phase and total PDU overloads remain blocking. Every existing load remains in the electrical model; missing demand on another connected load makes the shared PDU's verification pending. Internal identifiers keep same-label devices' checks separate.

Missing PDU bank/outlet ratings, demand or PSU documentation allow **Save planning connection**. No electrical rating, demand or power factor is invented or saved by this operation. A failed write never changes the indicator. Clearing the saved connection turns it off.

Saved indicators are recomputed from current data. Historical `Planning draft:` notes are preserved as user data and do not decide the color. Green means a saved **outlet plan** passes current PDU and outlet checks using entered demand, including any explicitly recorded estimates. It does not approve hardware installation or indicate live power. Missing cable/PSU capacity documentation and estimate assumptions remain visible in a separate disclosure. Missing watts/PF, voltage range, PDU ratings/mapping, unresolved feed settings, unknown connected load or incomplete B300 loading keep the indicator amber. Known failures remain red, including voltage, connector, cord/PSU capacity and PDU/outlet/bank overloads.

Selected and hovered saved connections use the same status for their line and highlight as their PSU indicator. Unrelated missing data that pauses the automatic allocator does not recolor a saved connection. The save actions and full electrical analysis retain their existing checks and explicit planning-save behavior.

Whole-rack automatic balancing retains its required inputs and capacity checks. The twelve-input B300 chassis retains its completed-plan validation because partial chassis mappings are excluded from calculated totals. A partial B300 mapping on a shared PDU also prevents another device on that PDU from appearing fully verified.

Regression coverage exercises the actual React callbacks through the real server action with an isolated in-memory database adapter: selection, explicit planning save, double-click suppression, reload, independent PSU state and removal. Additional cases cover same-label devices, connected unknown loads, capacity limits, endpoint conflicts and unchanged automatic-plan blocking. These tests do not constitute live browser or production database verification.

## Capacity review

A selected connection that exceeds a known PDU input, bank or neutral limit opens a capacity review instead of the missing-settings workflow. The review reads the existing calculator's current and projected scenario totals by PDU ID. It compares normal operation and both feed-loss cases, shows the amount over the usable limit, and lists the whole-system demand/PF values for devices assigned to the selected PDU. Review demand opens the exact device's existing watts field without editing or saving it. Unsaved settings still use the existing save-first workflow.

The input limit, bank limits, saved demand and server-side save validation are unchanged. Moving to another outlet on the same PDU cannot resolve an input overload. Bank overloads are labelled separately. Three-phase input comparisons use the highest loaded line; offline scenarios are explicitly labelled. The list of assigned devices is not a sum of their contributions: a device's demand is shared across its surviving cords, and incomplete B300 mappings are excluded by the existing model and disclosed.

The regression fixture reproduces eight dual-connected systems at 556 W / PF 0.9 and a proposed ninth system on a 208 V, 24 A PDU. Normal selected-PDU loading rises from 11.88 A to 14.85 A; the opposite-feed-loss loading rises from 23.76 A to 26.73 A. The ninth connection remains blocked, including an explicit planning save. This is a calculated capacity constraint, not a missing Library value or a live electrical reading.
