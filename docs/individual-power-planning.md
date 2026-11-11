# Individual outlet assignments

Selecting one PSU and a free PDU outlet now checks that connection without requiring the whole-rack automatic allocator to succeed. An unconnected switch's missing demand does not prevent recording a server's outlet assignment.

The browser and server share `individualPowerReview`. The server reloads current rack data inside the existing mutation lock. Endpoint identity, occupancy, reservation, connector rules, documented voltage/PSU/cord limits and known outlet, branch, phase and total PDU overloads remain blocking. Every existing load remains in the electrical model; missing demand on another connected load makes the shared PDU's verification pending. Internal identifiers keep same-label devices' checks separate.

Missing PDU bank/outlet ratings, demand or PSU documentation allow **Save planning connection**, with an amber saved indicator and explicit pending checks. No electrical rating, demand or power factor is invented or saved by this operation. A failed write never changes the indicator. Clearing the saved connection turns it off. Existing planning notes remain a pending marker, even if documentation subsequently changes.

Whole-rack automatic balancing retains its required inputs and capacity checks. The twelve-input B300 chassis retains its completed-plan validation because partial chassis mappings are excluded from calculated totals. A partial B300 mapping on a shared PDU also prevents another device on that PDU from appearing fully verified.

Regression coverage exercises the actual React callbacks through the real server action with an isolated in-memory database adapter: selection, explicit planning save, double-click suppression, reload, independent PSU state and removal. Additional cases cover same-label devices, connected unknown loads, capacity limits, endpoint conflicts and unchanged automatic-plan blocking. These tests do not constitute live browser or production database verification.
