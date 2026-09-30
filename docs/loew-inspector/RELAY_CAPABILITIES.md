# Relay capability matrix and operation contracts

Authority: RELAY_WORKER_HANDOFF.md; Runner Bible and live registration outrank this inventory.
Updated: 2026-09-30. This is implementation accounting, not a claim that the roadmap is shipped.

## Current backend boundaries

Relay serves bounded conversation/app tools; Runner owns records/policy; Inspector owns evidence; GitHub owns source/check/PR identity; Cloudflare owns version/deployment identity. Existing protected OAuth and GitHub automation ingress are preserved. No model inference is required for coordination. No new ownership or approval registry is introduced.

## Batch 1 inventory

| Operation | Native tool/backend | Status | Preconditions, receipt, acceptance |
| --- | --- | --- | --- |
| Namespace/auth readiness | relay_control_status, source_status, cloud_status | Existing; live verified | Auth mode and bounded cloud allowlist truthful; retain GitHub App and separate Builds token |
| Project list/resolve/status | relay_runner_projects, relay_runner_project / Runner projects + coordination | Shipped in Inspector PR #32; authenticated runtime verified | Strict project identity; current policy and record SHA; unmanaged/disabled registrations fail closed |
| Assignment read/list, queue inspection | relay_runner_assignments / canonical Runner record | Shipped in #32; authenticated runtime verified | Preserve actual owner, held state, expired reservation and queue; no invented runtime/execution status |
| Queue, claim, rescope | relay_runner_coordinate / Runner Contents CAS + exact shared engine | Shipped in #32; authenticated runtime verified | Expected record revision, exact scope/resources, live base SHA, budget and overlap policy; readback mandatory |
| Preflight | relay_runner_preflight / shared engine + full paginated Git inventory | Shipped in #32; authenticated runtime verified | Active current owner/lease, full proposed changed paths and relevant audit findings; pass means admission only |
| Heartbeat, hold, handoff | relay_runner_coordinate | Shipped in #32; authenticated runtime verified | Current owner/revision and recovery action; same branch/assignment; explicit successor, no expiry takeover |
| Complete | relay_runner_coordinate | Shipped in #32; authenticated runtime verified | Actual claimed same-repo merged PR into registered default branch; work accounting/evidence required; provider supplies head/merge identity |
| Ownership/conflict inspection | project/assignments/audit | Structural inspection implemented in #32 | Exact paths/resources retained. Structured semantic conflict proposal/resolution is missing |
| Audit | relay_runner_audit / shared engine | Shipped in #32; authenticated runtime verified | Complete paginated branch/PR/file inventory; findings do not override GitHub required checks |
| Eligible branch cleanup | Runner scripts/coordinate.mjs cleanup | Missing native Relay operation | Only completed, accounted, exact merged-head managed branches; preserve legacy/active/new commits; bounded explicit dry-run/execute needed |
| Worker state/actions | relay_runner_workers/action / protected Runner API | Existing | Limited deployed actions; not a first-class chat wake mechanism |
| Repository/file/PR/check reads | relay_source_repo/file/pull_request/checks / GitHub App | Existing | Owner allowlist; checks currently require improved exact-head and pagination normalization |
| Branch/head/PR inventory | GitHub backend | Missing bounded native inventory/head primitives | Full pagination; exact head identity |
| Branch creation | relay_source_create_branch | Existing; repair identified | `base` currently resolves a branch name. Passing a commit SHA returned Not Found; schema/description must clarify or add bounded SHA support |
| Single/multi-file source commit | relay_source_update_file/commit_files | Existing | Non-default branch; improve mandatory head/claim enforcement, post-write reconciliation and durable idempotency |
| Draft PR open | relay_source_open_pull_request | Existing; live verified #32 | Same admitted branch; creation readback; duplicate/interrupted create needs reconciliation |
| PR metadata/ready/merge | GitHub backend | Missing native Relay operations | Exact-head preflight and policy; required checks/protection; changed head rejected; no bypass |
| Worker/version/deployment/Builds reads | relay_cloud_worker/builds/scripts | Existing; live verified | Preserve narrow write scripts=[loew-inspector], version IDs, separate Builds auth |
| Existing-version deploy/rollback | relay_cloud_deploy_version | Existing; needs reliability upgrade | Exact source/version binding, last-known-good state, durable receipt and readback |
| Source upload | Wrangler/provider recovery | Missing routine bounded native upload | Until implemented, local Wrangler uploads use exact merged checkout and keep-vars; this is an external fallback |
| Post-deployment health/identity | relay_verify_fetch_url + cloud summary | Existing primitives; orchestrator missing | Health/version and actual active version must agree with exact merged source |
| Operation receipt/status lookup | Returned record/commit SHA + source file reads | Partial | Coordination readback receipts survive as immutable Git revisions; unified interrupted-operation/history tool missing |
| HTTP/runtime evidence | relay_verify_fetch_url and existing Inspector engines/recipes | Existing | Exact artifact/criterion/engine/evidence/classification; preserve capacity retry metadata and bounded QA law |
| Before/after captures | Inspector screenshot/capture/recipe primitives | Partial | Paired comparable route/fixture/viewport/artifact contract missing; protected evidence delivery retained |
| Review packets/evidence links | Runner records architecture | Missing agreed scoped extension | Define exact artifact/check/evidence fields and CAS lifecycle; do not create a Relay-only store |
| Conflict records/proposals/resolution | Runner ownership/review architecture | Missing | Recorded base and both heads; user decision for semantic intent; drift invalidates decision |
| Scoped approve/reject/revoke/revision | Runner review/control architecture | Missing | Action/environment/head/policy/evidence binding; server revalidation; approvals cannot override required checks |
| Activity/history/handoff generation | Runner records/history | Partial backend; missing native facade | Durable source of actor/result/recovery; no fabricated completion |
| Persisted publication workflow | Existing source/cloud/verify primitives | Missing | Preflight → checks/evidence → scoped decision → exact merge → exact deploy → runtime verification → completion; resume without replaying writes |
| MCP app review workspace | Existing relay_ui_control_center resource | Existing overview; full review workflow missing | Real host discovery/auth/evidence/accessibility/restart verification required in Batch 3 |
| Field design-object integration | Field + Relay coordination | Deferred to Batch 6 | Separate Field handoff/admission, graph/source identity and exact real-project Preview; no Field edits in foundation slice |
| Access retirement | Cloudflare admin recovery | Deferred to Batch 2 | Fresh references/traffic and protected/client regression evidence before each removal; no credential churn |

## Shared deterministic templates

The first operation-definition template drives MCP registration, bounded schemas, annotations and server validation. UI and chat share the same server path. Representative coordination reads, writes and policy checks prove the template before expanding it to review/publication.

Coordination command:

```json
{
  "project": "<registered-id>",
  "action": "queue|claim|rescope|heartbeat|hold|handoff|complete",
  "expected_record_sha": "<current-40-character-record-blob-sha>",
  "request": { "id": "<stable-assignment>", "owner": "<persistent-owner>", "next_action": "<concrete-action>" }
}
```

Action-specific required/allowed fields are validated on the server. Caller cannot supply base/merged identity or switch an existing task branch. The adapter imports a byte-exact generated Runner engine and compares its Git blob identity with live Runner main before policy operations; drift blocks writes until synced and tested. No runtime code evaluation or second rule engine exists.

Coordination receipt:

```json
{
  "repository": "lrnolivia/loew-runner",
  "path": "coordination/<project>.json",
  "previous_record_sha": "<expected-revision>",
  "record_sha": "<verified-revision>",
  "commit_sha": "<write-commit-or-null-for-reconciled-timeout>",
  "reconciled_after_transport_error": false,
  "recovery": "Read current assignments before another mutation; never replay stale revision."
}
```

A stale revision/duplicate submission fails without a second write. A timeout after acceptance is reconciled by exact persisted content. Failed/unavailable readback yields `uncertain_write`, never a fabricated pass. Provider errors return bounded classes and recovery, not provider bodies/secrets. Remaining cross-operation idempotency/history is explicitly partial.

Next templates, not implemented yet: exact-artifact review packet; scoped approval; semantic conflict decision; paired evidence request; publication/rollback plan; immutable activity receipt; danger-zone QA packet. Their stores must reuse Runner/Inspector truth, with reviewed Runner schema changes before writes.

## Composio-free exit accounting

This slice removes Composio from project lookup and coordination transactions. Initial admission used the existing deterministic local CLI because the native tools were not yet deployed. Ready/merge and source upload still use explicit local/provider recovery until their native primitives land. No Composio call has been used in this batch. This does **not** satisfy the handoff's complete native end-to-end exit criterion yet.
