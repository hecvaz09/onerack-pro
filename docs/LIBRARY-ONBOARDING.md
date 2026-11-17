# Device onboarding template

The user supplies the manufacturer and exact model. The assistant owns the research, completes the template, checks the artwork and validates how the record is consumed by Power Layout and Network Layout. Do not hand the user a checklist of manufacturer specifications to find.

Research and unfinished proposals stay outside the reusable Library. Add a new device only after its model requirements are documented and reviewed. A saved draft status in the current application does not isolate a record from reuse and is not a substitute for this publication gate. Existing incomplete entries require explicit remediation; do not silently delete or certify them.

## Research and publication workflow

1. **Identify.** Resolve the exact model and configuration from the make/model. Separate factory-installed hardware from supported options. Ask only for installation facts that manufacturer sources cannot establish, such as which optional adapter is fitted; bundle those questions.
2. **Research.** Read official product pages, manuals, datasheets and submittal drawings. Capture a source for each power/network fact. Resolve contradictions before accepting a value. Use the existing manufacturer-reference and field-review mechanisms.
3. **Prepare.** Populate the structured Library fields that the calculators actually consume. Reference prose alone does not supply compatibility or capacity rules. Prepare exact-model front/rear artwork using the established artwork standards.
4. **Validate.** Check the complete template below, review both rendered faces on desktop and narrow screens, and exercise the existing Power Calculator and network-port extraction/compatibility logic. Keep supported capabilities separate from selected installation settings. Confirm normal and applicable feed-failure constraints when a rack plan and its measured inputs are available. Preserve existing endpoint identities and explicit overrides.
5. **Review.** Present a short completed-device summary with sources, artwork and any installation-dependent inputs. If a model fact needed for layout compatibility is unresolved, keep the proposal outside the Library and explain the specific blocker. Do not claim all rack configurations are valid merely because the model record is complete.
6. **Publish.** After the model review is complete, add the record through the existing save/import/update path and verify the saved record is inherited by both layouts. Follow the repository's deployment contract when source or artwork changes require a release.

The checklist below is the assistant's acceptance template, not a form the user must research or fill out.

| Step | Record once in the Library | Keep explicit when unknown |
| --- | --- | --- |
| Identity | Manufacturer, exact model/configuration SKU, category, rack height | Optional parts and reference-only placeholders |
| Source | Manufacturer datasheet/manual URL; field-specific review links | Conflicting documents and installed FRU differences |
| Power | PSU quantity and physical AC inputs, applicable input voltage, redundancy, equipment inlet; PDU topology, outlet types/ratings, protected banks and phase mapping | Installed cord rating, per-PSU AC capacity, site supply and conditional output derating |
| Network | Onboard/management ports, exact installed adapters, connector, protocol and supported speeds, node/slot placement | Optional empty slots, selected link speed, optics, firmware and breakout mode |
| Artwork | Exact-model front/rear reference, correct footprint and readable labels | Missing artwork must stay explicit; never substitute another model |

For a known server or switch, an empty form can load its existing reference template as preparation. This is not publication or proof of a complete installed configuration. For an existing PDU, a prepared copy must retain the complete electrical outlet/bank profile. Descriptive text in Additional specifications does not create calculator rules. The current in-app research provider is restricted to local development and pauses new paid requests; do not describe it as an available live research workflow or enable it as part of documentation changes.

For an optional expansion position, record an **Other component** until an adapter is actually identified. For an installed card, add a network-interface row with its exact identity. A base chassis drawing does not prove an optional card is installed. Shared-power nodes belong to their parent chassis and must not be assigned fictional independent PSUs.

Whole-device AC demand and power factor belong to installed-device measurements. Leave missing watts and PF blank until measured, as requested by the user. Preserve already-saved budgets and their provenance. Explain these installation-dependent inputs before publication so they are not a surprise in Power Layout. DC PSU output, nameplate input amps, maximum NIC speed and a manufacturer's PSU test point are not installation measurements. An unknown site feed, negotiated speed or optional installed part cannot be invented from the model name.

Before reusing a record, check both drawings and review the populated fields against their sources. Onboarding readiness means the model information is available; it does not certify physical cables, site feeds, live power, negotiated network speed or internal redundancy of paired-input power modules.

When maintaining an installed model, preserve component IDs, endpoints, saved connections and explicit rack overrides. Documented new management endpoints may be added if all old identities and known capabilities remain intact. Validate existing links and completed power designs before applying a Library update.
