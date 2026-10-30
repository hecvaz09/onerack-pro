# OneRack Pro release procedure

## Scope and authority

Use `hecvaz09/onerack-pro`. Keep the older OneRack repository and its deployment cron separate. The current Pro runtime source is `/opt/racklab-staging`; it was historically outside Git. Do not treat an older Windows working copy as authoritative or overwrite its uncommitted work.

## Required order

1. Develop in an isolated Git branch. Preserve unrelated work and all private runtime files.
2. Review the exact diff. Keep credentials, `.env` files, database records/dumps, uploads and private operational details out of Git. The Pro repository is public.
3. Commit and push the approved source to this repository. Wait for **OneRack Pro checks / validate** to pass. Those checks never receive production database credentials.
4. From a clean checkout of the exact approved commit, run `python3 scripts/source_snapshot.py --output /private/path/new-release-source`. The output must be new and outside the checkout. The archive contains tracked source and an explicit Git SHA; it does not deploy, restore, migrate, seed or back up the database.
5. Prepare a separate VPS build context from that snapshot. Keep production `.env` and runtime configuration outside the context. Install only locked dependencies; use dummy local database URLs for generation/tests/build. Preserve resource limits on the shared server. External font downloads may be needed by `next/font`.
6. Record the Git SHA, source file hashes, lockfile hash, image ID and Next build ID. Preserve the current image/source for rollback. Compare the live baseline before applying changes; stop on conflicting drift.
7. After deployment approval, apply only the reviewed source changes and recreate only the Pro app service. Preserve its runtime environment, mounts, networks, ports and resource/security settings. Never run `compose down` for the shared stack.
8. Verify `/api/health` returns HTTP 200 with `status: "ok"`; verify the exact image/build and relevant static asset hashes, the authentication gate and unchanged other services. A healthy process does not prove DB integration or browser interaction. Roll back the release on failed verification.
9. Record the deployed Git SHA and release evidence. If a push or verification failed, report that gap explicitly; do not describe Git as current.

## Existing schema and catalog cautions

Do not run `prisma db seed` against production: the historical seed upserts catalog rows and can overwrite Library changes. The checked-in `prisma/rr-catalog-v1.json` was retained from the original public repository and was not replaced with live database/catalog data.

No database records are included in the source baseline. New schemas can be tested only against disposable synthetic databases. Previously reported migration-checksum discrepancies require a separate migration review; source reconciliation does not repair or replay historical migrations. Schema changes, migration application and data changes need their own explicit rollout plan and approval.

## Automation boundary

The committed GitHub Actions workflow validates Pro pushes/PRs. It deliberately contains no SSH credentials, production secrets, migrations or deployment job. The old application's cron does not deploy Pro. Automatic Pro cutover is not enabled by this source reconciliation; any future polling/webhook deployment must use this Git-first validation and rollback contract, with activation reviewed separately.
