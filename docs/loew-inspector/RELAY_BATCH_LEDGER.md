# Relay batch ledger

Mission: finish RELAY_WORKER_HANDOFF.md in admitted coherent slices. Owner: codex-relay-worker-20260930. Operational state lives here; source/product truth stays in loew-inspector.

## Batch 1A/1B — native coordination foundation

- Assignment: relay-native-coordination; branch loew-inspector/relay-native-coordination; isolated checkout /Users/lrnolivia/Repos/relay-native-coordination.
- Inspector PR: https://github.com/lrnolivia/loew-inspector/pull/32.
- Initial source base: 5648b9147c63f68d34517c31d903a0f8464c5670.
- Canonical engine blob: e2624d48d2c03c2c3ed20bfc38646dcfc5c690c2; exact generated copy, live drift check before coordination.
- Implemented: six template-defined tools for projects, project resolution, assignments, preflight, audit and bounded coordination transitions; server validation, strict CAS, verified merged identity, exact readback and uncertainty recovery. Existing source-write readiness now correctly recognizes GitHub App auth in the app overview.
- Validation: all 45 tests pass locally; initial CI test and Runner admission passed. Added authenticated GitHub bridge runtime smoke covering tool discovery, project/assignment/audit, same-owner heartbeat, denied scope and stale-CAS rejection.
- Current status: latest head c6f8982 pending refreshed checks/merge/deployment/runtime smoke. No complete Batch 1 or full roadmap claim.
- Last-known-good deployment: version 34, 7c35957d-2611-4cf6-a849-1fef7752eceb; deployment 22fcad2c-f36b-4411-b7d7-96098ba5dae7 at 100%. Same Worker tag 734382bfc38a43cfb8cf9115116ed688, nine bindings and three domains confirmed before upload.
- Native source branch creation with a commit SHA as base returned Not Found: existing implementation resolves base as branch name. No identical retry; branch published through authorized local Git. Track bounded contract repair in next source slice.
- Next action: refreshed exact-head checks → ready/squash merge under registered auto-promotion policy → upload exact merged source retaining vars/secrets → native version deploy → authenticated smoke and existing SOURCE/CLOUD/Builds/Runner read regression → complete claim with this ledger.
- Remaining Batch 1: safe native cleanup, source inventory and exact-head PR lifecycle, durable operation/review/approval/history schemas and facades, source/version binding/publication state machine, full native normal workflow proof. See capability matrix for per-operation acceptance.

## Reporting claim

Runner assignment relay-batch-ledger; branch loew-runner/relay-batch-ledger. Scope limited to this ledger and RELAY_CAPABILITIES.md. This documentation claim does not authorize Runner execution/capacity/UI changes.
