# Library quality checks

Library facts, installation assumptions and physical verification have separate roles. Unknown fields may stay blank; a draft is not an installed BOM. Preserve component IDs and saved endpoints when enriching a record.

`npm test` checks the shared templates, schema, front/rear asset references, stable endpoint identities and reviewed power inheritance. `libraryIntegrity` also accepts an exported catalog for private maintenance validation. Customer inventories and backups must remain outside this repository.

Library saves synchronize the legacy PSU count with structured components, discard stale field approvals, and update known-model artwork metadata to the existing shared references. Conflicting selected/supported network speeds are rejected. Existing mapped ports remain protected by the network enrichment checks.

The rack calculator inherits reviewed voltage and unambiguous N+N minimum-survivor requirements. Its AC-only context may use the documented AC-option range for supported switches without selecting a cable or certifying an installed AC PSU. Explicit installation overrides take precedence. DC output is never converted into AC capacity, cable current or measured demand.

Legacy imports preserve explicit current limits and demand notes. Missing cable ratings stay blank. A saved 12 A / C13 or 16 A / C19 limit may match an old default; that annotation does not establish its origin or the physical cable rating. Known limits remain enforced.

An absent PSU inventory no longer becomes two assumed inputs. Reference-only models and incomplete network configurations are identified in the Library. Optional adapter slots are not proof of installed cards. B300 supports twelve physical AC input assignments for PDU capacity planning; internal PSU redundancy remains outside that check.

Before a live cleanup, compare the fresh catalog with the reviewed inventory, back up affected rows, validate all saved network endpoints and power designs, and apply targeted changes transactionally. Drift stops the update. Do not seed or migrate a live database to repair reference data.
