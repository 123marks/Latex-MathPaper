import { useEffect, useRef } from "react";
import { Icon } from "./icons.jsx";

function DiffLines({ diff }) {
  if (!diff) return null;
  const hasChanges = diff.removed.length > 0 || diff.added.length > 0;
  return (
    <div className="ai-diff" data-testid="ai-diff">
      {diff.context.map((line, index) => (
        <div className="ai-diff-line is-context" key={`c-${index}`}><span> </span>{line || " "}</div>
      ))}
      {diff.removed.map((line, index) => (
        <div className="ai-diff-line is-removed" key={`r-${index}`}><span>-</span>{line || " "}</div>
      ))}
      {diff.added.map((line, index) => (
        <div className="ai-diff-line is-added" key={`a-${index}`}><span>+</span>{line || " "}</div>
      ))}
      {!hasChanges ? <div className="ai-diff-empty">没有行级差异</div> : null}
      {diff.truncated ? <div className="ai-diff-note">长替换已截断</div> : null}
    </div>
  );
}

export default function AiHarnessPanel({
  context = [],
  providerLabel = "",
  runtime = null,
  plan = [],
  proposal = null,
  trace = null,
  busy = false,
  streaming = false,
  onApply,
  onReject,
  onRefresh,
  onCancel,
}) {
  const proposalPending = ["ready", "conflict", "rollback"].includes(proposal?.state);
  const proposalRef = useRef(null);
  useEffect(() => {
    if (!proposal) return;
    proposalRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [proposal?.state, proposal?.blocks?.length]);
  return (
    <div className="ai-harness" data-testid="ai-harness">
      <div className="ai-context" data-testid="ai-context">
        {context.map((chip) => (
          <span key={chip.id} className="ai-chip" data-chip={chip.id} title={`${chip.label}: ${chip.value}`}>
            <em>{chip.label}</em>
            {" "}
            {chip.value}
          </span>
        ))}
      </div>
      <div className="ai-runtime-row">
        {providerLabel ? <span className="ai-provider-label" data-testid="ai-provider">{providerLabel}</span> : null}
        {runtime ? (
          <span
            className={`ai-runtime ai-runtime--${runtime.kind === "mock-local" ? "mock" : "provider"}`}
            data-testid="ai-runtime"
            data-runtime={runtime.kind}
          >
            {runtime.label}
          </span>
        ) : null}
      </div>
      {plan.length ? (
        <ol className="ai-plan" data-testid="ai-plan" aria-label="当前执行计划">
          {plan.map((step) => (
            <li
              key={step.id}
              className={`ai-plan-step is-${step.status}`}
              data-step={step.id}
              data-status={step.status}
              title={step.description || ""}
            >
              <strong>{step.title || step.text}</strong>
              {step.durationMs != null ? <span>{step.durationMs}ms</span> : null}
            </li>
          ))}
        </ol>
      ) : null}
      {streaming ? (
        <button type="button" className="ghost-btn sm" data-testid="ai-cancel" onClick={onCancel}>
          取消请求
        </button>
      ) : null}
      {proposal ? (
        <section ref={proposalRef} className="ai-proposal" data-testid="ai-proposal" data-state={proposal.state}>
          <div className="ai-proposal-head">
            <strong>{proposal.blocks?.length || 0} 个文件提案</strong>
            <span className={`ai-proposal-state is-${proposal.state}`}>{proposal.state}</span>
          </div>
          {proposal.error ? (
            <div className="ai-proposal-error" data-testid="ai-proposal-error" role="alert">
              <strong>
                {proposal.state === "conflict" ? "预览已过期" : proposal.state === "rollback" ? "写入已回滚" : "预览失败"}
              </strong>
              <span>{proposal.error}</span>
              {proposal.conflicts?.length ? <span>冲突：{proposal.conflicts.join(", ")}</span> : null}
            </div>
          ) : null}
          <div className="ai-proposal-actions">
            {["conflict", "rollback", "preview-error"].includes(proposal.state) ? (
              <button type="button" className="ghost-btn sm" data-testid="ai-refresh" onClick={onRefresh} disabled={busy}>
                重新预览
              </button>
            ) : null}
            <button
              type="button"
              className="ghost-btn sm"
              data-testid="ai-reject"
              onClick={onReject}
              disabled={busy || proposal.state === "applied" || proposal.state === "rejected"}
            >
              拒绝
            </button>
            <button
              type="button"
              className="ghost-btn sm amber"
              data-testid="ai-apply"
              onClick={onApply}
              disabled={!proposalPending || proposal.state !== "ready" || busy}
            >
              {proposal.state === "applying" ? "写入中…" : "Apply"}
            </button>
          </div>
          {(proposal.blocks || []).map((block) => (
            <article key={block.path} className="ai-proposal-file">
              <div className="ai-proposal-file-head">
                <code>{block.path}</code>
                <span>{block.exists ? "改写" : "新建"}</span>
              </div>
              <DiffLines diff={block.diff} />
            </article>
          ))}
        </section>
      ) : null}
      {trace ? (
        <div className="ai-trace" data-testid="ai-trace">
          <Icon name="circle" size={10} />
          上次运行 {trace.phase}
          {trace.runtime ? ` · ${trace.runtime}` : ""}
          {trace.durationMs != null ? ` · ${trace.durationMs}ms` : ""}
        </div>
      ) : null}
    </div>
  );
}
