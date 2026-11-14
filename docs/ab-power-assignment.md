# Automatic A/B outlet assignments

The existing Power Calculator (`balanceFeeds`) processes equipment by ascending
rack unit, then by stable equipment ID. It retains saved connections. The normal
Calculate / Review / Save workflow proposes only missing connections; installing
this change does not rearrange an existing rack plan.

For each device, the calculator considers supported A/B input distributions that
respect fixed connections and the minimum surviving input count. PSU numbers are
endpoint identities, not feed requirements. An electrical tie prefers A for the
first unassigned input and alternates toward the less populated side. Three or
more inputs can use an unequal distribution when the calculated limits permit it.

Each candidate uses the existing electrical model to check normal operation and
loss of either feed, including known fixed loads. Voltage compatibility, outlet
and cord ratings, PSU capacity, protected banks, phase currents, and neutral
limits remain enforced. Feed-loss demand is shared by the actual number of inputs
planned on the surviving feed. Missing specifications retain their existing
planning limitations; they are not invented or marked verified.

Among suitable candidates, the calculator minimizes peak normalized phase
current, then total squared normalized phase and branch currents. Electrical
scores take priority over outlet numbers. Ties use the lowest available outlet
number and stable PDU order. Equivalent outlets are evaluated once per PDU,
phase, bank and current rating. This is a deterministic greedy planner, not a
claim of a globally optimal solution. The completed plan is checked again by
`analyzeFeeds` before it can be saved.

The A/B assignment sequences and progress counts are independent. The existing
C13 / reserved-switch-outlet policy remains a constraint when selected. A review
disclosure explains skipped outlet numbers, including compatibility, capacity,
policy and balancing reasons. Equipment order does not imply physical outlet
position; the calculator uses each model's recorded outlet and phase mapping.

A single-PSU device can receive the best available planned outlet, even if only
one feed is modeled. It remains amber and cannot pass independent A/B validation.
Its loss of power is shown explicitly in the affected feed-failure scenario.
This is a hardware limitation, not a missing setting to check off. Other devices
must still pass their own applicable redundancy and capacity checks.

Modeled A/B feed assignments do not establish actual upstream independence.
The separate site-verification state remains unchanged, including for a design
whose modeled redundancy and capacity checks pass.
