import json,sys
a=json.load(open('wf3p.json'))['workflow']; b=json.load(open('core.json'))['workflow']
A={n['name']:n for n in a['nodes']}; B={n['name']:n for n in b['nodes']}
bad=0
for name,n in B.items():
    if name in ('Start (report_id)','Return result'): continue
    o=A[name]
    for k in ('type','typeVersion','parameters','credentials','retryOnFail','maxTries','waitBetweenTries','alwaysOutputData','executeOnce','onError'):
        if o.get(k)!=n.get(k):
            bad+=1; print('DIFF',name,k, json.dumps(o.get(k))[:120], '||', json.dumps(n.get(k))[:120])
# connections
def edges(w,keep):
    s=set()
    for src,t in w['connections'].items():
        for ct,outs in t.items():
            for i,tg in enumerate(outs):
                for x in tg or []:
                    if src in keep and x['node'] in keep: s.add((src,ct,i,x['node'],x['index']))
    return s
keep=set(B)-{'Start (report_id)','Return result'}
ea,eb=edges(a,keep),edges(b,keep)
print('missing',ea-eb,'extra',eb-ea)
print('diffs',bad, 'nodes',len(B))
