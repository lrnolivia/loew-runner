# Relay batch ledger

Mission: finish RELAY_WORKER_HANDOFF.md in admitted coherent slices. Owner: codex-relay-worker-20260930. Operational state lives here; source/product truth stays in loew-inspector.

## Batch 1A/1B — native coordination foundation

- Assignment: relay-native-coordination; branch loew-inspector/relay-native-coordination; isolated checkout /Users/lrnolivia/Repos/relay-native-coordination.
- Inspector PR: https://github.com/lrnolivia/loew-inspector/pull/32.
- Initial source base: 5648b9147c63f68d34517c31d903a0f8464c5670.
- Canonical engine blob: e2624d48d2c03c2c3ed20bfc38646dcfc5c690c2; exact generated copy, live drift check before coordination.
- Implemented: six template-defined tools for projects, project resolution, assignments, preflight, audit and bounded coordination transitions; server validation, strict CAS, verified merged identity, exact readback and uncertainty recovery. Existing source-write readiness now correctly recognizes GitHub App auth in the app overview.
- Validation: all 45 tests pass locally; initial CI test and Runner admission passed. Added authenticated GitHub bridge runtime smoke covering tool discovery, project/assignment/audit, same-owner heartbeat, denied scope and stale-CAS rejection.
- Current status: merged PR #32 at 4d18720d757abb8d44d14173154ce74cc6ca6214; tested head c6f898256f47ece27cfc5efba8deda551ae13852. Tests and Runner admission passed at this head (runs 36704810378 and 36704810451). No complete Batch 1 or full roadmap claim.
- Deployed version 36, 111276bc-0151-4cc1-a74b-7eca9b207f27, at 100% via deployment f7d4600e-08f1-4bdc-8589-a8a8054f3d30 (2026-09-30T10:53:50.289295Z). Exact merged checkout uploaded with keep-vars; all nine bindings and three domains retained. A prior staged upload from the byte-identical tested head (version 35, b6768406-fe08-4faf-9045-52dd8b61f427) was not promoted; version 36 was uploaded explicitly from the detached merge identity.
- Authenticated runtime smoke https://github.com/lrnolivia/loew-inspector/actions/runs/36705197743 passed discovery/project/assignments/audit/preflight, same-owner verified heartbeat, denied scope and stale-CAS rejection. This uses the retained GitHub bridge, not a claim of fresh normal-ChatGPT discovery for the six newly added tools. Existing connected plugin CONTROL reports 1.2.0; SOURCE/CLOUD/Builds pass and direct protected Runner read is HTTP 200 JSON.
- Last-known-good deployment: version 34, 7c35957d-2611-4cf6-a849-1fef7752eceb; deployment 22fcad2c-f36b-4411-b7d7-96098ba5dae7 at 100%. Same Worker tag 734382bfc38a43cfb8cf9115116ed688, nine bindings and three domains confirmed before upload.
- Native source branch creation with a commit SHA as base returned Not Found: existing implementation resolves base as branch name. No identical retry; branch published through authorized local Git. Track bounded contract repair in next source slice.
- Next action: complete coordination claim with merged identity and this durable accounting; admit next exact-head source lifecycle slice.
- Remaining Batch 1: safe native cleanup, source inventory and exact-head PR lifecycle, durable operation/review/approval/history schemas and facades, source/version binding/publication state machine, full native normal workflow proof. See capability matrix for per-operation acceptance.

## Reporting claim

Runner assignment relay-batch-ledger; branch loew-runner/relay-batch-ledger. Scope limited to this ledger and RELAY_CAPABILITIES.md. This documentation claim does not authorize Runner execution/capacity/UI changes.
