import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mandatoryRepairsForPull,
  compareSatisfiesRepair,
  overlappingPaths,
  eligibleImplementationPull,
} from '../src/shared-repairs.mjs';

const project = {
  implementation: {
    branch_prefixes: ['field/'],
    excluded_branches: ['main', 'field/control'],
  },
  promotion: { auto_update_branch: true },
};

test('selects only mandatory resolved repairs for the PR base', () => {
  const ledger = { repairs: [
    { id: 'yes', status: 'resolved', mandatory_baseline: true, canonical_repair_sha: 'a'.repeat(40), scope: { repository: 'lrnolivia/field', base_branch: 'main' } },
    { id: 'no', status: 'active', mandatory_baseline: true, canonical_repair_sha: 'b'.repeat(40), scope: { repository: 'lrnolivia/field', base_branch: 'main' } },
  ] };
  assert.deepEqual(
    mandatoryRepairsForPull(ledger, { base: { ref: 'main' } }, 'lrnolivia/field').map((r) => r.id),
    ['yes']
  );
});

test('ancestry status accepts ahead or identical only', () => {
  assert.equal(compareSatisfiesRepair({ status: 'ahead' }), true);
  assert.equal(compareSatisfiesRepair({ status: 'identical' }), true);
  assert.equal(compareSatisfiesRepair({ status: 'diverged' }), false);
});

test('path overlap is deterministic and deduplicated', () => {
  assert.deepEqual(overlappingPaths(['a.ts', 'b.ts', 'a.ts'], ['b.ts', 'c.ts']), ['b.ts']);
});

test('only internal implementation PRs with auto update are eligible', () => {
  assert.deepEqual(
    eligibleImplementationPull(project, { head: { ref: 'field/thing', repo: { full_name: 'lrnolivia/field' } } }, 'lrnolivia/field'),
    { ok: true }
  );
  assert.equal(
    eligibleImplementationPull(project, { head: { ref: 'field/control', repo: { full_name: 'lrnolivia/field' } } }, 'lrnolivia/field').ok,
    false
  );
  assert.equal(
    eligibleImplementationPull(project, { head: { ref: 'field/thing', repo: { full_name: 'other/fork' } } }, 'lrnolivia/field').ok,
    false
  );
});
