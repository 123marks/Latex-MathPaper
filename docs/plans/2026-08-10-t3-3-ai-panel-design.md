# T3.3 Web Workbench AI Panel Design

Date: 2026-08-10
Status: Implemented and verified (2026-08-11)
Owner: Web Workbench

## Purpose

T3.3 closes the gap between the existing chat transport and a trustworthy editing workflow. The Web Workbench must show which model path is configured, which runtime actually produced each answer, how the current request is progressing, and exactly which files will be written before the user confirms Apply.

This task is a prerequisite for T3.6. A Workbench screenshot is not accepted as a product screenshot until the AI panel shown in that screenshot is connected to real state.

## Existing Assets

- GET /api/provider returns a secret-free active provider view, including model, source, and keyPresent.
- POST /api/chat streams real OpenAI-compatible output when available and otherwise uses deterministic mock-local output.
- POST /api/editor/apply-blocks already provides preview stamps, conflict detection, journaled writes, and rollback errors.
- ActionTimeline already renders done, running, and pending states with accessible labels.
- Workbench already owns workspace, open-file, editor, tree-refresh, and chat state.

## Problem

The current Web Workbench does not expose provider state, cannot tell a real provider answer from mock-local fallback, does not render an execution plan, and leaves BEGIN_FILE blocks as unstructured chat text. Consequently the user cannot review or safely apply an AI proposal from the Web UI.

## Chosen Design

Use a focused AIAssistantPanel presentation component plus pure helpers in web/src/lib/ai-execution.js. Workbench remains the lifecycle owner because it already owns the current workspace and editor state.

The panel receives provider, runtime, messages, plan, proposal, and action callbacks. It does not call APIs itself. This keeps network and workspace mutations visible in one page-level coordinator while preventing Workbench markup from growing further.

## Truth Model

Provider configuration and response runtime are separate facts.

- Provider chip: reports what GET /api/provider says is configured. It must use wording such as configured or unavailable, never online.
- Response runtime: comes from /api/chat SSE metadata for the current answer.
- provider runtime: the configured provider actually produced the streamed answer.
- mock-local runtime: the deterministic local fallback produced the answer. This must remain visibly labelled and cannot inherit the configured model name.
- unknown runtime: no response has established a runtime yet.

The server emits one metadata SSE event before content for both real and mock paths. No key, endpoint credential, or provider error body is sent to the browser.

## Execution Plan

buildExecutionPlan receives actual lifecycle facts rather than inventing tool calls. Its steps are:

1. Read the selected workspace/file context.
2. Request an answer from the resolved chat runtime.
3. Parse and preview returned BEGIN_FILE blocks.
4. Wait for explicit user confirmation and apply with the preview baseline.

Statuses are derived from phase transitions: requesting, streaming, previewing, ready, applying, applied, rejected, or failed. A step is never marked done before its corresponding operation completes.

## Proposal Lifecycle

1. User submits a request.
2. Workbench starts a real execution plan and streams /api/chat.
3. SSE metadata records provider or mock-local runtime.
4. Complete BEGIN_FILE blocks are parsed only after streaming finishes.
5. If blocks exist, Workbench posts the unmodified assistant text to apply-blocks with apply false.
6. The returned block stamps become the immutable baseline shown in the preview.
7. Apply posts the same assistant text, apply true, and the exact path/mtime baseline.
8. Reject discards the proposal without a write request.
9. Success refreshes the tree and any clean active buffer affected by the write.

## Diff Presentation

For each proposed file, the preview shows its path, create/update state, byte count, and a bounded line replacement view based on the current file content. The view may abbreviate long unchanged/changed ranges, but it must not claim semantic changes that were not calculated.

The server remains authoritative for path containment and write safety. Client parsing is display logic only.

## Error States

- APPLY_CONFLICT: keep the proposal visible, list conflicting paths, disable stale Apply, and offer a fresh preview.
- APPLY_ROLLBACK: state that no partial change was kept and preserve the proposal for inspection.
- Preview or network failure: retain the assistant answer, show a recoverable error, and do not enable Apply.
- Provider failure: server switches to mock-local and emits that runtime explicitly; the UI must not show the configured model as the producer.

## Accessibility and Responsive Rules

- Provider state and apply result use text in addition to color.
- ActionTimeline keeps its ordered-list semantics and aria-current running step.
- Apply and Reject are native buttons with stable labels and disabled states.
- File diffs use preformatted text with overflow containment.
- At narrow widths the assistant panel remains a vertical section; proposal controls wrap without horizontal overflow.
- Reduced motion must not remove state information.

## Rejected Alternatives

1. Keep all new markup in Workbench.jsx. Rejected because the page is already a mixed editor/compile/chat coordinator and the review/apply UI is independently testable.
2. Copy the desktop IDE implementation. Rejected because the desktop component is a large monolith and its current execution plan is a static heuristic, which would preserve the exact trust gap T3.3 is meant to close.
3. Add a generic schema renderer or diff dependency. Rejected because the task needs one bounded proposal surface and existing dependencies are sufficient.
4. Auto-apply model output. Rejected because it violates the accepted EditTransaction and explicit-confirmation contract.

## Acceptance Evidence

- Pure helper tests cover provider truth, lifecycle plan states, multiple file blocks, diff bounds, and exact apply baseline construction.
- Component/source tests prove the panel uses ActionTimeline, exposes provider/mock-local labels, and provides Apply/Reject/conflict states.
- Server test or source contract proves both chat paths emit runtime metadata before deltas.
- Existing editor transaction tests remain green.
- Web production build passes.
- Browser smoke proves provider state, keyboard submission, preview, reject/apply controls, reduced-motion usability, no browser errors, and no horizontal overflow.
