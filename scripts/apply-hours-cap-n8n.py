# Applies the hours-ceiling prompt edits to the two live n8n workflows:
#   WF2 vVv0tsnFlBnarMdq, node "Set Suitable 15 Prompt1"  -> hard constraint 8
#   WF3 zhgJuiDp60PS5ZKJ, node "Objective Compat score"    -> hours rule in the
#        non-negotiable block + the schedule-violation extract list
#
# Safe to re-run: it asserts each anchor occurs exactly once, refuses if the
# edit is already present, and asserts the serialized node diff touches ONLY
# the intended node before sending. Without --apply it is a dry run.
#
# Rollback: n8n_wfs_cairnly/WF{2,3}*_LIVE_BACKUP_pre_hourscap_20260915.json
#
# Run: set -a; source .env.local; set +a; python3 scripts/apply-hours-cap-n8n.py --apply

import json, copy, os, sys, subprocess, tempfile

D='/private/tmp/claude-501/-Users-sjoerdgeurts-Documents-Code-Projects-Cairnly/fab11b9f-5088-45cc-a0e7-c082b98660e8/scratchpad'
KEY=os.environ['N8N_API_KEY']
BASE='https://falkoratlas.app.n8n.cloud/api/v1/workflows'
SAFE={'executionOrder','saveDataErrorExecution','saveDataSuccessExecution',
      'saveManualExecutions','saveExecutionProgress','executionTimeout',
      'errorWorkflow','timezone'}

WF2_ADD = """8. **Respect an Hours Ceiling (Ref: 3d)**
   - [3d] may end with a "(max N hours/week)" suffix, optionally followed by a [NON-NEGOTIABLE] marker.
   - When that suffix is present, every one of the 15 careers must be genuinely doable at N hours or fewer: commonly available part-time, job-shareable, project/freelance-shaped, or normally staffed at reduced hours.
   - Do NOT fill the 15 with roles whose normal load is 40+ hours and then note the conflict in `why_this_fits`. An hours ceiling narrows the pool; it does not license a full-time pool with caveats.
   - If a strong-fit career genuinely cannot be done at N hours, leave it out and spend the slot on a viable alternative. Reaching 15 viable careers matters more than reaching the single best-fitting title.

"""

WF3_A_OLD = "A compatible or flexible schedule is not a violation."
WF3_A_NEW = ("A compatible or flexible schedule is not a violation. "
  "**Hours ceiling:** [3d] may carry a \"(max N hours/week)\" suffix. Treat as violated only when the career "
  "is clearly incompatible with N, i.e. its normal load plainly exceeds N and it is not a role that is commonly "
  "done part-time, job-shared, or at reduced hours (e.g. \"max 24 hours/week\" vs an on-call or 50+ hours/week role). "
  "When in doubt, it is NOT a violation: most roles can be negotiated down, and over-flagging here empties the "
  "candidate's runner-up list.")

WF3_B_OLD = "- Constraints [1n] (may include: young children, burnout history, health conditions, caregiving, etc.)"
WF3_B_NEW = (WF3_B_OLD + "\n- Hours ceiling: [3d] may end with \"(max N hours/week)\". Even WITHOUT a "
  "[NON-NEGOTIABLE] marker, a career whose normal load clearly exceeds N is a schedule violation here "
  "(severity by size of the gap), scored in Work Preferences rather than the hard floor.")

def _curl(args):
    out=subprocess.run(['curl','-sS','--max-time','90',
        '-H',f'X-N8N-API-KEY: {KEY}']+args, capture_output=True, text=True)
    if out.returncode!=0: raise RuntimeError(out.stderr)
    return json.loads(out.stdout)

def fetch(wid):
    return _curl([f'{BASE}/{wid}'])

def put(wid, wf):
    body={'name':wf['name'],'nodes':wf['nodes'],'connections':wf['connections'],
          'settings':{k:v for k,v in (wf.get('settings') or {}).items() if k in SAFE}}
    with tempfile.NamedTemporaryFile('w',suffix='.json',delete=False) as f:
        json.dump(body,f); path=f.name
    try:
        return _curl(['-X','PUT','-H','Content-Type: application/json',
                      '--data-binary',f'@{path}', f'{BASE}/{wid}'])
    finally:
        os.unlink(path)

def node_diff(a,b):
    """Names of nodes whose serialization differs."""
    am={n['name']:json.dumps(n,sort_keys=True) for n in a}
    bm={n['name']:json.dumps(n,sort_keys=True) for n in b}
    assert set(am)==set(bm), f'node set changed: {set(am)^set(bm)}'
    return sorted(k for k in am if am[k]!=bm[k])

def edit_prompt(wf, node_name, fn):
    wf2=copy.deepcopy(wf)
    n=[x for x in wf2['nodes'] if x['name']==node_name][0]
    a=n['parameters']['assignments']['assignments'][0]
    a['value']=fn(a['value'])
    return wf2

# ---------- WF2 ----------
wf2=fetch('vVv0tsnFlBnarMdq')
A='### Soft Preferences (Should Apply When Possible):'
def f2(t):
    assert t.count(A)==1, f'WF2 anchor count {t.count(A)}'
    assert 'Hours Ceiling' not in t, 'WF2 already edited'
    return t.replace(A, WF2_ADD + A)
new2=edit_prompt(wf2,'Set Suitable 15 Prompt1',f2)
d=node_diff(wf2['nodes'],new2['nodes'])
assert d==['Set Suitable 15 Prompt1'], f'WF2 unexpected diff: {d}'
print('WF2 diff OK ->', d)

# ---------- WF3 ----------
wf3=fetch('zhgJuiDp60PS5ZKJ')
def f3(t):
    assert t.count(WF3_A_OLD)==1 and t.count(WF3_B_OLD)==1, 'WF3 anchor count'
    assert 'Hours ceiling' not in t, 'WF3 already edited'
    return t.replace(WF3_A_OLD, WF3_A_NEW).replace(WF3_B_OLD, WF3_B_NEW)
new3=edit_prompt(wf3,'Objective Compat score',f3)
d=node_diff(wf3['nodes'],new3['nodes'])
assert d==['Objective Compat score'], f'WF3 unexpected diff: {d}'
print('WF3 diff OK ->', d)

if '--apply' not in sys.argv:
    print('\nDRY RUN — nothing sent.'); sys.exit(0)

for wid,new,label in [('vVv0tsnFlBnarMdq',new2,'WF2'),('zhgJuiDp60PS5ZKJ',new3,'WF3')]:
    put(wid,new)
    back=fetch(wid)
    nm={'vVv0tsnFlBnarMdq':'Set Suitable 15 Prompt1','zhgJuiDp60PS5ZKJ':'Objective Compat score'}[wid]
    txt=[x for x in back['nodes'] if x['name']==nm][0]['parameters']['assignments']['assignments'][0]['value']
    marker='Hours Ceiling' if label=='WF2' else 'Hours ceiling'
    print(f'{label}: active={back.get("active")} nodes={len(back["nodes"])} '
          f'marker_present={marker in txt} unchanged_nodes={len(node_diff(new["nodes"],back["nodes"]))==0}')
    json.dump(back, open(f'{D}/applied_{wid}.json','w'), indent=2)
