# ADR-0002: Loopback Trust and One-Time Local Bootstrap

- Status: Accepted
- Decision date: 2026-07-15
- Documented: 2026-08-03

## Context

Paper OS 的桌面 WebView 和浏览器页面通过 loopback HTTP/WS 调本地 Node 服务。仅绑定 `127.0.0.1` 不能阻止恶意网页利用用户浏览器向本地端口发请求；无条件 `/api/auth/local` 也会把 owner provisioning 变成跨站可触发的入口。

## Decision

1. HTTP 和 WebSocket 在解析 cookie/处理路由前验证 loopback Host 和受信 Origin。
2. 拒绝 missing/duplicate/external Host、external Origin 和 `null` Origin。
3. Desktop local login 先 `GET /api/auth/bootstrap` 获得一次性 256-bit HttpOnly cookie，再 `POST /api/auth/local` 消费。
4. 成功或重放后 token 不可再次使用；local bootstrap 只用于明确的桌面启动握手。
5. 普通请求失败不自动重启 bootstrap，避免隐藏状态错误。

## Consequences

- 恶意网页不能只靠访问 loopback 端口触发 owner local login。
- Desktop boot 必须保持 bootstrap -> local 的顺序。
- WebView origin/CSP、代理和未来 deep-link 需要继续与本策略协调。
- 该策略不是完整 Workspace AuthZ/ACL，也不替代 OS-level desktop isolation。

## Evidence

- Implementation: `app/server.mjs`, `apps/desktop/src/ide.jsx`
- Tests: `tests/server-auth-security.test.mjs`, `tests/desktop-buffer-wiring.test.mjs`

## Rejected Alternatives

### Trust every request from localhost

Rejected because browsers can issue cross-origin requests to loopback services.

### Permanent shared local token in frontend assets

Rejected because bundled/static assets cannot keep a reusable secret.

