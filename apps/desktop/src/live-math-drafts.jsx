import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { draftMathList } from "./math-drafts.mjs";

export default function LiveMathDrafts({ source, onJump }) {
  const drafts = useMemo(
    () => draftMathList(source, (tex, opts) => katex.renderToString(tex, opts)),
    [source],
  );

  if (!drafts.length) {
    return (
      <div className="live-math-drafts is-empty" data-testid="live-math-drafts" data-empty="1">
        <span className="live-badge">Live</span>
        <span>当前源码没有可预览的公式。编译成功后这里会换成 PDF。</span>
      </div>
    );
  }

  return (
    <div className="live-math-drafts" data-testid="live-math-drafts" data-empty="0">
      <div className="live-math-head">
        <span className="live-badge">Live</span>
        <span>{drafts.length} 条公式草稿 · 逐条渲染，一条出错不影响其余</span>
      </div>
      <ol className="live-math-list">
        {drafts.map((draft, index) => (
          <li
            key={draft.id}
            className={`live-math-item ${draft.ok ? "is-ok" : "is-bad"}`}
            data-testid={`math-draft-${index}`}
            data-ok={draft.ok ? "1" : "0"}
          >
            <button
              type="button"
              className="live-math-jump"
              onClick={() => onJump?.(draft.line)}
              title={`跳到第 ${draft.line} 行`}
            >
              L{draft.line} · {draft.kind}
            </button>
            {draft.ok ? (
              <div
                className={`live-math-html ${draft.display ? "is-display" : ""}`}
                dangerouslySetInnerHTML={{ __html: draft.html }}
              />
            ) : (
              <div className="live-math-error" data-testid={`math-draft-error-${index}`}>
                {draft.error}
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
