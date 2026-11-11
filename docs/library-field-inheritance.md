# Library field inheritance

The Library can retain a draft system while individual component fields carry reviewed source references. Reviews bind the field value to the component model and manufacturer; editing that identity or value invalidates inheritance. AI research suggestions cannot approve themselves.

Power Layout and the equipment summary share limit precedence: reviewed model fields, existing Library power settings, then explicit installation overrides. Blank overrides inherit; explicit invalid numbers remain visible to validation. DC output ratings never become AC consumption or cord limits.

Reviewed references can be applied in the Library editor for the exact SYS-510P-WTR/PWS-504P-1R, AS-8126GS-NB3RT power module configuration, and DCS-7010TX-48-R AC profile. AOC-S100G-M2C-P references provide Ethernet/QSFP28 capabilities and supported 10/25/40/50/100 Gb/s rates without selecting an operating rate. Sources are included with each field.

Network enrichment preserves port identity, count and location. Existing known capabilities cannot be overwritten on connected equipment. Filling missing details checks saved connections for new incompatibilities in a serializable transaction. Supported speeds are separate from configured speed. Capability information is not proof of a working transceiver or negotiated link.

Pending PSU/cable checks are separate from blocking calculator errors. This change does not bypass unknown PDU outlet/branch protection limits or supply/overload checks.

## Rollout

No schema migration or seed is needed. Application release and reviewed Library data updates are separate steps. Back up the exact affected raw Library records before applying data changes, compare current values before each write, and keep changes transactional. Preserve device instances, network links, artwork and saved rack power settings. Restore those Library records before rolling back to an application version that does not recognize supported-speed fields.

Full deployment verification requires the Linux production build and a browser save/reload check. Automated tests alone do not establish live browser behavior.
