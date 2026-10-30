<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes â€” APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` â€” verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## OneRack Pro Git and release contract

- Source repository: `hecvaz09/onerack-pro`. Keep the older OneRack application separate.
- Preserve uncommitted work; use an isolated branch/check-out for reconciliation and releases.
- For an approved release, commit and push its approved source before deployment. Record the Git SHA with the image/build identity. If Git cannot be updated, report the blocker; do not claim it is synchronized.
- Follow `docs/DEPLOYMENT.md`. Keep production credentials, saved records and private recovery artifacts outside Git/build contexts. Never migrate or seed production to test a code change.
- Read `docs/live-source-baseline.json` as source provenance, not as proof that a historical image was built from a Git commit.
- CI validates source only. Deployment and activation of new automatic deployment services require explicit user approval.
