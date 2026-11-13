import { workflow, node, trigger, expr } from '@n8n/workflow-sdk';

const DS = { __rl: true, mode: 'id', value: 'e3s4JIlVRWYfv7ae', cachedResultName: 'encore_eval_wf3p_dataset' };
const RS = { __rl: true, mode: 'id', value: 'r2xPfQ0ERrYJKhYE', cachedResultName: 'encore_eval_wf3p_results' };

const evalTrigger = trigger({ type: 'n8n-nodes-base.evaluationTrigger', version: 4.7, config: {
  name: 'Evaluation dataset (4 personas)', position: [0, 0],
  parameters: { source: 'dataTable', dataTableId: DS, limitRows: false } } });

const apiTrigger = trigger({ type: 'n8n-nodes-base.webhook', version: 2.2, config: {
  name: 'Run by hand (persona)', position: [0, 300],
  parameters: { httpMethod: 'POST', path: 'encore-eval-wf3p', responseMode: 'onReceived' } } });

const pickRows = node({ type: 'n8n-nodes-base.code', version: 2, config: {
  name: 'Pick persona rows', position: [240, 300], executeOnce: true,
  parameters: { jsCode: "// Hand run: body {\"persona\": \"Henk\"} or {\"persona\": \"all\"}.\nconst p = String((($json.body || {}).persona) || 'all').trim();\nreturn [{ json: { chosen: p } }];\n" } } });

const getRows = node({ type: 'n8n-nodes-base.dataTable', version: 1.1, config: {
  name: 'Read dataset', position: [480, 300], executeOnce: true,
  parameters: { resource: 'row', operation: 'get', dataTableId: DS, returnAll: true } } });

const filterRows = node({ type: 'n8n-nodes-base.code', version: 2, config: {
  name: 'Keep chosen persona', position: [720, 300],
  parameters: { jsCode: "// Keeps the dataset rows for the chosen persona (\"all\" keeps every active row).\nconst chosen = String($('Pick persona rows').first().json.chosen || 'all').toLowerCase();\nreturn $input.all().filter(i => i.json.active !== false && (chosen === 'all' || String(i.json.persona).toLowerCase() === chosen));\n" } } });

const makeRuns = node({ type: 'n8n-nodes-base.code', version: 2, config: {
  name: 'Make 3 runs', position: [960, 0],
  parameters: { jsCode: "// Each persona is scored 3 times on the same fixed input, to measure stability.\nconst out = [];\nfor (const item of $input.all()) {\n  for (let run = 1; run <= 3; run++) {\n    out.push({ json: { persona: item.json.persona, report_id: item.json.report_id, labels: item.json.labels, run } });\n  }\n}\nreturn out;\n" } } });

const runCore = node({ type: 'n8n-nodes-base.executeWorkflow', version: 1.4, config: {
  name: 'Score with WF3P copy', position: [1200, 0], onError: 'continueRegularOutput',
  parameters: {
    source: 'database',
    workflowId: { __rl: true, mode: 'id', value: 'yoRGLPj80geyRZTS', cachedResultName: 'EVAL - Encore WF3P scoring core (copy, no writes)' },
    mode: 'each',
    workflowInputs: { mappingMode: 'defineBelow', value: { report_id: expr('{{ $json.report_id }}') }, matchingColumns: [],
      schema: [{ id: 'report_id', displayName: 'report_id', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' }],
      attemptToConvertTypes: false, convertFieldsToString: true },
    options: { waitForSubWorkflow: true } } } });

const checks = node({ type: 'n8n-nodes-base.code', version: 2, config: {
  name: 'Compute checks', position: [1440, 0],
  parameters: { jsCode: "// Turns 3 scoring runs per persona into plain checks (0 to 1, 1 = good).\n// Reference labels (form, activity, pay) come from the dataset, written by hand,\n// so the checks do not trust the labels the scoring model gives itself.\nconst runsIn = $('Make 3 runs').all();\nconst outs = $input.all();\nconst norm = (s) => String(s || '').toLowerCase().replace(/\\s+/g, ' ').trim();\nconst DONT_KNOW = \"i don't know yet, show me what fits\";\n\nconst groups = {};\nouts.forEach((o, i) => {\n  const src = (runsIn[i] || runsIn[0]).json;\n  const key = src.persona;\n  if (!groups[key]) groups[key] = { src, runs: [] };\n  groups[key].runs.push(o.json || {});\n});\n\nconst share = (arr) => arr.length ? Math.round((arr.filter(Boolean).length / arr.length) * 100) / 100 : 0;\n\nreturn Object.values(groups).map(({ src, runs }) => {\n  let labels = {};\n  try { labels = JSON.parse(src.labels || '{}'); } catch (e) {}\n  const lab = {};\n  Object.entries(labels).forEach(([t, v]) => { lab[norm(t)] = v; });\n\n  const ok = runs.filter(r => Array.isArray(r.top3) && r.top3.length === 3);\n  const tops = ok.map(r => r.top3.map(t => t.title));\n  const sets = tops.map(t => t.map(norm));\n  const facts = (ok[0] && ok[0].facts) || {};\n  const unlabeled = [...new Set(sets.flat().filter(t => !lab[t]))];\n\n  // 1. Same top 3 across runs: average overlap of every pair of runs.\n  let pairs = 0, overlap = 0;\n  for (let a = 0; a < sets.length; a++) for (let b = a + 1; b < sets.length; b++) {\n    pairs++; overlap += sets[a].filter(t => sets[b].includes(t)).length / 3;\n  }\n  const top3_stability = pairs ? Math.round((overlap / pairs) * 100) / 100 : 0;\n\n  // 2. Same #1 across runs.\n  const firsts = sets.map(s => s[0]);\n  const counts = {}; firsts.forEach(f => { counts[f] = (counts[f] || 0) + 1; });\n  const top1_same = firsts.length ? Math.round((Math.max(...Object.values(counts)) / firsts.length) * 100) / 100 : 0;\n\n  // 3. Pay rule: when extra income matters, #1 must be fairly paid.\n  const needsIncome = /^yes/i.test(String(facts.pay || '').trim());\n  const pay_rule_ok = needsIncome ? share(sets.map(s => (lab[s[0]] || {}).pay === 'fair')) : 1;\n\n  // 4. Stricter: when income matters, #1 is not among the lowest-paid third of the 15.\n  const priced = Object.entries(lab).filter(([, v]) => typeof v.eur_hour === 'number').sort((a, b) => a[1].eur_hour - b[1].eur_hour);\n  const bottom = new Set(priced.slice(0, Math.ceil(priced.length / 3)).map(([t]) => t));\n  const pay_not_bottom_third = needsIncome && priced.length ? share(sets.map(s => !bottom.has(s[0]))) : 1;\n\n  // 5. At least 2 of the top 3 in a form they ticked [3.4].\n  const ticked = (facts.forms || []).map(norm);\n  const formsApply = ticked.length && !ticked.includes(DONT_KNOW);\n  const form_fit = formsApply ? share(sets.map(s => s.filter(t => ((lab[t] || {}).forms || []).map(norm).some(f => ticked.includes(f))).length >= 2)) : 1;\n\n  // 6. Three different activities in the top 3.\n  const variety_ok = share(sets.map(s => new Set(s.map(t => (lab[t] || {}).family || t)).size === 3));\n\n  const runs_ok = Math.round((ok.length / Math.max(runs.length, 1)) * 100) / 100;\n\n  const fails = [];\n  if (runs_ok < 1) fails.push(`${runs.length - ok.length} of ${runs.length} runs failed`);\n  if (top3_stability < 0.78) fails.push('top 3 changes between runs');\n  if (top1_same < 1) fails.push('#1 changes between runs');\n  if (pay_rule_ok < 1) fails.push('#1 not fairly paid while income matters');\n  if (pay_not_bottom_third < 1) fails.push('#1 among the lowest-paid third while income matters');\n  if (form_fit < 1) fails.push('fewer than 2 of the top 3 in a ticked form');\n  if (variety_ok < 1) fails.push('top 3 repeats an activity');\n  const verdict = fails.length ? 'FAIL: ' + fails.join('; ') : 'PASS';\n\n  return { json: {\n    persona: src.persona, report_id: src.report_id,\n    runs_ok, top3_stability, top1_same, pay_rule_ok, pay_not_bottom_third, form_fit, variety_ok,\n    top3_run1: (tops[0] || []).join(' | '), top3_run2: (tops[1] || []).join(' | '), top3_run3: (tops[2] || []).join(' | '),\n    verdict,\n    details: JSON.stringify({ needs_income: needsIncome, forms_ticked: facts.forms || [], forms_check_applies: !!formsApply, unlabeled_titles: unlabeled,\n      scores: ok.map(r => r.top3.map(t => `${t.title} ${t.score}`)), errors: runs.filter(r => !(Array.isArray(r.top3) && r.top3.length === 3)).map(r => r.error || 'no top 3') })\n  } };\n});\n" } } });

const insertVals = { checked_at: expr('{{ $now.toISO() }}'), persona: expr('{{ $json.persona }}'), report_id: expr('{{ $json.report_id }}'), runs_ok: expr('{{ $json.runs_ok }}'), top3_stability: expr('{{ $json.top3_stability }}'), top1_same: expr('{{ $json.top1_same }}'), pay_rule_ok: expr('{{ $json.pay_rule_ok }}'), pay_not_bottom_third: expr('{{ $json.pay_not_bottom_third }}'), form_fit: expr('{{ $json.form_fit }}'), variety_ok: expr('{{ $json.variety_ok }}'), top3_run1: expr('{{ $json.top3_run1 }}'), top3_run2: expr('{{ $json.top3_run2 }}'), top3_run3: expr('{{ $json.top3_run3 }}'), verdict: expr('{{ $json.verdict }}'), details: expr('{{ $json.details }}') };
const insertSchema = [{ id: 'checked_at', displayName: 'checked_at', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'dateTime' }, { id: 'persona', displayName: 'persona', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' }, { id: 'report_id', displayName: 'report_id', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' }, { id: 'runs_ok', displayName: 'runs_ok', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'number' }, { id: 'top3_stability', displayName: 'top3_stability', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'number' }, { id: 'top1_same', displayName: 'top1_same', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'number' }, { id: 'pay_rule_ok', displayName: 'pay_rule_ok', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'number' }, { id: 'pay_not_bottom_third', displayName: 'pay_not_bottom_third', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'number' }, { id: 'form_fit', displayName: 'form_fit', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'number' }, { id: 'variety_ok', displayName: 'variety_ok', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'number' }, { id: 'top3_run1', displayName: 'top3_run1', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' }, { id: 'top3_run2', displayName: 'top3_run2', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' }, { id: 'top3_run3', displayName: 'top3_run3', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' }, { id: 'verdict', displayName: 'verdict', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' }, { id: 'details', displayName: 'details', required: false, defaultMatch: false, display: true, canBeUsedToMatch: true, type: 'string' }];

const saveResult = node({ type: 'n8n-nodes-base.dataTable', version: 1.1, config: {
  name: 'Save to results history', position: [1680, 0],
  parameters: { resource: 'row', operation: 'insert', dataTableId: RS,
    columns: { mappingMode: 'defineBelow', value: insertVals, matchingColumns: [], schema: insertSchema, attemptToConvertTypes: false, convertFieldsToString: false } } } });

const isEval = node({ type: 'n8n-nodes-base.evaluation', version: 4.8, config: {
  name: 'Running as evaluation?', position: [1920, 0],
  parameters: { operation: 'checkIfEvaluating' } } });

const setOutputs = node({ type: 'n8n-nodes-base.evaluation', version: 4.8, config: {
  name: 'Write top 3 to dataset', position: [2160, -100],
  parameters: { operation: 'setOutputs', source: 'dataTable', dataTableId: DS,
    outputs: { values: [
      { outputName: 'top3_runs', outputValue: expr("{{ $('Compute checks').item.json.top3_run1 + ' // ' + $('Compute checks').item.json.top3_run2 + ' // ' + $('Compute checks').item.json.top3_run3 }}") },
      { outputName: 'verdict', outputValue: expr("{{ $('Compute checks').item.json.verdict }}") } ] } } } });

const setMetrics = node({ type: 'n8n-nodes-base.evaluation', version: 4.8, config: {
  name: 'Report metrics', position: [2400, -100],
  parameters: { operation: 'setMetrics', metric: 'customMetrics',
    metrics: { assignments: [{ id: 'm0', name: 'runs_ok', value: expr("{{ $('Compute checks').item.json.runs_ok }}"), type: 'number' }, { id: 'm1', name: 'top3_stability', value: expr("{{ $('Compute checks').item.json.top3_stability }}"), type: 'number' }, { id: 'm2', name: 'top1_same', value: expr("{{ $('Compute checks').item.json.top1_same }}"), type: 'number' }, { id: 'm3', name: 'pay_rule_ok', value: expr("{{ $('Compute checks').item.json.pay_rule_ok }}"), type: 'number' }, { id: 'm4', name: 'pay_not_bottom_third', value: expr("{{ $('Compute checks').item.json.pay_not_bottom_third }}"), type: 'number' }, { id: 'm5', name: 'form_fit', value: expr("{{ $('Compute checks').item.json.form_fit }}"), type: 'number' }, { id: 'm6', name: 'variety_ok', value: expr("{{ $('Compute checks').item.json.variety_ok }}"), type: 'number' }] } } } });

export default workflow('encore-eval-wf3p', 'EVAL - Encore WF3P scoring checks')
  .add(evalTrigger).to(makeRuns)
  .add(apiTrigger).to(pickRows).to(getRows).to(filterRows).to(makeRuns)
  .add(makeRuns).to(runCore).to(checks).to(saveResult).to(isEval).to(setOutputs).to(setMetrics);
