# ADR-0004: Layered Release Integrity

- Status: Accepted
- Decision date: 2026-07-21
- Documented: 2026-08-03

## Context

下载服务需要证明“资产与发布清单一致”，而操作系统还需要判断“可执行文件来自受信发布者”。单独的 SHA-256、manifest signature 或平台代码签名都不能覆盖全部边界。

## Decision

1. 发布资产记录 SHA-256 和大小。
2. 服务对 canonical release manifest 使用 Ed25519 签名，并暴露 public key。
3. 客户端/launcher 在运行更新前验证 manifest signature，再验证资产 hash。
4. Windows Authenticode 和 macOS notarization 作为独立平台信任层，不能用 Ed25519 manifest 替代。
5. manifest 只把真实存在且经过验证的资产声明为 available。

## Consequences

- 镜像/CDN 可分发资产，同时保持端到端 manifest integrity。
- signing private key 生命周期和 public-key rotation 成为生产职责。
- 当前仓库已实现 Ed25519 和 Windows ZIP/hash；launcher 更新验证、平台代码签名、macOS/Linux 产物仍未完成。

## Evidence

- Implementation: `app/lib/signer.mjs`, `app/server.mjs`, `scripts/package-release.mjs`
- Metadata: `product/releases.json`
- Tests: `tests/signer.test.mjs`, `tests/admin-api.test.mjs`

