# MCP Security Policy

MCP is useful for giving agents tool access, but it also increases attack surface. Use the smallest useful set of servers.

## Default Policy

- Start without MCP for the MVP workflow.
- Add filesystem access only when scoped to this workspace or a single contest folder.
- Add fetch/search only for official rules, documentation, and source retrieval.
- Add command execution only when the runtime already has sandboxing and approval behavior.
- Do not run unknown MCP servers from random repositories during contest time.

## Recommended Order

1. `filesystem-workspace`
2. `fetch`
3. `git`
4. `time`
5. browser automation, only if PDF/dashboard visual checks are needed
6. database servers, only if contest data volume justifies them

## Red Lines

- No broad filesystem scope such as `C:\` or user home.
- No unreviewed remote MCP server with write tools.
- No blind server installation from a marketplace.
- No exposing contest data to third-party services unless the contest rules allow it.
- No command-execution server without a clear approval/sandbox model.

## Review Checklist

- [ ] Server source is official or reviewed.
- [ ] Write capabilities are necessary.
- [ ] Filesystem scope is minimal.
- [ ] Network behavior is understood.
- [ ] Secrets and private data are not exposed.
- [ ] The server can be disabled quickly.

## Sources

- Official MCP reference servers repository: https://github.com/modelcontextprotocol/servers
- MCP architecture docs: https://modelcontextprotocol.io/docs/learn/architecture
