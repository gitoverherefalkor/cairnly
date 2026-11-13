import json,sys
wf=json.load(open(sys.argv[1]))['workflow']
KEEP=["Add structure","Pull Init Summary","shortlist_careers","Pull Profile Sections","Combine Profile sections","ShortHisProf","Pull enriched","content in order","Extract encore evidence","Google Gemini Chat Model3","Renaming evidence","BatchingOC","Objective Compat score","OC Score","Google Gemini Chat Model","Step 1 scores","Merge","Code in JavaScript","Step 2 analysis","Step 2 - Final Score","Google Gemini Chat Model2","Ranking"]
ops=[]
for n in wf['nodes']:
    if n['name'] not in KEEP: continue
    nd={k:n[k] for k in ('name','type','typeVersion','parameters','position') if k in n}
    if n.get('credentials'): nd['credentials']=n['credentials']
    ops.append({"type":"addNode","node":nd})
    s={k:n[k] for k in ('retryOnFail','maxTries','waitBetweenTries','onError','alwaysOutputData','executeOnce') if k in n}
    if s: ops.append({"type":"setNodeSettings","nodeName":n['name'],"settings":s})
for src,types in wf['connections'].items():
    if src not in KEEP: continue
    for ctype,outs in types.items():
        for si,targets in enumerate(outs):
            for t in targets or []:
                if t['node'] in KEEP:
                    o={"type":"addConnection","source":src,"target":t['node'],"sourceIndex":si,"targetIndex":t['index']}
                    if ctype!='main': o['connectionType']=ctype
                    ops.append(o)
ops.append({"type":"addConnection","source":"Start (report_id)","target":"Add structure"})
ops.append({"type":"addConnection","source":"Ranking","target":"Return result"})
ops.append({"type":"setWorkflowSettings","settings":{"executionOrder":"v1","callerPolicy":"workflowsFromSameOwner"}})
json.dump(ops,open('ops.json','w'))
print(len(ops), sum(1 for o in ops if o['type']=='addConnection'))
