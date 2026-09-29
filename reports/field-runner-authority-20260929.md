# field Runner authority and QA law — status report

Date: 2026-09-29  
Chat identity: `field Runner authority and QA law` (derived from the primary goal; no explicit chat title was available)  
Runner working branch: `status/field-runner-authority-20260929`

## primary goal

Make `loew-runner` the universal execution/QA authority for field, force every field execution chat to rehydrate from current Runner guidance, resolve the canonical product repository as `lrnolivia/field`, and stop historical Revyme repository names or checkout paths from acting as current execution targets.

This migration is about execution authority and repository identity. It is **not** an instruction to erase legitimate Revyme technical-origin, attribution, compatibility, protocol, dependency, storage, or historical references inside field.

## exact resume points

The Runner working branch was created from the verified `loew-runner@main` commit:

- `e5f09a0feec5aecdbd7003d7f8600e5557bffb3b`

The field repository was verified at:

- `lrnolivia/field@64fa810a66fc54d73c2f46ed2e352a8c3a3e568d`

Always refresh both repositories before new mutations because both repos are active and main can move quickly.

Do **not** resume from the old field branch `field/universal-runner-authority` as source truth. Its head (`d4d3da5585fd49d0436c106ae9ed6c059900e173`) still contains the older large handoff contract and stale tests. Current `field@main` supersedes it.

## current authoritative state

Runner now has the authority migration in live code/docs:

- `LOEW_CHAT_BIBLE_CURRENT.md` is the current universal entry contract, version `2026-09-29.2`.
- `LOEW_CHAT_BIBLE.md` remains incorporated base law.
- `contracts/manifest.json` is version `2026-09-29.2`, points to the current authority wrapper, marks Runner-first QA as authoritative, treats project QA as overlays, and resolves managed targets through Runner project records before historical guidance.
- `AGENTS.md` explicitly resolves field to `lrnolivia/field`, rejects historical `revyme-loewfi` / `revyme-loew` / `revyme-löew` repository targets, and makes project QA an overlay under Runner section 11.
- `projects/field.json` names `lrnolivia/field` as the managed repository and encodes Runner-first QA routing:
  - exact branch/PR artifact
  - HTTP/read-only inspection first where sufficient
  - deterministic Inspector/GitHub Chromium for routine visual/runtime proof
  - Browser Run only when exploratory/live-session behavior adds unique value
  - `/qa/work/<projectId>` for real read-only saved-project truth
  - `/builder/noauth` smoke-only
- `workers/field.json` forces every material run to read the current Runner manifest/Bible first, resolve field from `projects/field.json`, then read current field bootstrap/live state.
- `docs/FIELD_NIGHT_SHIFT_MIGRATION.md` now describes the authority boundary as current behavior, not an aspirational migration.
- `docs/FIELD_GUIDANCE_CLEANUP_MANIFEST.md` records the remaining stale external Project-source cleanup.

field `main` now has the matching local overlay:

- root guidance points to Runner and the canonical `lrnolivia/field` target.
- `.field/handoff-kit/CONTRACT.md` is intentionally thin and redirects universal execution law to Runner instead of duplicating it.
- field-specific QA facts remain local, but Runner section 11 controls routing, classification, retries/watchdogs, fallbacks, danger-zone behavior, and promotion.
- the handoff-kit metadata/version is `2026-09-29.1`.
- the handoff regression tests now assert Runner-first behavior rather than the older browser-first model.

## important recovery history

An earlier attempt to ship the field guidance batch used a multi-file Base64 transport and produced empty blobs in commit `f95ddbb1482c4763615a6e3f0bb2a155b8c599f9`.

That failure was detected immediately and repaired non-destructively. No force push/history rewrite was used.

Recovery/continuation commits included:

- `b0c790bd18ddaea98284bfc68eb1c392bab16c9b` — restore/new root guidance
- `9c11bca3005d8b908532cd2673baf7599034674d` — restore handoff kit after transport failure
- `f5c96ad052a61c5af99fc3b760860823a904e72e` — Runner-first QA metadata
- `8dc98fa88e45948fdf33822b87d730a131e3c285` — Runner rehydration bootstrap/continuity
- `f989713e772f58d30337d44d801ae9c9522ea039` — assignment QA routing
- `dd74e2004b590d7043cb599c48a61fafd2dfdaf0` — Preview QA as Runner overlay
- `006c1ce916678f469a6a96c32e4ff57633a09756` — new-assignment Runner rehydration

Later concurrent/current commits completed the remaining contract/test reconciliation on field main and the Runner authority wrapper on loew-runner main. Treat present files and verified heads as truth, not the intermediate commit sequence.

## verification completed

Verified from fresh clones through Composio:

Runner at `e5f09a0feec5aecdbd7003d7f8600e5557bffb3b`:

- `node --test test/contracts.test.mjs` — 4/4 pass
- `npm run check` — pass

field at `64fa810a66fc54d73c2f46ed2e352a8c3a3e568d`:

- `python3 .field/handoff-kit/tests/contract_worker_v2_test.py` — pass
- `python3 .field/handoff-kit/tests/kit_self_test.py` — pass

No repo-local uncommitted code is required to recover this work. This Runner status branch inherits the fully verified Runner authority implementation. The corresponding field-side guidance/test implementation is already on current field main.

## remaining work

One known cleanup remains outside the GitHub repo authority that was available to this chat:

- external Project Source `LOEWFI_MASTER_REVYME_WORKER_HANDOFF.md`

It still represents historical Revyme-era execution guidance. When Project Sources are writable, prefer actual cleanup over another compatibility shim:

1. remove it from active Sources, or
2. replace its contents with a short deprecation pointer to:
   - `lrnolivia/loew-runner@main/contracts/manifest.json`
   - `lrnolivia/loew-runner@main/LOEW_CHAT_BIBLE_CURRENT.md`
   - `lrnolivia/loew-runner@main/projects/field.json`
   - `lrnolivia/field@main/AGENTS.md`

Until then, `docs/FIELD_GUIDANCE_CLEANUP_MANIFEST.md` marks it non-authoritative for current repository identity, execution process, and QA law.

## resume procedure

On the next invocation:

1. read current Runner manifest + `LOEW_CHAT_BIBLE_CURRENT.md`
2. refresh `loew-runner@main` and `field@main`
3. resolve field from current `projects/field.json`
4. read current `field@main/AGENTS.md`
5. do not use old Revyme repos or `field/universal-runner-authority` as the current target
6. re-run the focused Runner + field governance tests if authority files changed
7. if Project Sources are editable, retire/replace `LOEWFI_MASTER_REVYME_WORKER_HANDOFF.md`
8. otherwise no unfinished repo code from this chat needs reconstruction; continue from current live authority state

## status

Repository migration/guidance work: **complete and verified at the pinned heads above**.  
Outstanding item: **external stale Project-source cleanup only**.
