# IDE usability and visual revision — 2026-09-23

## Goal
Bring the existing Paper OS desktop workbench to a coherent, quiet, readable desktop IDE standard using the user's Cursor screenshots as references for density and hierarchy. Preserve real document, build, preview, AI review, and workspace workflows.

## Scope and decisions
- Work directly in the current workspace; preserve the pre-existing `.gitignore` modification.
- Inspect the actual desktop shell and all source-to-runtime steps before changing the UI.
- Keep existing React/Monaco architecture; do not start an unrelated VS Code fork/migration.
- Use Chinese consistently for interface actions, headings, status and messages; keep code, filenames and product/protocol names intact.
- Separate UI and editor typography, use a CJK sans-serif fallback, avoid mono uppercase metadata as general UI.
- Reduce redundant headers, badges and competing primary actions; retain existing commands and review controls.
- No new dependencies. Reuse current icons, providers, APIs and UI state.

## Phases
1. [complete] Read design context, desktop architecture, source and current verification coverage; record screenshot critique.
2. [complete] Establish behavioral and visual baseline; write bounded implementation design.
3. [complete] Implement shell density, typography, language and assistant information hierarchy.
4. [complete] Run build and relevant regression checks; inspect real rendered screenshots at representative widths and correct defects.
5. [complete] Verify shipped entry point and document changed files, evidence and remaining limits.

## Verification
- Existing desktop buffer, work mode, AI, UI/workspace and render regression tests.
- Desktop production build and browser runtime checks on an isolated local server/workspace.
- Screenshots at 1440×900, 1280×800 and a smaller desktop viewport; inspect bounds, typography, focus and key interactions.
- Persist visual-verdict JSON per iteration under `.omx/state/ide-refinement/`.

## Errors / environment
- Default sandbox process creation fails with `helper_unknown_error: setup refresh had errors`; elevated read-only shell succeeds. Use required permission flow, do not attempt to bypass it.
- No previous root planning files existed; session-catchup produced no unsynced context.
- Parallel browser smoke processes can contend for their temporary Node services and cause a file-tree request timeout; sequential runs are the reliable verification path.
- Cold start from `dist/PaperOS.exe` initially timed out because the launcher started `dist/app/server.mjs` through a junction and the server's raw `process.argv[1]` comparison skipped `startServer()`. Fixed with realpath comparison and verified without the junction.
