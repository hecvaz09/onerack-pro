# Power design and site verification

Power Layout can calculate and save an outlet plan while the facility supply is
unknown. It uses saved whole-system AC demand, power factor, A/B assignments and
documented Library or saved PDU ratings. An unconfirmed supply is a disclosure,
not a required design input.

The main Calculate connections / Save planning layout flow defers only the site
confirmation check and the existing downstream equipment/cable verification
notes. Missing PDU ratings, missing demand or power factor, incompatible voltage,
duplicate assignments, reserved outlets, and known outlet, branch, line and
modeled feed-loss overloads still block a passing plan. Incomplete B300 chassis
input mapping retains its pending status.

Saved PSU indicators are recalculated from the current plan. Green means the
saved assignment passes design checks; it does not indicate live power, a verified
facility circuit or a completed physical installation. A completed plan with
unconfirmed supplies displays its saved connection count and “site verification
pending.” Existing assignments do not need to be saved again.

The site notice lists planned supply requirements separately. It does not change
`confirmed` flags. Actual site voltage, topology, usable upstream limits and feed
independence remain subject to site verification. The strict electrical analyzer
and advanced verified-cable calculation retain their site-confirmation checks.

This is a source-only release: no schema change, migration, Library update,
installation edit, or connection rewrite is required.

Coverage includes Calculate/Save interactions with unknown site power, server
save and fresh-read status, unchanged confirmation flags, full versus partial
B300 input mapping, and rejection of missing ratings and known limit violations.
