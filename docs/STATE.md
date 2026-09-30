# runner — current state

Updated: 2026-09-29. Baseline inspected: `1fec12ce7b7271afc3eeeb9fd8b73368a25f61db`.

## Verified implementation

- Release/package: 0.6.0; hosted UI is worker-first with Visual evidence.
- `src/server.mjs` is the local adapter; `src/cloudflare-worker.mjs` is the hosted adapter. Hosted settings and Visual API are not implemented in the local adapter.
- Runner 3.0 exists as approved spec and assignment, not deployed product.
- Field reorganization is a separate assignment. Current `field/` branch enforcement remains until compatibility is proved.
- Runner/Inspector infrastructure work is protected. The 3.0 worker owns dashboard/data-model integration, not provider scheduling or capacity policy.
- No first-class Team registry exists yet. Historical reports do not prove current chat liveness.

## Baseline repository cleanup ledger

Inventory observed 2026-09-29 from fetched remote refs and GitHub's complete open-PR page (one PR). Counts below are Git ancestry, not semantic equivalence. No branches or PRs have been deleted/closed.

| Remote branch | Ahead / behind main | Unique work | Disposition |
| --- | --- | --- | --- |
| `main` | 0 / 0 | authoritative baseline | KEEP — integration truth |
| `control` | 0 / 57 | none by ancestry; old bootstrap tree | KEEP PROTECTED — designated future mutable control branch; not a stale task branch |
| `shared-repair-reconciler` | 2 / 29 | `d7189f4`, `cce07e9`; workflow, reconciler, tests, contract/project metadata | KEEP ACTIVE — open PR #4; infrastructure ownership; do not transplant or close from UI scope |
| `status/field-runner-authority-20260929` | 1 / 8 | `4d8020b`; single field authority report | QUARANTINE/REVIEW — preserve provenance, inspect source authority before transplant/archive |

Open PR #4: **Automate field shared repair reconciliation**, head `cce07e91e089d040c35db48fecd69cdc841a4028`. A historical red check alone does not condemn this branch. Its infrastructure owner must handle promotion.

Temporary local build checkpoints are separate from this remote baseline. `runner/3-a-control-plane` preserves early unshipped modules; baseline reconciliation precedes their integration.

## Documentation cleanup

- README's mixed 0.1 pilot instructions, planned deployment and dependency snapshots are superseded as the entry point; exact original preserved at `docs/archive/README-0.6-baseline.md`.
- This file owns current verified state and the cleanup ledger. README routes; architecture owns durable structure; 3.0 spec owns approved intent.
- Existing `reports/` are provenance, not canonical implementation state or Team registration. They remain intact until structured supersession/reference proof exists.
- Universal Bible/current authority and Night Shift contracts remain authoritative and unchanged.
- No speculative first-class worker identities have been created.

## Next gates

1. Finish baseline reconciliation and verify checks on its exact PR head.
2. 3.0-A: project/assignment/Team read surfaces, deterministic overlap and attention, live branch/PR inventory, notes inventory. Preserve Visual/automation controls.
3. 3.0-B: guarded writes and cleanup proof with audit events. Use optimistic concurrency; no direct target main writes.
4. 3.0-C: structured consolidation and deterministic handoffs; prose conflicts remain reviewable.
5. 3.0-D: consume existing infrastructure records; show unknown when capacity has no authoritative measurement.
6. 3.0-E: runtime/accessibility verification and final replacement cleanup. Version 3.0 only after release acceptance.

## 3.0-A branch checkpoint (not main/deployed)

`runner/3-a-control-plane` implements read-only project control surfaces and explicit repository refresh. Current missing Team records remain empty, not synthesized from historic reports. No guarded mutation is enabled. Both adapters route `/api/control`; hosted Access/token gates remain intact. Local syntax and seven test files pass; runtime/hosted evidence still pending. Control overlays use `control-data/` on `control`, leaving old scheduler state untouched.

## Assembled 3.0 preview and remaining release gates

Review stack: baseline #15 → read surfaces #16 → guarded controls #17 → consolidation #18 → infrastructure consumer #19 → runtime closeout. None is production truth until merged/deployed and verified.

Implemented on branches: Projects/Home/Team/Assignments, ownership/reporting and overlap tables, repo inventory/cleanup proof, assignment editing/reassignment/dependencies, existing-agent registration, project freeze, atomic control/events, saved refresh, structured digest/tracker reconciliation, duplicate-reference archive and handoffs with clipboard fallback. Core makes no inference call. The appointed existing Runner 3.0 worker is explicitly registered; other historical chats are not fabricated as live Team members.

Local syntax and eight deterministic test files pass. Local Chromium is absent; `runner-3-qa.yml` provides isolated exact-head desktop/mobile Chromium fixture QA on GitHub. That proves UI behavior against fixtures, not live GitHub writes, Access or provider-feed availability. Production gates remain:

- exact-head browser workflow and hosted Worker build;
- inspect screenshots and complete one bounded correction pass if needed;
- authenticated isolated preview integration for a reversible control-record edit, freeze and status consolidation;
- infrastructure owner supplies/acknowledges provider records or the UI remains explicitly unknown;
- final main/PR/SHA refresh before promotion and branch retirement.

The closeout branch additionally implements guarded branch/draft-PR creation, zero-unique-work superseded PR close, exact-head configured QA dispatch, evidence-bound human verdicts, reciprocal exact-file overlap approvals and agent retirement. These external action paths still require hosted integration evidence. Ownership/dependencies currently use structured tables rather than a graphical editor. Arbitrary Inspector recipes are not exposed; projects must configure their deterministic workflow. Safe deletion currently only handles zero-ahead branches and revalidates open PRs; it intentionally preserves any remaining unique commits. Notes archive is an archive-reference index preserving originals, not automatic prose-file relocation. Release remains 3.0 preview and package 0.6.0 until these acceptance gaps close or scope is explicitly narrowed. No release-complete claim is authorized by these tests.
