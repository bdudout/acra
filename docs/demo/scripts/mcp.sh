#!/bin/bash
# Client MCP minimal de la démo : mcp.sh <outil> '<arguments JSON>' → appel tools/call au serveur MCP d'ACRA.
# Clé lue dans .acra-test-memory/mcp-demo.json (ignoré par git) ; URL : ACRA_MCP_URL (défaut http://localhost:3005/api/mcp).
R=$(cd "$(dirname "$0")/../../.." && pwd)
K=$(python3 -c "import json;print(json.load(open('$R/.acra-test-memory/mcp-demo.json'))['cle'])")
U=${ACRA_MCP_URL:-http://localhost:3005/api/mcp}
BODY=$(python3 -c "import json,sys;print(json.dumps({'jsonrpc':'2.0','id':1,'method':'tools/call','params':{'name':sys.argv[1],'arguments':json.loads(sys.argv[2])}}))" "$1" "$2")
curl -s "$U" -H "Authorization: Bearer $K" -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d "$BODY" \
 | python3 -c "import sys,json;r=json.load(sys.stdin);res=r.get('result');print((('ERREUR: ' if res.get('isError') else '')+res['content'][0]['text']) if res else json.dumps(r))"
