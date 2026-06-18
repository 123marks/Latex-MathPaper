# External Skill Evaluation Workflow

Use this workflow before adding skills from the open skill ecosystem.

## Search

```powershell
npx skills find "latex academic writing"
npx skills find "matplotlib scientific figure"
npx skills find "research paper"
npx skills find "mcp"
npx skills find "math modeling"
```

## Review Before Install

For each candidate:

1. Open its skill page.
2. Read `SKILL.md`.
3. Check whether it duplicates local core skills.
4. Check whether it introduces unsafe behavior, external uploads, hidden dependencies, or vague writing rules.
5. Add it to `docs/knowledge/skill-catalog.md` as `recommended`, `candidate`, `optional`, or `reject`.
6. Generate and fill a local review record:

```powershell
python paperctl.py skill-review owner/repo@skill
```

Review files are written to `product/skills/reviews/`.

## Install Command Pattern

Install only one skill at a time:

```powershell
npx skills add owner/repo@skill -g -y
```

After installation:

```powershell
npx skills check
```

Do not install from the UI or CLI before the review file has `Status` changed from `pending` to an explicit adoption decision.

## Current Priority List

1. `seabbs/skills@analyzing-research-papers`
2. `athola/claude-night-market@math-review`
3. `davila7/claude-code-templates@scientific-visualization`
4. `bahayonghang/academic-writing-skills@latex-paper-en`
5. `anthropics/skills@mcp-builder`

## Rejection Criteria

- Skill encourages drafting claims without evidence.
- Skill hides source provenance.
- Skill requires uploading private contest data.
- Skill conflicts with the LaTeX-first workflow.
- Skill adds a UI or framework before the artifact pipeline is stable.
