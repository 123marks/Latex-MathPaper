# T1.2 Public Sections Design

Date: 2026-08-07
Status: Executed and verified on 2026-08-07; retained as the T1.2 design record

## Goal and boundaries

T1.2 turns repeated public-site composition into seven reusable components and proves the abstraction by rebuilding Home's post-Hero story. The result must preserve T1.1 product truth and add the missing five-node workflow, neutral comparison, audience wall, FAQ, and final CTA. It must not claim real customers, local model inference, released macOS/Linux binaries, benchmarked compile times, global Evidence support, or completed T3.3/T3.6 work.

The components live under `web/src/components/public/`. This keeps editorial public composition separate from low-level `ui/` primitives and Pack-aware `motifs/`. Call sites import modules directly; no new dependency or public barrel is introduced.

## Approaches considered

1. **Explicit semantic components (selected).** Seven small components own stable markup and classes while Home owns truthful data and page order. This provides reuse, inspectable HTML, and small reviewable files.
2. **Schema-driven section renderer (rejected).** A generic JSON-to-page engine could render every section, but it would hide document semantics, complicate ReactNode headings/actions, and create an abstraction before more than one page has migrated.
3. **CSS-only extraction (rejected).** Keeping all markup in Home and only renaming classes would reduce little duplication and would not satisfy the reusable-component acceptance criterion.

## Component contracts

- `SectionHead({ eyebrow, title, description, align, id, className })` renders a `header`, an eyebrow, one `h2`, and an optional lede. `title` accepts ReactNode so editorial emphasis remains at the page boundary. `align` is limited to `left` or `center`.
- `StatRow({ items, className, label })` renders a labelled `dl`. Each item has `id`, `value`, and `label`; string values are first-class so no count-up or fabricated KPI is required.
- `WorkflowRibbon({ nodes, evidence, label, className })` renders an `ol` of five ordered nodes and an optional labelled `ul` of Evidence categories. Nodes accept an Icon registry name, title, description, and code/file hint. Existing `Reveal` supplies staged entry and reduced-motion fallback.
- `FeatureCard({ number, icon, title, description, wide, className })` renders an `article` with stable DOM order. `wide` changes only grid span; it never changes reading order.
- `FAQ({ items, label, className })` renders native `details/summary` disclosures. This gives keyboard and expanded-state semantics without a client state machine. Questions and answers must be non-empty.
- `LogoWall({ items, label, description, className })` renders a neutral `section` and list of audience/context labels. It must not present the labels as customers, endorsements, or real logos.
- `CtaBand({ eyebrow, title, description, actions, className })` renders an `aside` with an inert Horizon glow. Router links remain caller-owned so the component is not coupled to navigation.

Array-based components validate their public contract and fail clearly on malformed input. Validation stays local and minimal: required labels/text, non-empty arrays where content is required, valid SectionHead alignment, and supported icon names remain governed by the existing Icon registry.

## Home composition and visual direction

The Hero keeps its established two-column composition. Its local `HeroStat` is deleted and replaced by `StatRow` while retaining the `hero-meta` class for visual continuity.

After the Hero, Home becomes an editorial sequence rather than repeated three-card marketing grids:

1. Six `FeatureCard` items form the existing asymmetric twelve-column bento.
2. `WorkflowRibbon` presents the specified five-step path: instruction, Skills/MCP dispatch, local Workspace files, reviewable LaTeX diff, and PDF/Evidence verification. Four Evidence labels are explicitly Pack-dependent.
3. A comparison band uses the existing UI `Table` for neutral category-level facts: project location, compilation location, AI write control, Evidence semantics, and extensibility. It does not score products or claim universal competitor behavior.
4. `LogoWall` names use contexts such as research group and engineering team, not institutions.
5. `FAQ` answers provider boundary, platform status, and Pack capability scope in concrete language.
6. `CtaBand` closes with download and registration actions using current availability language.

CSS extends Horizon Atelier rather than creating a new theme: charcoal bands, restrained amber sequence connectors, cool-ink code hints, jade verification cues, editorial headings, and no nested cards. Workflow uses five columns at wide desktop, a two-column flow at 820-1100, and a vertical ordered path on phone. FAQ summaries maintain at least 44px interaction height. Decorative connectors/glow never intercept pointer input. All continuous connector motion stops under `prefers-reduced-motion`.

## Verification design

TDD begins with `tests/web-public-sections.test.mjs`. The first RED run must fail because the component modules do not exist. Focused tests then prove:

- all seven modules render independently;
- `SectionHead` heading structure and alignment validation;
- `StatRow` uses valid `dl/dt/dd` semantics and carries only supplied values;
- `WorkflowRibbon` uses ordered/list semantics, real icons, five supplied nodes, and labelled Evidence categories;
- `FeatureCard` preserves article semantics and wide modifier;
- FAQ uses keyboard-native disclosure markup and rejects missing question/answer text;
- LogoWall contains supplied neutral labels and no customer/endorsement language;
- CtaBand exposes caller-owned links and hides decoration from assistive technology;
- Home imports and renders every component, retains all T1.1 truth constraints, and contains no old local section-card loop;
- public CSS parses, defines 1440/1100/820/390 reflow, 44px FAQ targets, and reduced-motion stops.

Browser verification extends the existing Home smoke instead of relying only on SSR. It must assert no horizontal overflow or clipped copy at all four viewports, the workflow anchor still aligns, five workflow nodes render, FAQ can open from the keyboard, and Home has no browser errors. Screenshots require human inspection for hierarchy, awkward wrapping, repeated-card monotony, and mobile CTA collisions. Full Node/Python suites, Web/IDE builds, visual smoke, and strict Edge smoke remain final regression gates.

## Residual risks

- Native `details` rendering varies slightly by browser; CSS must style the summary marker without removing native keyboard behavior.
- The animated Horizon background makes raw PNG hashes frame-specific. Stable behavior evidence must continue to use `evidenceSha256`, while each PNG keeps its own point-in-time SHA.
- Home comparison copy can become stale as product capabilities change. Future edits must cross-check `docs/STATUS.md` and `docs/CAPABILITY_MAP.md`, not marketing intent.

## Execution result

T1.2 shipped the selected explicit-component approach without changing the approved boundaries. All seven components exist under `web/src/components/public/`, Home imports and uses each one, no dependency or schema renderer was introduced, and the rejected alternatives remain rejected. The implementation additionally tightened valid `dt -> dd` order, added a FAQ region landmark, reused the shared UI Table, and preserved Pack-dependent Evidence semantics.

The browser contract now records workflow columns `5/5/2/1`, visible connectors `4/4/0/4`, full-width comparison captions, `fullPageScrollY=0`, keyboard FAQ behavior, reduced-motion static states, and zero browser errors/overflow across 1440x900, 1100x720, 820x800, and 390x844. The 820px connector count of zero is an intentional two-column breakpoint contract, not missing evidence.

Final verification: focused responsive/accessibility contracts 14/14, full Node 134/134, Python 25/25, Web 2308 modules plus Desktop IDE bundle, visual smoke 13 keyframes/51 assets, Home Edge smoke, and strict browser visual smoke all passed. Visual review converged from 78 to 84 to 92 and ended `pass`.

The current stable behavior digest is `d5080b1f2451bf3725d6a497a6973ae2a32553a902841694acbf501e0db9840d`; the point-in-time report-file SHA-256 is `7de8da881c40173453e355df642d32d2f4c214158ee3726ecd5a07fc0924f7ca`. Raw PNG hashes remain separate by design. The next strict task is T1.3's remaining navigation work; T1.4-T1.5 follow, while T3.3 and T3.6 remain incomplete.
