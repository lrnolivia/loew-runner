import fs from 'node:fs/promises';
import {
  mandatoryRepairsForPull,
  compareSatisfiesRepair,
  overlappingPaths,
  eligibleImplementationPull,
} from '../src/shared-repairs.mjs';

const API = 'https://api.github.com';
const repository = 'lrnolivia/field';
const token = process.env.RUNNER_GITHUB_TOKEN;
const project = JSON.parse(await fs.readFile(new URL('../projects/field.json', import.meta.url), 'utf8'));

if (!token) throw new Error('RUNNER_GITHUB_TOKEN is required for shared-repair reconciliation.');

function headers(body = false) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'loew-runner-shared-repairs',
    ...(body ? { 'Content-Type': 'application/json' } : {}),
  };
}

async function request(path, options = {}, allowed = []) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...headers(Boolean(options.body)), ...(options.headers ?? {}) },
    signal: AbortSignal.timeout(20000),
  });
  const body = await response.text();
  let data = null;
  if (body) {
    try { data = JSON.parse(body); } catch { data = body; }
  }
  if (!response.ok && !allowed.includes(response.status)) {
    throw new Error(`GitHub ${response.status} for ${path}: ${String(body).slice(0, 500)}`);
  }
  return { status: response.status, ok: response.ok, data };
}

async function allPages(path, field = null, maxPages = 10) {
  const items = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const join = path.includes('?') ? '&' : '?';
    const response = await request(`${path}${join}per_page=100&page=${page}`);
    const batch = field ? response.data?.[field] : response.data;
    if (!Array.isArray(batch)) throw new Error(`Expected array from ${path}`);
    items.push(...batch);
    if (batch.length < 100) break;
  }
  return items;
}

function decodeFile(file) {
  if (!file || file.type !== 'file' || file.encoding !== 'base64' || !file.content) {
    throw new Error('Shared repair ledger is not a normal base64 GitHub file');
  }
  return JSON.parse(Buffer.from(file.content.replace(/\n/g, ''), 'base64').toString('utf8'));
}

async function compare(base, head) {
  return (await request(`/repos/${repository}/compare/${base}...${head}`)).data;
}

async function repairPaths(sha) {
  const paths = [];
  for (let page = 1; page <= 10; page += 1) {
    const data = (await request(`/repos/${repository}/commits/${sha}?per_page=100&page=${page}`)).data;
    const files = data.files ?? [];
    paths.push(...files.map((file) => file.filename));
    if (files.length < 100) break;
  }
  return [...new Set(paths)];
}

async function waitForUpdatedHead(number, oldSha) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const pull = (await request(`/repos/${repository}/pulls/${number}`)).data;
    if (pull.head.sha !== oldSha) return pull;
  }
  return null;
}

const ledgerResponse = await request(
  `/repos/${repository}/contents/${project.shared_repairs.ledger_path}?ref=${encodeURIComponent(project.shared_repairs.control_branch)}`
);
const ledger = decodeFile(ledgerResponse.data);
const pulls = await allPages(`/repos/${repository}/pulls?state=open`);
const repairPathCache = new Map();

const result = {
  repository,
  ledger_branch: project.shared_repairs.control_branch,
  checked: pulls.length,
  satisfied: [],
  updated: [],
  blocked: [],
  skipped: [],
};

for (const pull of pulls) {
  const eligibility = eligibleImplementationPull(project, pull, repository);
  if (!eligibility.ok) {
    result.skipped.push({ pr: pull.number, head: pull.head.ref, reason: eligibility.reason });
    continue;
  }

  const applicable = mandatoryRepairsForPull(ledger, pull, repository);
  const missing = [];
  for (const repair of applicable) {
    const comparison = await compare(repair.canonical_repair_sha, pull.head.sha);
    if (!compareSatisfiesRepair(comparison)) {
      missing.push({ repair, compare_status: comparison.status ?? null });
    }
  }

  if (!missing.length) {
    result.satisfied.push({ pr: pull.number, head_sha: pull.head.sha });
    continue;
  }

  const pullFiles = (await allPages(`/repos/${repository}/pulls/${pull.number}/files`))
    .map((file) => file.filename);
  const requiredPaths = [];
  for (const { repair } of missing) {
    if (!repairPathCache.has(repair.canonical_repair_sha)) {
      repairPathCache.set(repair.canonical_repair_sha, await repairPaths(repair.canonical_repair_sha));
    }
    requiredPaths.push(...repairPathCache.get(repair.canonical_repair_sha));
  }

  const overlap = overlappingPaths(requiredPaths, pullFiles);
  if (overlap.length) {
    result.blocked.push({
      pr: pull.number,
      head_sha: pull.head.sha,
      classification: 'BLOCKED — SHARED REPAIR PATH OVERLAP',
      missing_repairs: missing.map(({ repair }) => repair.id),
      overlapping_paths: overlap,
    });
    continue;
  }

  const update = await request(
    `/repos/${repository}/pulls/${pull.number}/update-branch`,
    {
      method: 'PUT',
      body: JSON.stringify({ expected_head_sha: pull.head.sha }),
    },
    [409, 422]
  );

  if (!update.ok) {
    result.blocked.push({
      pr: pull.number,
      head_sha: pull.head.sha,
      classification: 'BLOCKED — RECONCILIATION CONFLICT',
      github_status: update.status,
      message: update.data?.message ?? String(update.data ?? ''),
      missing_repairs: missing.map(({ repair }) => repair.id),
    });
    continue;
  }

  const refreshed = await waitForUpdatedHead(pull.number, pull.head.sha);
  if (!refreshed) {
    result.blocked.push({
      pr: pull.number,
      head_sha: pull.head.sha,
      classification: 'BLOCKED — UPDATE BRANCH DID NOT ADVANCE HEAD',
      missing_repairs: missing.map(({ repair }) => repair.id),
    });
    continue;
  }

  const stillMissing = [];
  for (const { repair } of missing) {
    const verification = await compare(repair.canonical_repair_sha, refreshed.head.sha);
    if (!compareSatisfiesRepair(verification)) stillMissing.push(repair.id);
  }

  if (stillMissing.length) {
    result.blocked.push({
      pr: pull.number,
      head_sha: refreshed.head.sha,
      classification: 'BLOCKED — REPAIR ANCESTRY NOT SATISFIED AFTER UPDATE',
      missing_repairs: stillMissing,
    });
    continue;
  }

  result.updated.push({
    pr: pull.number,
    previous_head_sha: pull.head.sha,
    head_sha: refreshed.head.sha,
    repairs: missing.map(({ repair }) => repair.id),
  });
}

await fs.mkdir(new URL('../state/', import.meta.url), { recursive: true });
const statePath = new URL('../state/shared-repairs.json', import.meta.url);
let previous = null;
try {
  previous = JSON.parse(await fs.readFile(statePath, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const previousComparable = previous ? { ...previous } : null;
if (previousComparable) delete previousComparable.updated_at;
const stateChanged = JSON.stringify(previousComparable) !== JSON.stringify(result);
if (stateChanged) {
  await fs.writeFile(
    statePath,
    JSON.stringify({ ...result, updated_at: new Date().toISOString() }, null, 2) + '\n',
    'utf8'
  );
}
console.log('LOEW_SHARED_REPAIR_RESULT=' + JSON.stringify({ ...result, state_changed: stateChanged }));
