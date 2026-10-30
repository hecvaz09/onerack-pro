# OneRack Pro

OneRack Pro is the Next.js application in this repository: projects and racks, an Equipment Library, front/rear and illustrative 3D elevations, network endpoint mapping, power planning, saved history, recoverable Trash/Restore and build documents.

Repository: https://github.com/hecvaz09/onerack-pro

The separate older `OneRack` repository has a different application and deployment job. This repository is the source of truth for Pro.

## Development and validation

Use Node 22 (`.nvmrc`) and the committed npm lockfile. `npm ci` runs Prisma client generation; it does not apply migrations or seed data. Production credentials and saved records stay outside Git.

For database-free validation, use the placeholder values in `.env.example` in an isolated environment. Its loopback port 1 URLs deliberately do not connect to any database. Do not replace an existing production environment with this example.

```
npm ci
npm test
npm run lint -- --max-warnings=0
npm run typecheck -- --incremental false
npm run build -- --webpack
```

CI runs these checks with dummy local database URLs and no production secrets. The synchronized application has 184 regression tests. Runtime browser interactions and real database integration require separately isolated validation; a build or health check does not prove those behaviors.

## Source and release workflow

Read [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Approved releases must be committed and pushed to this Pro repository before deployment. Build from a clean commit, record its source manifest and image identity, preserve rollback, and recreate only the app service after approval. Never seed or migrate production as a side effect of testing or deployment.

The synchronization baseline is in [docs/live-source-baseline.json](docs/live-source-baseline.json). It matches the verified source of release `20261030T172519Z`. This source reconciliation does not retroactively establish that the existing image was built from a Git commit.

The initial catalog JSON retained from this repository is historical seed input, not an export of the live Library. Saved projects, equipment instances, connections, measurements and Library edits reside in the database and are intentionally absent from this source snapshot.
