# Device onboarding template

Use the same checklist in **Equipment Library → Add equipment** for every new model or build variant. Existing entries have a collapsed **Device setup checklist**. An unfinished configuration can be saved as a draft; checklist completion is separate from installation verification.

| Step | Record once in the Library | Keep explicit when unknown |
| --- | --- | --- |
| Identity | Manufacturer, exact model/configuration SKU, category, rack height | Optional parts and reference-only placeholders |
| Source | Manufacturer datasheet/manual URL; field-specific review links | Conflicting documents and installed FRU differences |
| Power | PSU quantity and physical AC inputs, applicable input voltage, redundancy, equipment inlet; PDU topology, outlet types/ratings, protected banks and phase mapping | Installed cord rating, per-PSU AC capacity, site supply and conditional output derating |
| Network | Onboard/management ports, exact installed adapters, connector, protocol and supported speeds, node/slot placement | Optional empty slots, selected link speed, optics, firmware and breakout mode |
| Artwork | Exact-model front/rear reference, correct footprint and readable labels | Missing artwork must stay explicit; never substitute another model |

For a known server or switch, an empty form can load its existing reference template. Templates remain draft and do not select a link speed. For an existing PDU, use **Duplicate** to retain the complete electrical outlet/bank profile. Descriptive text in Additional specifications does not create calculator rules.

For an optional expansion position, record an **Other component** until an adapter is actually identified. For an installed card, add a network-interface row with its exact identity. A base chassis drawing does not prove an optional card is installed. Shared-power nodes belong to their parent chassis and must not be assigned fictional independent PSUs.

Whole-device AC demand and power factor belong to installed-device measurements. Leave missing watts and PF blank until measured. Preserve already-saved budgets and their provenance. DC PSU output, nameplate input amps, maximum NIC speed and a manufacturer's PSU test point are not installation measurements.

Before reusing a record, check both drawings and review the populated fields against their sources. Onboarding readiness means the model information is available; it does not certify physical cables, site feeds, live power, negotiated network speed or internal redundancy of paired-input power modules.

When maintaining an installed model, preserve component IDs, endpoints, saved connections and explicit rack overrides. Documented new management endpoints may be added if all old identities and known capabilities remain intact. Validate existing links and completed power designs before applying a Library update.
