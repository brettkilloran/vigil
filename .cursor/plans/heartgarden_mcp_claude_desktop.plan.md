# Plan: Heartgarden MCP works with Claude Desktop (remote connector)

**Status:** draft execution plan  
**Product goal:** A paid Claude user can add Heartgarden as a **remote MCP connector** in **Claude Desktop** and reliably use **`heartgarden_*` tools** against the deployed app (e.g. `heartgarden.vercel.app`), authenticated with **`HEARTGARDEN_MCP_SERVICE_KEY`**.

**Non-goals (for this plan):** OAuth/DCR for third-party IdPs (only if product later requires it); replacing stdio **`npm run mcp`** for local dev.

---

## 1. Definition of done (acceptance)

| # | Criterion |
|---|-----------|
| A | **Claude Desktop** (current release) can **register** the connector using the documented URL shape without opaque “Server not found” / broker errors attributable to misconfiguration on our side. |
| B | After registration, **tools list** includes Heartgarden tools (names match `heartgarden_*` / server implementation; legacy `vigil_*` still works on **call**). |
| C | Invoking at least **one read tool** (e.g. search or list) returns a **successful tool result** against **production** data (or documented test space). |
| D | **Write** tools remain gated by **`HEARTGARDEN_MCP_WRITE_KEY`** as today; documented and tested. |
| E | **Vercel Production** has **`HEARTGARDEN_MCP_SERVICE_KEY`** set; boot gate behavior for **`/api/*`** with Bearer is unchanged and documented. |
| F | A **repeatable QA checklist** lives in-repo (this plan + **`heartgarden/docs/API.md`** pointers) so any engineer can verify after a deploy. |

---

## 2. Current implementation (baseline)

- **Transport:** `GET|POST|DELETE` **`/api/mcp`** — **`WebStandardStreamableHTTPServerTransport`**, **stateless** (`sessionIdGenerator: undefined`) — [`heartgarden/app/api/mcp/route.ts`](../../heartgarden/app/api/mcp/route.ts).
- **Auth (handler):** Bearer, `?token=` / `?key=`, or `X-Heartgarden-Mcp-Token` — [`heartgarden/src/lib/heartgarden-mcp-service-key.ts`](../../heartgarden/src/lib/heartgarden-mcp-service-key.ts).
- **Middleware:** `/api/mcp` allowed through boot gate — [`heartgarden/middleware.ts`](../../heartgarden/middleware.ts).
- **Client quirks addressed:** `Accept` merging for Streamable HTTP; path-only `request.url` query parsing; **browser tab** GET returns HTML info page (Sec-Fetch `navigate` + `document`) so humans are not confused with MCP errors.
- **Shared tool surface:** [`heartgarden/src/lib/mcp/heartgarden-mcp-server.ts`](../../heartgarden/src/lib/mcp/heartgarden-mcp-server.ts); stdio [`heartgarden/scripts/mcp-server.ts`](../../heartgarden/scripts/mcp-server.ts).

---

## 3. Constraints from Claude (remote MCP)

Per **Anthropic docs** (remote connectors):

- Remote MCP traffic is **brokered from Anthropic’s cloud**, not from the user’s laptop IP. The server must be **public HTTPS** and reachable from **Anthropic egress IPs** (see [Anthropic IP addresses](https://docs.anthropic.com/en/api/ip-addresses)).
- **Claude Desktop** is expected to add **remote** servers via **Settings / Customize → Connectors** (claude.ai), **not** only via legacy `claude_desktop_config.json` for remote URLs.
- **Streamable HTTP** and **SSE** are supported; SSE may be deprecated later — we standardize on **Streamable HTTP** already.

**Implication:** Failures whose JSON envelope is **`type: "error"`**, **`not_found_error`**, **`request_id`** are **primarily on Anthropic’s connector/broker side**; we still **prove** our endpoint is correct (status codes, MCP initialize, tools) so support escalations are grounded.

---

## 4. Risk register (what actually breaks “Desktop works”)

| Risk | Symptom | Mitigation in plan |
|------|---------|---------------------|
| R1 | User tests by **opening URL in a browser** | Already mitigated with HTML info page; document that **browser ≠ MCP client**. |
| R2 | **Wrong connector surface** (json vs Connectors UI) | QA uses **official Desktop + Connectors** path only. |
| R3 | **Auth not sent** by broker (query stripped, wrong header) | Verify with Vercel logs + add **correlation id** logging (optional) on `/api/mcp` (no secrets). |
| R4 | **Streamable HTTP / protocol version** mismatch | Run **MCP Inspector** against prod URL; compare `MCP-Protocol-Version` behavior with SDK tests. |
| R5 | **Stateless** transport vs client expecting sessions | Confirm initialize + tool calls work without sticky session (current design). |
| R6 | **Deployment / env** | Confirm Production env in Vercel; not Preview-only vars. |

---

## 5. Workstreams

### WS-A — Document the exact Claude Desktop path (owner: docs + one manual verify)

1. Record **app version** and **OS** used for the golden path screenshot or checklist.
2. Steps: **Claude Desktop → Customize / Connectors → Add** → URL = `https://<prod-host>/api/mcp?token=<URL-encoded key>` (or Bearer if UI supports custom headers — if not, token-in-URL is canonical).
3. Note **Free vs Pro** limits (connectors count); confirm test on **paid** account per product requirement.

**Deliverable:** Short **“Claude Desktop + Heartgarden MCP”** subsection in **`heartgarden/docs/API.md`** or **`heartgarden/AGENTS.md`** (pointer only; avoid duplicating env matrix). Links: [`heartgarden/docs/API.md`](../../heartgarden/docs/API.md), [`heartgarden/AGENTS.md`](../../heartgarden/AGENTS.md).

### WS-B — Automated / scripted verification (owner: engineering)

1. **Contract tests** (existing + extend): keep **`heartgarden/app/api/mcp/route.test.ts`** and service-key tests green; add cases for **POST initialize** mock if feasible without full SDK integration (or lightweight integration test hitting handler with **fake** key in test env).
2. **MCP Inspector** (optional): [MCP Inspector](https://github.com/modelcontextprotocol/inspector) against **`https://heartgarden.vercel.app/api/mcp?token=…`** — initialize OK, tools listed.
3. **Shipped:** **`npm run mcp:smoke`** → **`heartgarden/scripts/mcp-prod-smoke.ts`** (SDK **`StreamableHTTPClientTransport`** + **`Client`**; env **`HEARTGARDEN_MCP_SERVICE_KEY`**, optional **`HEARTGARDEN_MCP_URL`**).

**Deliverable:** `mcp:smoke` + docs (**`docs/API.md`**, **`AGENTS.md`**, **`docs/DEPLOY_VERCEL.md`**); CI optional (secret not in CI).

### WS-C — Observability (owner: engineering)

1. **Vercel:** Ensure `/api/mcp` can be filtered in logs; document **expected** status codes: 401 (no auth), 503 (no server key), 200/406/415 from SDK for bad clients.
2. **No PII / no token logging** — only method, path, status, optional **`x-request-id`** if Vercel adds it.

**Deliverable:** One paragraph in **`docs/DEPLOY_VERCEL.md`** or API doc: “how to debug MCP in prod logs”.

### WS-D — Compatibility hardening (only if WS-B fails)

Priority order:

1. **`OPTIONS` / CORS** — only if Inspector or Claude broker sends browser-style preflight (unlikely for server-to-server); implement only with evidence.
2. **`.well-known/mcp` discovery** — optional metadata endpoint if Claude begins requiring discovery (spec is evolving); **404 is OK** per SEP fallback — add only if broker requires it.
3. **OAuth** — out of scope unless Anthropic mandates OAuth for this connector class.

### WS-E — Escalation path with Anthropic

If WS-B proves our endpoint **initialize + tools/list** works but Desktop still shows **`not_found_error`**:

1. Capture **`request_id`**, timestamp, connector URL (redact token), Claude Desktop version.
2. Open support ticket with Anthropic; attach **Inspector** success screenshot and **curl** transcript.

---

## 6. QA checklist (run after each MCP-touched deploy)

1. **Production env:** `HEARTGARDEN_MCP_SERVICE_KEY` present (Vercel **Production**).
2. **Smoke:** `GET https://<host>/api/mcp` **without** token → **401** (not 404).
3. **Smoke:** `POST` `initialize` + `tools/list` with valid token and correct headers → **200**, JSON-RPC **result** (run script or Inspector).
4. **Claude Desktop:** Add connector → open chat → invoke **one tool** → success.
5. **Regression:** **`npm run mcp`** (stdio) still works locally against dev or prod URL per **`AGENTS.md`**.

---

## 7. Open questions (resolve during execution)

1. Does the **current** Claude Desktop Connectors UI pass **query parameters** through to the broker unchanged (required for `?token=`)?
2. Are there **multiple** connector types (SSE vs Streamable) in UI — which must users pick?
3. Should we publish a **minimal** `GET /.well-known/mcp` JSON for `streamable_http` endpoint discovery preemptively?

---

## 8. Suggested order of operations

1. Run **WS-B** (Inspector + optional smoke script) against **production** — pass/fail is the gate.
2. If pass, run **WS-A** QA on Claude Desktop once; update docs with exact steps.
3. If fail, use **WS-D** in order until Inspector passes; then retry Desktop.
4. If Inspector passes and Desktop fails, execute **WS-E**.

---

## References (in-repo)

- [`heartgarden/docs/API.md`](../../heartgarden/docs/API.md) — MCP route + env vars  
- [`heartgarden/docs/VERCEL_ENV_VARS.md`](../../heartgarden/docs/VERCEL_ENV_VARS.md) — `HEARTGARDEN_MCP_*`  
- [`heartgarden/app/api/mcp/route.ts`](../../heartgarden/app/api/mcp/route.ts) — HTTP transport  

External: [Build custom connectors via remote MCP servers](https://support.claude.com/en/articles/11503834-build-custom-connectors-via-remote-mcp-servers), [Anthropic IP addresses](https://docs.anthropic.com/en/api/ip-addresses).
