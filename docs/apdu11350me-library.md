# APC APDU11350ME Library addition

Adds a new manufacturer reference and model-specific front/rear SVGs. Existing APDU10151ME records, artwork, installed PDUs and saved power/network connections are not edited. The Gen 2 rack panel is shared by the 2D and 3D views; all 48 outlet hit targets retain manufacturer numbering.

## Evidence

- [APC product](https://www.se.com/us/en/product/APDU11350ME/)
- [Manufacturer drawing package](https://download.se.com/files?p_Doc_Ref=APDU11350ME_EN), revision 0, approved February 3, 2025. PDF SHA-256: `9a1419cb1dea7a79935120aba474fbc972f1909d66fe935dcfada56953246c30`. Sheet 1 establishes geometry and bank arrangement; sheet 2 establishes phase wiring and ratings.
- [Manufacturer front photograph](https://download.se.com/files?p_Doc_Ref=APDU11350ME_FS), 4000-pixel version: confirms printed outlet identities, odd C13/C15 and even combination receptacles, six breakers, and NMC3 port positions.
- [Manufacturer datasheet](https://cdn.cs.1worldsync.com/92/7a/927a1303-f123-4142-8fb4-8a5e0fa42ab3.pdf), March 7, 2025: dimensions, environment, certifications and management speed.

## Electrical and network interpretation

The default is the North American 415 V line-to-line, three-phase wye, 30 A input / 24 A usable-per-phase profile. Nominal capacity is marketed as 17.3 kW; the calculator retains VA and uses the equipment power factor. The distinct IEC 400 V / 32 A / 22.1 kVA alternative is documented, not silently selected. Installation supply confirmation remains required and installed overrides take precedence.

Six single-pole 20 A breakers protect eight outlets each. The planning ceiling is conservatively 16 A per bank, explicitly distinguished from the 20 A nameplate. B1/B4 feed L1–N, B2/B5 feed L2–N, and B3/B6 feed L3–N. Odd receptacles have a 10 A limit; combination receptacles support a 16 A maximum, with C13/C15 mating limited to 10 A. Cable-specific limits remain an installation matter.

One 10/100/1000BASE-T RJ45 Ethernet endpoint is inherited by Network Layout. The two sensor ports and two link ports are drawn and documented separately; they are not ordinary Ethernet LAN endpoints. This is a metered model, not a switched or individually outlet-metered model.

## Rollout

`data/catalog/apc-apdu11350me.json` is new public manufacturer reference data, not an exported customer record. `scripts/add-apdu11350me.ts` provides plan/apply/verify/rollback operations for the one new row. It does not run automatically or during builds. Plan output must be saved privately before applying. Existing differing model/SKU/ID records stop the operation. Rollback deletes only the unchanged newly added row and refuses if it has been installed.

Deploy the reviewed code first, then apply the saved addition plan and verify it. No seeds or schema migrations. Verify both Library images and the single management port in the live browser after release. Placement of replacement PDUs and changes to UNC feed assignments require a separate task.
