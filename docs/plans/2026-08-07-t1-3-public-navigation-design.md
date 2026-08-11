# T1.3 Public Navigation Design

## Status and Scope

This design closes only the remaining T1.3 public-navigation contract:

- compact glass state after `scrollY > 40`;
- one route-current semantic and a 2px amber indicator;
- `/download` as the only primary header CTA, labelled `下载桌面端`;
- preservation of the existing Icon menu, 880px breakpoint, Escape handling, first focus, focus restore, and cross-breakpoint close.

T1.1 Hero, T1.2 public sections, T3.3 ActionTimeline, T3.6 Workbench capture, route definitions, and authentication behavior are out of scope.

## Context

Paper OS is a local-first document IDE for researchers, engineers, technical writers, students, and teams. Public chrome must feel editorial, serious, restrained, and trustworthy. Navigation should keep the product visible and make the truthful download path obvious without becoming a second hero or a dense application toolbar.

The target contexts are 1440x900, 1100x720, 820x800, and 390x844, with mouse, touch, and keyboard input. Existing design tokens, React Router, and the current mobile menu are the implementation boundary.

## Approaches Considered

### A. Existing component plus one scroll modifier (recommended)

Keep `SiteHeader` and its menu effects. Add one passive scroll listener that derives `isScrolled` from `window.scrollY > 40`, apply `nav--scrolled`, and conditionally apply `glass-frost`. Let CSS own the visual transition. Continue using `NavLink` for `.active` and `aria-current="page"`. Keep the download link outside the auth branch so it is primary for every user state.

Benefits: smallest behavioral surface, no dependency, no router duplication, deterministic cleanup, and direct browser observability. This is the selected approach.

### B. CSS scroll-driven animation

Use scroll timelines to animate the header without React state. This reduces JavaScript but does not provide a reliable threshold state across the supported Edge/runtime matrix, complicates deterministic tests, and still does not solve CTA/auth composition. Rejected for compatibility and testability.

### C. Shared navigation controller hook

Create a reusable hook that combines location matching, scroll state, and menu lifecycle. This centralizes logic but duplicates `NavLink`, couples unrelated state machines, and creates an abstraction with no second consumer. Rejected as unnecessary scope.

## Selected Design

### State and lifecycle

`SiteHeader` gains `SCROLL_THRESHOLD = 40` and one `isScrolled` state. On mount, the effect evaluates the current offset, adds a passive `scroll` listener, and removes the same callback on unmount. It does not call `scrollTo`, prevent default scrolling, open a RAF loop, or alter the two existing menu effects.

The server and first client render remain in the rest state. A restored mid-page load converges in the mount effect without creating an SSR hydration mismatch.

### Visual state

The rest state is transparent, with stable rounded geometry. The compact state conditionally adds `glass-frost`, shadow, and a restrained transform using `--dur-3` and `--ease`. The transform creates visible contraction without animating height, padding, top, or width, so document layout remains stable.

Reduced motion keeps the state change but collapses transition duration through the existing global media rule. No scroll hijacking or ambient header animation is added.

### Current route

React Router `NavLink` remains the single route source. CSS selects `[aria-current="page"]`, giving the current link amber text, a restrained background, and a 2px bottom indicator. No `useLocation`, pathname comparison, or duplicate ARIA assignment is introduced. The same semantic remains available in the mobile navigation.

### Actions and responsive behavior

The primary `/download` link is rendered after the auth-dependent account actions, so both authenticated and unauthenticated states expose exactly one primary `下载桌面端` action. Login, free registration, Workbench, and logout use secondary/quiet treatment.

At 880px and below, account actions move into the existing mobile navigation while the compact top row keeps only brand, download, and the Icon menu. This prevents the new CTA from overflowing 390px and keeps logout/login reachable. The existing 880px media query remains the sole public-navigation breakpoint. Post-review Edge evidence at the exact 881px desktop edge records no page/container overflow, no item overlap, and 18px gaps on both sides of the route group, so the existing spacing is sufficient without a second breakpoint or speculative compression rule.

Inline mobile-nav styles move to `pages.css` because they otherwise override the route-current treatment. The menu DOM remains conditionally mounted, its first anchor remains the first focus target, and Escape/focus restoration behavior is unchanged.

## Accessibility and Failure Boundaries

- Exactly one current public route exposes `aria-current="page"`.
- The indicator supplements text/background contrast rather than carrying state by color alone.
- The menu button keeps `aria-expanded`, `aria-controls`, and its shared Icon.
- Mobile account links remain keyboard reachable; logout closes the menu before invoking the existing action.
- The scroll effect is passive and fully cleaned up.
- If JavaScript is unavailable, navigation and CTA remain usable in the rest state; only scroll compaction is absent.

## Verification

1. SSR contract at `/pricing`: one current route, correct href, truthful primary CTA.
2. Source/CSS contract: threshold, passive listener, cleanup, conditional modifier, 2px indicator, `--dur-3`, reduced-motion fallback, and single 880px breakpoint.
3. Browser contract: rest at 40px, compact at 41px, geometry contraction, glass/shadow visibility, current route, CTA, exact 881px desktop fit, 820px and 390px first-link focus/Escape, authenticated CTA hierarchy, resize lifecycle, reduced motion, and zero browser errors.
4. Four viewport screenshots and geometry checks, followed by Web build, focused tests, full Node/Python regression, static smoke, and final diff/document audit.
