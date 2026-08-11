import Icon from "./Icon.jsx";

const SOURCE_LINES = [
  { n: 12, content: "\\section{Methodology}", tone: "keyword" },
  { n: 13, content: "We minimise the weighted residual", tone: "plain" },
  { n: 14, content: "\\begin{equation}", tone: "keyword" },
  { n: 15, content: "  L(θ) = Σᵢ wᵢ(yᵢ - ŷᵢ)²", tone: "math" },
  { n: 16, content: "\\end{equation}", tone: "keyword" },
  { n: 17, content: "% evidence: results/model-fit.json", tone: "comment" },
];

export default function HeroIdeMock() {
  return (
    <div className="hero-mock" role="img" aria-label="Paper OS IDE 工作流示意">
      <div className="hero-mock-bar">
        <span className="hero-window-dot red" />
        <span className="hero-window-dot amber" />
        <span className="hero-window-dot jade" />
        <span className="hero-mock-path">paper-os / method.tex</span>
        <span className="hero-mock-status">界面示意</span>
      </div>

      <div className="hero-mock-grid">
        <div className="hero-mock-tree">
          <b>Workspace</b>
          <span>main.tex</span>
          <span>refs.bib</span>
          <span className="folder">figures</span>
          <span className="active">method.tex</span>
          <span>results.csv</span>
          <span>main.pdf</span>
          <div className="hero-tree-pack">
            <Icon name="evidence" size={11} />
            math-modeling Pack
          </div>
        </div>

        <div className="hero-mock-document">
          <div className="hero-mock-editor">
            <div className="hero-pane-label">method.tex</div>
            <div className="hero-code">
              {SOURCE_LINES.map((line) => (
                <div className="code-line" key={line.n}>
                  <span className="ln">{line.n}</span>
                  <span className={line.tone}>{line.content}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="hero-mock-pdf">
            <div className="hero-pane-label">main.pdf</div>
            <div className="hero-pdf-page">
              <span className="hero-pdf-kicker">2. Methodology</span>
              <strong>Local evidence, reviewable edits</strong>
              <span className="hero-pdf-rule" />
              <span className="hero-pdf-copy wide" />
              <span className="hero-pdf-copy" />
              <span className="hero-pdf-equation">L(θ) = Σ wᵢ(yᵢ - ŷᵢ)²</span>
              <span className="hero-pdf-copy wide" />
              <span className="hero-pdf-figure">
                <i /><i /><i /><i />
              </span>
              <small>Figure 1 · model residuals</small>
            </div>
          </div>
        </div>

        <div className="hero-mock-assistant">
          <b>
            <Icon name="compose" size={11} />
            AI 修改预览
          </b>
          <span className="hero-review-state">Preview → Apply</span>
          <div className="hero-diff">
            <span className="removed">− weighted error</span>
            <span className="added">+ weighted residual</span>
          </div>
          <p>基于当前 Workspace 上下文生成，写入前由你确认。</p>
          <div className="hero-review-actions">
            <span>Reject</span>
            <span className="primary">Apply</span>
          </div>
        </div>
      </div>

      <div className="hero-evidence-flow" aria-hidden="true">
        <div><span>source</span><i /></div>
        <div><span>citation</span><i /></div>
        <div><span>figure</span><i /></div>
      </div>
    </div>
  );
}
