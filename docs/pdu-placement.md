# Moving vertical PDUs

Open **Arrange PDUs** on Rack Map or Power Layout. Positions are described from the rear of the rack. **Swap left/right** mirrors the installed PDUs, including both inner/outer pairs on a four-PDU rack. The individual position selectors exchange the chosen PDU with an occupied destination. Changes remain a preview until **Save positions**; **Reset** discards the draft.

The saved mounting positions drive the shared rear elevation and 3D view. An A-feed PDU remains on feed A when moved left, and vice versa. Existing outlet assignments, network ports, model artwork, demand values, electrical limits and site confirmation remain attached to their existing records. Physical position does not change capacity or prove independent facility feeds.

Moves use the existing rack transaction lock and history. The server checks the current PDU identities, feed assignments and enabled rails before applying all positions together. A stale review, duplicate destination, disabled rail or foreign device prevents the save. On the first move, legacy position-derived feed identity and the PDU's number are recorded in the existing device details. Explicit configured feeds take precedence. The existing drag-to-empty-rail action also preserves identity. No schema migration is needed.

The existing `pduA` and `pduB` rack configuration keys continue to enable the right and left physical rails respectively; the settings labels now describe those physical rails. Feed identity is resolved separately by the Power Calculator and rack views. Existing racks retain their original positions until the user saves a move. A saved move invalidates earlier unsaved automatic power proposals, which must be recalculated against the current rack revision.

Regression coverage checks two/four-PDU arrangements, occupied-slot swaps, legacy identity, configured-feed precedence, rejected stale/invalid saves, preserved wiring/settings, identical full-plan and failover analysis, and Raritan/2D/3D feed labels. UI tests exercise draft/reset/save/error behavior; private desktop/mobile previews use the existing theme and artwork.
