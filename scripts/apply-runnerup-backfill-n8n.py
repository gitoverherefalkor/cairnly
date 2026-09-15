# Runner-up backfill so a constrained candidate never gets an empty runner-up list.
#
#   WF3 zhgJuiDp60PS5ZKJ, node "Ranking"              -> top up below-threshold picks
#   WF4 seWmQPFQqIe60TkU, node "Set Runner Up Prompt"  -> say plainly that they are
#                                                         harder matches
#
# Why: the 55-point runner-up threshold in Ranking wipes the list out when a
# non-negotiable floors the pool. Step 1 overrides objective_total to 5/64, which
# caps the final score at 45/100, so a floored career can never clear 55. Top 3 is
# a plain slice(0,3) and is never empty; runner-ups could come back as 0.
#
# The backfill runs AFTER the existing stretch-slot logic, so a healthy report is
# completely unaffected. Only degraded reports change.
#
# Safe to re-run: asserts anchors are unique, refuses to double-apply, and asserts
# the node diff touches ONLY the intended node before sending. No --apply = dry run.
#
# Rollback: n8n_wfs_cairnly/WF{3,4}*_LIVE_BACKUP_pre_backfill_20260915.json
#
# Run: set -a; source .env.local; set +a; python3 scripts/apply-runnerup-backfill-n8n.py --apply

import json, copy, os, sys, subprocess, tempfile

KEY = os.environ['N8N_API_KEY']
BASE = 'https://falkoratlas.app.n8n.cloud/api/v1/workflows'
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAFE = {'executionOrder', 'saveDataErrorExecution', 'saveDataSuccessExecution',
        'saveManualExecutions', 'saveExecutionProgress', 'executionTimeout',
        'errorWorkflow', 'timezone'}

WF3_ID, WF4_ID = 'zhgJuiDp60PS5ZKJ', 'seWmQPFQqIe60TkU'


def _curl(args):
    out = subprocess.run(['curl', '-sS', '--max-time', '90',
                          '-H', f'X-N8N-API-KEY: {KEY}'] + args,
                         capture_output=True, text=True)
    if out.returncode != 0:
        raise RuntimeError(out.stderr)
    return json.loads(out.stdout)


def fetch(wid):
    return _curl([f'{BASE}/{wid}'])


def put(wid, wf):
    body = {'name': wf['name'], 'nodes': wf['nodes'], 'connections': wf['connections'],
            'settings': {k: v for k, v in (wf.get('settings') or {}).items() if k in SAFE}}
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as f:
        json.dump(body, f)
        path = f.name
    try:
        return _curl(['-X', 'PUT', '-H', 'Content-Type: application/json',
                      '--data-binary', f'@{path}', f'{BASE}/{wid}'])
    finally:
        os.unlink(path)


def node_diff(a, b):
    am = {n['name']: json.dumps(n, sort_keys=True) for n in a}
    bm = {n['name']: json.dumps(n, sort_keys=True) for n in b}
    assert set(am) == set(bm), f'node set changed: {set(am) ^ set(bm)}'
    return sorted(k for k in am if am[k] != bm[k])


def replace_once(text, old, new, label):
    assert text.count(old) == 1, f'{label}: anchor found {text.count(old)}x, expected 1'
    return text.replace(old, new)


# ---------------------------------------------------------------- WF3 Ranking
BACKFILL = '''// Runner-up backfill — never ship an empty or half-empty runner-up section.
// The 55 threshold above wipes the list out when a non-negotiable (salary,
// schedule, or an hours ceiling) floors the pool: Step 1 overrides
// objective_total to 5/64, which caps the final score at 45/100, so a floored
// career can never clear 55 on its own. Top 3 is a plain slice(0, 3) and is
// never empty, but runner-ups could come back as 0.
//
// So top up from the next best remaining careers, flagged so WF4 can say
// plainly that these are harder matches rather than presenting them as equals.
// Runs AFTER the stretch-slot logic above, so a healthy report is untouched.
const FLOORED_STEP1 = 5; // Step 1's hard floor for objective_total on a violation
const step1Of = (career) => {
  const m = String(career.step1_objective_score ?? '').match(/\\d+/);
  return m ? parseInt(m[0], 10) : null;
};

if (runnerUps.length < 3) {
  const taken = new Set([...top3, ...runnerUps].map(c => normalizeTitle(c.career_title)));
  for (const career of rankedCareers.slice(3)) {
    if (runnerUps.length >= 3) break;
    const titleKey = normalizeTitle(career.career_title);
    if (!titleKey || taken.has(titleKey)) continue;
    taken.add(titleKey);
    runnerUps.push({
      ...career,
      below_threshold: true,
      below_threshold_reason:
        step1Of(career) === FLOORED_STEP1 ? 'non_negotiable' : 'low_compatibility'
    });
  }
}

'''

RU_OLD = '''  burnout_risk: career.penalties?.burnout_risk?.risk_level || "N/A"
}));

// All ranked for context'''
RU_NEW = '''  burnout_risk: career.penalties?.burnout_risk?.risk_level || "N/A",
  // Backfilled picks that did not clear the 55 threshold. WF4 reads these to
  // flag them as harder matches instead of presenting them as equal options.
  below_threshold: career.below_threshold === true,
  below_threshold_reason: career.below_threshold_reason || null
}));

// All ranked for context'''

SUM_OLD = 'careers_above_threshold: rankedCareers.filter(c => c.normalized_score >= 55).length,'
SUM_NEW = (SUM_OLD + '\n        runner_ups_backfilled: runnerUps.filter(c => c.below_threshold).length,')

wf3 = fetch(WF3_ID)
new3 = copy.deepcopy(wf3)
node3 = [n for n in new3['nodes'] if n['name'] == 'Ranking'][0]
code = node3['parameters']['jsCode']
assert 'below_threshold' not in code, 'WF3 Ranking already has the backfill'
code = replace_once(code, '// Format Top 3', BACKFILL + '// Format Top 3', 'WF3 insert point')
code = replace_once(code, RU_OLD, RU_NEW, 'WF3 formattedRunnerUps')
code = replace_once(code, SUM_OLD, SUM_NEW, 'WF3 summary')
node3['parameters']['jsCode'] = code
d = node_diff(wf3['nodes'], new3['nodes'])
assert d == ['Ranking'], f'WF3 unexpected diff: {d}'
print('WF3 diff OK ->', d)

# --------------------------------------------------- WF4 Set Runner Up Prompt
WF4_OLD = '''## The Reality Check

[3 bullets, 50-60 words total]

⚠ **[Concern].** [1 sentence]'''
WF4_NEW = WF4_OLD + '''

**Harder matches (below_threshold):** if this career's entry in the Runner-Up
Careers input has `below_threshold: true`, the FIRST Reality Check bullet must
say plainly that this is a harder match than the top three. When
`below_threshold_reason` is "non_negotiable", explain that the requirements the
candidate marked as non-negotiable (hours per week, schedule or salary) rule out
most of the stronger matches, and that this one is worth a look only if there is
some room to move on those. When it is "low_compatibility", say the fit is
thinner and name the weakest dimension. Never present a below_threshold
runner-up as an equal alternative to the top three, and never quietly drop it.'''

wf4 = fetch(WF4_ID)
new4 = copy.deepcopy(wf4)
node4 = [n for n in new4['nodes'] if n['name'] == 'Set Runner Up Prompt'][0]
a4 = node4['parameters']['assignments']['assignments'][0]
assert 'below_threshold' not in a4['value'], 'WF4 runner-up prompt already edited'
a4['value'] = replace_once(a4['value'], WF4_OLD, WF4_NEW, 'WF4 Reality Check')
d = node_diff(wf4['nodes'], new4['nodes'])
assert d == ['Set Runner Up Prompt'], f'WF4 unexpected diff: {d}'
print('WF4 diff OK ->', d)

if '--apply' not in sys.argv:
    print('\nDRY RUN - nothing sent.')
    sys.exit(0)

bdir = os.path.join(REPO, 'n8n_wfs_cairnly')
for wid, cur, new, nm, label in [
        (WF3_ID, wf3, new3, 'Ranking', 'WF3 - scoring careers NL_EN'),
        (WF4_ID, wf4, new4, 'Set Runner Up Prompt', 'WF4 - Career selection NL_EN')]:
    json.dump(cur, open(os.path.join(bdir, f'{label}_LIVE_BACKUP_pre_backfill_20260915.json'), 'w'), indent=2)
    put(wid, new)
    back = fetch(wid)
    node = [n for n in back['nodes'] if n['name'] == nm][0]
    blob = node['parameters'].get('jsCode') or json.dumps(node['parameters'])
    print(f'{label}: active={back.get("active")} nodes={len(back["nodes"])} '
          f'marker_present={"below_threshold" in blob} '
          f'unchanged_nodes={len(node_diff(new["nodes"], back["nodes"])) == 0}')
