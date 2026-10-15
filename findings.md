# Findings — desktop IDE refinement

## User evidence
- Screenshot 1: crowded top bar with workspace label colliding with command controls; repeated product/mode/file context in assistant; excessive amber and pill borders; English all-caps headings mixed with Chinese labels; macOS shortcut hint in a Windows application; large uneven text and little typography hierarchy.
- Screenshots 2–3: desired editor class uses low-noise chrome, compact regular sans-serif UI, aligned tab/panel rows, restrained selection state, and primary space for work.
- The task is a concrete improvement request, with explicit autonomy; proceed with reversible implementation and validation.

## Existing design context
- `.impeccable.md` describes a local-first general document IDE, optional professional packs, and quiet dense application chrome.
- Existing use of mono for nearly every metadata label and very dark amber palette conflicts with the user's latest readability/density reference. Keep warm accent only in small meaningful roles; regular sans-serif UI and clearer charcoal surface separation are appropriate.
- The UI/UX skill's generic search returned landing-page structure and violet/glow recommendations; those do not fit the existing IDE or user references and will not be applied. Its accessibility, hierarchy and interaction guidance is applicable.

## Architecture
- Main desktop interface: `apps/desktop/src/ide.jsx` and `apps/desktop/src/assets/ide.css`.
- Desktop dependencies already include React, Monaco, Inter and JetBrains Mono. No dependency additions needed.
- Native shell investigation independently confirms WinForms/WebView2, not a VS Code fork; desktop production bundle outputs to `app/ide/`.
- Tabbit stable CLI is installed and available for real-browser visual verification.

## Initial repository state
- Only `.gitignore` was modified before this task.
