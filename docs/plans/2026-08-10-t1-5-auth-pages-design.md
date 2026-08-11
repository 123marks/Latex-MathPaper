# T1.5 Login/Register Design

## Goal

Bring Login and Register to the approved auth-page contract: a shared split-screen composition, neutral local-first copy, Segmented mode navigation, truthful offline entry, server-aligned password feedback, and working development OAuth controls.

## Architecture

Login and Register keep ownership of their submit state and call the existing `useAuth` methods. A new `AuthPanel` owns only shared chrome and interaction: the controlled `Segmented` Login/Register switch, home link, logo heading, error region, submit slot, development OAuth buttons, offline/download entry, and account-boundary note. It navigates between the existing routes with React Router and preserves `location.state.from` when present.

`AuthAside` remains the single left-column composition and is rewritten with neutral Workspace/Packs/LaTeX/Evidence copy. It adds decorative code/PDF fragments and the approved five-step vertical trace without claiming a real execution timeline. A shared `passwordPolicyError` pure helper is used by Register and tested independently; it mirrors the server's 10-character minimum, 256-character maximum, and two-character-class rule.

The existing API, session cookie, AuthProvider, dev OAuth start/callback endpoints, and responsive auth breakpoint remain unchanged. No role selector, production SSO promise, browser filesystem API, sync capability, or new dependency is added.

## Data Flow and Error Handling

1. Mode selection navigates to `/login` or `/register` through the controlled Segmented radiogroup.
2. Login submits `identifier/password` to `/api/auth/login`; Register submits the existing username/email/displayName/password payload to `/api/auth/register`.
3. AuthPanel's OAuth action calls `/api/auth/oauth/:provider/start`. Dev responses follow the same-origin callback and refresh the current session; non-dev responses use the returned URL. Errors remain in the shared alert region.
4. The offline entry links to the existing `/download` route and describes the desktop/local-project boundary without claiming browser-local folder access.
5. Busy states disable competing controls and preserve the existing button running state. Native form labels, required fields, focus rings, and keyboard semantics remain authoritative.

## Acceptance and Testing

- Source/SSR contracts prove Segmented semantics, neutral copy, shared AuthPanel wiring, offline entry, OAuth provider labels, password policy, and absence of role selection.
- The auth browser smoke covers both routes at 1440x900, 1100x720, 820x800, and 390x844; 390px checks horizontal overflow, mode switching, keyboard focus, offline navigation, and visible validation.
- Reduced-motion runs still permit mode switching and form interaction while transition/animation durations collapse to the existing static threshold.
- Full Node/Python regression, Web/Desktop production builds, static visual smoke, and strict Edge gates run before handoff.

## Non-Goals

- Do not change server auth semantics, OAuth provider registration, session storage, roles, or account APIs.
- Do not reopen T1.1-T1.4 geometry or claim T1.5 completes production SSO, sync, or collaboration.
