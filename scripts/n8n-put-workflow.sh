#!/usr/bin/env bash
# Push an edited Cairnly n8n workflow to the live instance as a DRAFT.
#
#   scripts/n8n-put-workflow.sh <workflowId> <body.json>
#
# Why this exists: editing a workflow through the n8n MCP connector means the
# whole node text has to pass through the assistant's context, which is slow and
# expensive for 20k-character prompts. This script lets a session send an edited
# workflow file directly, while staying narrow enough to allow in
# .claude/settings.local.json (it can do nothing except PUT a known workflow).
#
# Safety:
# - Only the workflow IDs listed below are accepted.
# - The API key is read from .env.local here, so it never appears in a command.
# - The live version is saved to n8n_wfs_cairnly/backups/ BEFORE the PUT.
# - The body is reduced to {name, nodes, connections, settings} and settings to
#   the 8 keys the public API accepts (see memory reference_n8n_public_api_put_settings).
# - A PUT saves a draft. Production keeps running the old version until it is
#   published (n8n MCP publish_workflow or the editor). The script prints both
#   version ids so you can see that.
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "usage: scripts/n8n-put-workflow.sh <workflowId> <body.json>" >&2
  exit 2
fi
WF_ID="$1"
BODY_FILE="$2"

# Known Cairnly workflows (n8n_wfs_cairnly exports, 2026-10-15). Add new ones on purpose.
case "$WF_ID" in
  FbsruPbuZI2Fgtc8|myWIhgaahAXD2ULz|0Z8WxV5tVFMJqIZt|vVv0tsnFlBnarMdq|zhgJuiDp60PS5ZKJ|\
  seWmQPFQqIe60TkU|h7ie9zN080IM2g7N|wPBE2wIwDaj6Wy8D|CyyjL7D51NbVZNtL|ohNbCw7pVqvjCZHT|\
  Bx0uNW4gnnXIGO8j|IFhL4Lno0hyMJ1Jc|M9w7xWeiPNmU7ZFb|bL82tYqEne0gKNIa|JXOW9lwv9MKPp9Cy|\
  TNlRk9vah0xqSIZn) ;;
  *) echo "refused: $WF_ID is not a known Cairnly workflow id" >&2; exit 2 ;;
esac

[ -f "$BODY_FILE" ] || { echo "body file not found: $BODY_FILE" >&2; exit 2; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.local"
N8N_API_KEY="$(grep -E '^N8N_API_KEY=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | sed -e "s/^['\"]//" -e "s/['\"]$//")"
[ -n "$N8N_API_KEY" ] || { echo "N8N_API_KEY missing from $ENV_FILE" >&2; exit 2; }

BASE="https://falkoratlas.app.n8n.cloud/api/v1/workflows/$WF_ID"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# 1. Back up the live workflow first.
curl -sS -f -H "X-N8N-API-KEY: $N8N_API_KEY" "$BASE" -o "$TMP/live.json"
STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP="$REPO_ROOT/n8n_wfs_cairnly/backups/${WF_ID}_pre_put_${STAMP}.json"
cp "$TMP/live.json" "$BACKUP"

# 2. Build the PUT body: only the allowed top-level keys and settings keys.
if ! python3 - "$BODY_FILE" "$TMP/live.json" "$TMP/put.json" <<'PY'
import json, sys
body = json.load(open(sys.argv[1]))
live = json.load(open(sys.argv[2]))
if body.get("id") not in (None, live.get("id")):
    sys.exit(f"refused: body file is workflow {body.get('id')}, not {live.get('id')}")
for k in ("nodes", "connections"):
    if k not in body:
        sys.exit(f"refused: body has no '{k}'")
ALLOWED = {"saveExecutionProgress", "saveManualExecutions", "saveDataErrorExecution",
           "saveDataSuccessExecution", "executionTimeout", "errorWorkflow", "timezone",
           "executionOrder"}
settings = {k: v for k, v in (body.get("settings") or live.get("settings") or {}).items() if k in ALLOWED}
out = {"name": body.get("name") or live["name"], "nodes": body["nodes"],
       "connections": body["connections"], "settings": settings}
json.dump(out, open(sys.argv[3], "w"), ensure_ascii=False)
old = {n["name"] for n in live["nodes"]}; new = {n["name"] for n in body["nodes"]}
changed = [n["name"] for n in body["nodes"]
           if n["name"] in old and n != next(m for m in live["nodes"] if m["name"] == n["name"])]
print(f"nodes changed: {changed or 'none'} | added: {sorted(new - old) or 'none'} | removed: {sorted(old - new) or 'none'}")
PY
then
  rm -f "$BACKUP"   # refused before anything was sent: no backup needed
  exit 1
fi

# Dry run: stop before changing anything (N8N_DRY_RUN=1 scripts/n8n-put-workflow.sh ...).
if [ "${N8N_DRY_RUN:-0}" = "1" ]; then
  rm -f "$BACKUP"
  echo "dry run: body OK ($(wc -c < "$TMP/put.json") bytes), nothing sent, no backup kept"
  exit 0
fi

# 3. PUT and report.
HTTP=$(curl -sS -o "$TMP/resp.json" -w "%{http_code}" -X PUT \
  -H "X-N8N-API-KEY: $N8N_API_KEY" -H "Content-Type: application/json" \
  --data-binary @"$TMP/put.json" "$BASE")
if [ "$HTTP" != "200" ]; then
  echo "PUT failed (HTTP $HTTP):" >&2
  head -c 600 "$TMP/resp.json" >&2; echo >&2
  echo "nothing changed; backup kept at $BACKUP" >&2
  exit 1
fi
python3 - "$TMP/resp.json" "$BACKUP" <<'PY'
import json, sys
r = json.load(open(sys.argv[1]))
same = r.get("versionId") == r.get("activeVersionId")
print(f"saved: {r.get('name')} | draft {str(r.get('versionId'))[:8]} | live {str(r.get('activeVersionId'))[:8]}"
      f" | {'LIVE ALREADY MATCHES' if same else 'NOT LIVE YET: publish to go live'}")
print(f"backup of the previous live version: {sys.argv[2]}")
PY
