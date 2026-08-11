# T1.4 Public Pages Design

**Date:** 2026-08-07
**Scope:** Features.jsx, Pricing.jsx, Enterprise.jsx and their public-page CSS/tests.

## Goal

Finish the next approved public-site redesign atom with three pages that are
visually editorial and operationally honest. A maintainer should be able to
see which product facts are shipped, which are partial, and which require an
enterprise conversation without reverse-engineering the source.

## Product Boundary

Paper OS is a general-purpose local-first document IDE. Workspace files,
compilation, and local-tool output stay authoritative on the user's machine.
Model requests use a user-configured OpenAI-compatible provider; subscription
plans do not include provider token spend. The current AI path is reviewable
Preview -> Apply with path safety, mtime conflict detection, and rollback
compatibility behavior. Real-time collaboration, cloud sync, durable
EditTransaction semantics, SSO, RBAC, SLA, private deployment, and dedicated
support are not shipped guarantees.

## Design Direction

Use an editorial "field notes" composition: one strong thesis per page, quiet
charcoal surfaces, amber as a scarce signal, Playfair headings, and dense but
readable technical fragments. Page sections are full-width bands inside the
existing container; cards appear only for repeated plans/capabilities. No
nested cards, purple gradients, fake metrics, fake activity timelines, or
inline status that pretends to be running.

### Features

Hero title: 写作，不止生成。 Supporting copy names the Workspace Kernel and
reviewable automation. Five alternating deep dives:

1. Local LaTeX compile: Tectonic/latexmk, local build boundary, PDF preview.
2. Reviewable AI: Preview -> Apply, conflict protection, no implicit writes.
3. Evidence/Magnifier: Pack-scoped trace from claim to source/result/Artifact.
4. Skills/MCP: Capability-gated extensions and market link.
5. Team workspace: current Workspace/team API boundary, explicitly marked as
   planned for real-time collaboration rather than sold as delivered.

Each side uses either the real browser-app.png capture (copied to a stable
public asset) or a labelled static interface fragment. The page ends with a
download CtaBand.

### Pricing

Keep the four approved plan categories: free, professional, team, enterprise.
Do not publish the unreferenced CNY 39/CNY 99 values. Show price pending or
contact confirmation, a clear billing-period Segmented control, and the
approved year-save-two-months note qualified by "具体金额以正式发布为准".
The feature matrix uses the existing Table primitive. Only shipped/local or
clearly labelled partial/planned entitlements appear; BYOK/token ownership is
visible above the plans and repeated in FAQ.

### Enterprise

Keep the six requested topics findable: private deployment, SSO, audit/SLA,
RBAC, data boundary, and dedicated support. Every topic is qualified as
需评估 or 合同确认 unless it is an implemented security foundation.
Render a three-layer architecture strip:

- Current foundation: AES-256-GCM provider-key storage, path containment,
  loopback bootstrap/rate limits, and Ed25519 release manifests.
- Configurable boundary: compatible provider endpoint and operator-controlled
  secret/signing material.
- Deployment discussion: internal network, identity integration, roles, SLA,
  support, and update/signing chain scope.

The contact action is a normal mailto/manual handoff, never an automated sales
workflow.

## Component and CSS Strategy

Reuse SectionHead, FeatureCard where a repeated capability is real, Segmented,
Table, FAQ, CtaBand, Reveal, Icon, and existing tokens. Add only scoped classes
under pages.css for the alternating bands, pricing plans, enterprise
architecture strip, and shared product fragments. Preserve the existing 880px
header boundary, Table's 560px container query, 44px FAQ summary target, and
global reduced-motion rules.

## Alternatives Considered

1. Recommended: page-local data plus existing primitives. Smallest diff,
   truthful copy is visible in one file, and page-specific layout remains easy
   to test.
2. Generic PublicNarrative component. Rejected: three pages have different
   semantics (pricing matrix vs security boundary), so abstraction would hide
   content contracts and add indirection without reuse evidence.
3. Restyle existing card grids. Rejected: it cannot satisfy the five
   alternating Features narrative, the required billing interaction, or the
   Enterprise shipped/roadmap distinction.

## Acceptance Gates

- SSR/source contract covers all three pages, required headings, truthful
  boundary phrases, Segmented/Table/FAQ/CtaBand usage, and absence of forbidden
  claims.
- Real Edge smoke covers all three routes at 1440x900, 1100x720, 820x800,
  390x844, keyboard billing toggle, FAQ disclosure, reduced motion, no
  horizontal overflow, no browser errors, and the real image load.
- Existing focused/full Node, Python, Web build, IDE build, static smoke, and
  strict browser smoke remain green.
