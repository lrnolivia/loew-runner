export function mandatoryRepairsForPull(ledger, pull, repository) {
  if (!ledger || !Array.isArray(ledger.repairs)) {
    throw new Error('Shared repair ledger must contain a repairs array');
  }
  return ledger.repairs.filter((repair) => {
    if (repair?.status !== 'resolved' || repair?.mandatory_baseline !== true) return false;
    const scope = repair.scope ?? {};
    if (scope.repository && scope.repository !== repository) return false;
    if (scope.base_branch && scope.base_branch !== pull.base?.ref) return false;
    if (scope.applies_to_open_prs === false) return false;
    return typeof repair.canonical_repair_sha === 'string' &&
      /^[a-f0-9]{40}$/i.test(repair.canonical_repair_sha);
  });
}

export function compareSatisfiesRepair(compare) {
  return compare?.status === 'ahead' || compare?.status === 'identical';
}

export function overlappingPaths(repairPaths, pullPaths) {
  const pull = new Set(pullPaths);
  return [...new Set(repairPaths)].filter((path) => pull.has(path)).sort();
}

export function eligibleImplementationPull(project, pull, repository) {
  if (pull?.head?.repo?.full_name !== repository) return { ok: false, reason: 'external_head' };
  const ref = pull?.head?.ref ?? '';
  const prefixes = project?.implementation?.branch_prefixes ?? [];
  if (!prefixes.some((prefix) => ref.startsWith(prefix))) return { ok: false, reason: 'branch_prefix' };
  if ((project?.implementation?.excluded_branches ?? []).includes(ref)) return { ok: false, reason: 'excluded_branch' };
  if (project?.promotion?.auto_update_branch !== true) return { ok: false, reason: 'auto_update_disabled' };
  return { ok: true };
}
