# AI Memory Options — Review Document

**Purpose:** Compare ways to give your AI coding assistants persistent memory across sessions, so you never have to re-explain the project or re-state rules.
**Setup this applies to:** Repo edited in **Cursor**, coded via **Freebuff** (this chat/CLI) with the model you choose. Git-tracked repo, Windows dev machine + Mac, Electron + React + TypeScript.
**Status:** **Option A is now implemented in this repo** (AGENTS.md + session protocol in knowledge.md + .cursor/rules). This doc remains as the comparison reference; Options B–D are not set up. Update or delete this file if you want to keep the repo tidy.

---

## 0. How memory works in your tools right now (verified)

Before choosing, understand what your two tools already do automatically:

| Capability | Freebuff | Cursor |
|---|---|---|
| Auto-read project files | **`knowledge.md` first, then `AGENTS.md`, then `CLAUDE.md`** (per directory; picks one) | `.cursor/rules/*.mdc` + `AGENTS.md` (auto-loaded) |
| Global (cross-project) files | `~/.knowledge.md`, `~/.AGENTS.md`, `~/.CLAUDE.md` | "User Rules" (global, in-app) |
| Auto-writes memory itself | Updates *existing* knowledge files if asked; never creates them | No auto-memory at all |
| Recalling past chats | `/history` command | Chat history (per session only) |

**Key insight:** Freebuff already reads `knowledge.md` at the start of every session — which is why this repo's `knowledge.md` + `handoff.md` pattern *is* a working memory system. The question is how far you want to take it.

---

## Option A — Git-tracked file memory (AGENTS.md standard)

**What it is:** Plain markdown files in the repo that every AI tool auto-reads. This is the emerging open standard (the AGENTS.md spec, adopted by Cursor, GitHub Copilot, Codex, Windsurf, Codebuff/Freebuff, and more).

**Files you'd have:**
- `AGENTS.md` (repo root) — the cross-tool entry point. Cursor auto-loads it; Freebuff would too if `knowledge.md` didn't already exist. Keep it short and point at the detail files.
- `knowledge.md` — *already exists.* Freebuff auto-reads it. Holds commands, architecture, constraints, gotchas.
- `handoff.md` — *already exists.* The session log ("what was done, what's next"). 
- `docs/decisions/` (optional) — one file per meaningful architectural decision (like ADRs).
- `.cursor/rules/*.mdc` (optional) — Cursor-specific, path-scoped rules (e.g., apply only under `src/main/**`).
- `~/.AGENTS.md` or `~/.knowledge.md` (optional, in your home dir) — rules that apply to **every** project ("always use pnpm", "never commit .env").

**The one missing trick — a "Session protocol" rule.** Because Freebuff updates existing knowledge files when asked, you add a rule to `knowledge.md` saying:

> At the start of every session: read `handoff.md` first, then this file. At the end of every session: update `handoff.md` with what was completed, and update this file with any new rules/gotchas discovered.

That single rule is what turns "files exist" into "memory that maintains itself" — the assistant refreshes the memory every session without you asking.

**Pros:**
- Works identically in **both** Cursor and Freebuff (and any future tool)
- Versioned in git — you can diff/revert memory changes; travels with the repo to your Mac
- Human-readable and auditable — you can read exactly what the AI "remembers"
- No software to install, no services running, no API keys, works offline
- Path-scoped rules via `.cursor/rules` give surgical control

**Cons:**
- Memory is only as good as the ritual — if nobody updates `handoff.md`, it goes stale
- No automatic "the AI noticed something and saved it" behavior in Cursor (Freebuff can be instructed to)
- Files can bloat if rules aren't pruned; best practice is keeping each file < ~200 lines

**Cost:** $0. Effort: 30–60 min setup, then ~2 min per session.

---

## Option B — MCP memory server (knowledge graph, for Cursor)

**What it is:** A Model Context Protocol (MCP) server that gives Cursor's chat/agent a persistent, queryable knowledge graph. The official Anthropic reference server is `@modelcontextprotocol/server-memory` — free, MIT-licensed, runs locally, stores everything in a plain JSONL file (e.g. `memory.jsonl`).

**How it works:** The AI gets new tools: `create_entities`, `create_relations`, `add_observations`, `search_nodes`, `open_nodes`. As you work, it writes facts like *entity: "project" → observation: "uses pnpm, not npm"* and links them. Across chats and sessions, it reads these back. It survives editor restarts and new conversations.

**Install (Cursor only — config in `.cursor/mcp.json`):**
```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    }
  }
}
```
(Can also go in `~/.cursor/mcp.json` to apply to all your projects. Enable it in Cursor: Customize → MCP.)

**Pros:**
- Genuine *automatic* memory — the AI captures facts on its own while coding
- Small, free, local, private (data never leaves your machine)
- Structured retrieval (graph + search) beats a flat file for "recall specific fact"

**Cons:**
- **MCP connections are per-host** — a server configured in Cursor (`.cursor/mcp.json`) is only attached to *Cursor's* AI. Running Freebuff in Cursor's terminal does **not** give Freebuff access to Cursor's MCP servers; Freebuff is a separate process with its own tools.
- **However, Freebuff/Codebuff *does* natively support consuming external MCP servers** via its agent-definition system (`mcpServers` config block, stdio/HTTP transports, per-tool scoping with `toolNames`). So in principle you could register this memory server with Freebuff too — but you'd configure it in Freebuff's own agent config, not Cursor's, and it's unclear whether every Freebuff surface (e.g. this chat session) exposes that configuration.
- JSONL is machine-structured, not pleasant to read/review (unlike markdown)
- The reference server is basic — no vector search, no automatic cleanup/decay
- Extra dependency to configure on each machine (needs Node/npx available in Cursor's environment)

**Cost:** $0. Effort: ~15 min.

---

## Option C — Obsidian as a memory vault (MCP bridge)

**What it is:** Use an Obsidian vault as your knowledge base, and let the AI read/write it through an MCP server that talks to Obsidian.

**Two main bridges:**
1. **Local REST API plugin** (by coddingtonbear) — recent versions ship a **built-in MCP endpoint** at `/mcp/`. Point MCP clients at `http://127.0.0.1:27123` (or HTTPS `27124` with a self-signed cert + API key).
2. **`mcp-obsidian` / `obsidian-mcp-server`** — standalone MCP servers that wrap the same Local REST API (or read the vault folder directly) and expose search/read/append/patch tools.

**What you'd get:** The AI can create notes, append to a daily log, patch specific headings/frontmatter, and search your whole vault. You get the human side — graph view, backlinks, tags, a beautiful second brain for architecture notes, meeting notes, decisions, web clippings.

**Windows caveats (known friction):**
- Self-signed cert errors (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`) — often need to trust the cert or use the plain-HTTP port
- `uvx`/`npx` helper resolution failures in GUI-launched MCP hosts — may need absolute paths
- **Obsidian must be running** for the API/MCP to work; if it's closed or the PC sleeps, the AI's memory is offline

**Pros:** Best human experience (visual graph, wikilinks, tags); AI gets surgical edit tools; you may already use Obsidian.

**Cons:** App must stay running for the API/MCP path; most moving parts (plugin + API + MCP + certs); vault lives outside the repo unless you keep it inside (e.g. `docs/vault/`).

**MCP caveat:** MCP is per-host. A vault configured via Cursor's MCP serves *only Cursor's AI* — Freebuff in Cursor's terminal does not inherit it. Freebuff/Codebuff can consume MCP servers through its own agent-definition config, so it's not strictly Cursor-only, but you'd wire it up separately in Freebuff's config (availability depends on the Freebuff surface). **No-MCP fallback:** an Obsidian vault is just a folder of markdown files — Freebuff can read/write those `.md` files directly with its file tools, which works today in any terminal.

**Cost:** $0 (all open source; Obsidian free tier is fine). Effort: 30–90 min.

---

## Option D — Dedicated AI memory platforms (probably overkill, but for completeness)

| Tool | What it does | Local? | Fit for you? |
|---|---|---|---|
| **mem0** (OpenMemory) | "Universal memory layer" — extracts facts/preferences from conversations, stores with hybrid search (semantic + BM25 + entities). Has skills for coding tools. | Yes (needs a vector DB like Chroma/Qdrant, or Docker stack) | Overkill — memory lives outside the repo, background LLM extraction costs tokens, DB infra to maintain |
| **Letta / MemGPT** | Turns the agent itself into a stateful "memory OS" (core/recall/archival memory). Runs its own agent runtime. | Yes (local CLI, needs Node 22.19+) | Heaviest option — you'd be replacing your current agent loop with theirs, not adding memory to it |
| **Zep** (Graphiti) | Enterprise temporal knowledge graph — tracks how facts change over time. | Server + graph DB (Docker) | Way overkill for a solo dev; designed for production agent apps |
| **Claude Code Auto Memory** | Claude Code automatically writes project-pattern notes to a persistent store mid-session. | Yes | Only exists *inside Claude Code* — you'd have to use Claude Code instead of Freebuff/Cursor |
| **Windsurf Memories** | Global memory snippets saved from chat, reused across sessions. | Yes | Only inside Windsurf — doesn't help Cursor or Freebuff |
| **GitHub Copilot custom instructions** | `copilot-instructions.md` / `.github/copilot-instructions.md` auto-loaded. | File-based | Same idea as Option A but Copilot-only; A already covers you |

**Bottom line on D:** These are products for *building memory into applications you develop*, or lock you into one vendor's editor. None of them bridge your Cursor + Freebuff setup better than files do.

---

## Side-by-side comparison

| | A. Files (AGENTS.md) | B. MCP memory (Cursor) | C. Obsidian vault | D. Platforms |
|---|---|---|---|---|
| Works in Freebuff | ✅ (auto) | ⚠️ via Freebuff's own agent-def MCP config (surface-dependent) | ⚠️ same; or ✅ read vault `.md` files directly | ❌ |
| Works in Cursor | ✅ | ✅ | ✅ | ⚠️ vendor-specific |
| Automatic memory-writing | ⚠️ via ritual | ✅ | ⚠️ via tools | ✅ |
| Human-readable/reviewable | ✅✅ | ❌ | ✅ | ❌ |
| Git-versioned, portable | ✅ | ⚠️ (JSONL can be committed) | ⚠️ (if vault in repo) | ❌ |
| Offline / no services | ✅ | ✅ | ❌ (Obsidian must run) | ❌ (usually) |
| Setup effort | 30–60 min | 15 min | 30–90 min | Hours + infra |
| Long-term cost | $0 | $0 | $0 | $0–$$$ |

---

## Recommendation

**Start with A** — it's the only option that gives *both* tools memory, it's already half-built (`knowledge.md` + `handoff.md` exist), it's free, and it's the direction the whole industry converged on (AGENTS.md spec). The single highest-value change is adding the **session protocol** so the assistant updates the memory every session without being told.

**Add B later** only if Cursor's own chat keeps forgetting things mid-project — it's a 15-minute complement that gives Cursor organic self-written memory. Nothing about A conflicts with B.

**C (Obsidian)** is worth it only if you already maintain a personal vault and want a shared human/AI second brain — treat it as a layer on top, not a replacement.

**Skip D** for this project.

---

## If you pick A, this is what I'd create

1. `AGENTS.md` — ~40 lines: what the project is, the session protocol (read `handoff.md` + this, update them at session end), the non-negotiable rules (never commit `.env`, run `typecheck` + `test` before done, pnpm commands, keep v2 out of v1 paths), links to `knowledge.md`.
2. Add a short "Session protocol" section to the existing `knowledge.md`.
3. (Optional) `.cursor/rules/` with 2–3 path-scoped rules for Cursor (e.g. `src/main/**`, `src/renderer/**`).
4. (Optional) `~/.AGENTS.md` in your home dir for cross-project preferences.
5. (Optional) `docs/decisions/` for architecture decision records going forward.

Everything is git-tracked, so it syncs to your Mac via `git pull` and the AI on either machine starts every session already knowing the project.

---

**MCP note (updated):** MCP server connections are per-host. Cursor's MCP config only serves Cursor's AI — running Freebuff in Cursor's integrated terminal does not share those connections. Freebuff/Codebuff does natively support *consuming* external MCP servers via its agent-definition `mcpServers` config, so MCP-based memory isn't strictly Cursor-only; it just needs separate wiring per tool. The truly universal layer is files on disk.

*Created August 2, 2026. Sources: codebuff.com/docs (Freebuff/Codebuff knowledge-file behavior), github.com/CodebuffAI/codebuff (MCP agent-definition support, issues #764/#912), cursor.com/docs (Rules, MCP), modelcontextprotocol.io (memory server), Obsidian MCP project docs.*
