import { useEffect, useRef } from "react";
import { Icon } from "./icons.jsx";

const phaseLabels = {
  idle: "待命",
  requesting: "请求中",
  streaming: "接收回复",
  previewing: "生成预览",
  ready: "待确认",
  applying: "应用中",
  applied: "已应用",
  rejected: "已拒绝",
  complete: "已完成",
  failed: "失败",
  conflict: "文件已变更",
  rollback: "已回滚",
  "preview-error": "预览失败",
};

function phaseLabel(phase) {
  return phaseLabels[phase] || `未知状态${phase ? `（${phase}）` : ""}`;
}

function runtimeLabel(kind) {
  if (kind === "provider") return "模型回复";
  if (kind === "mock-local") return "本地模拟";
  return kind && kind !== "unknown" ? `未知来源（${kind}）` : "来源未知";
}

function providerStatusLabel(label) {
  if (label === "Provider unavailable") return "模型服务不可用";
  const configured = label.match(/^(.+) configured - (user key|shared provider)$/);
  if (configured) return `${configured[1]} · 已配置（${configured[2] === "user key" ? "个人配置" : "共享服务"}）`;
  const unavailable = label.match(/^(.+) unavailable$/);
  return unavailable ? `${unavailable[1]} · 当前不可用` : label;
}

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
      {diff.truncated ? <div className="ai-diff-note">差异较长，仅显示部分内容</div> : null}
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
  const file = context.find((chip) => chip.id === "file")?.value || "未打开文件";
  const hasSelection = context.find((chip) => chip.id === "selection")?.selected;
  const errorCount = Number(context.find((chip) => chip.id === "errors")?.value) || 0;
  const planLabels = {
    context: { title: "读取工作区上下文", description: `当前文件：${file}` },
    request: {
      title: runtime?.kind === "mock-local" ? "生成本地模拟建议" : "请求修改建议",
      description: runtime ? runtime.label : "等待确认本次回复的来源。",
    },
    preview: {
      title: "预览文件修改",
      description: proposal?.blocks?.length ? `${proposal.blocks.length} 个文件待审阅。` : "等待完整的文件修改建议。",
    },
    apply: {
      title: proposal?.state === "rejected" ? "已拒绝修改" : proposal?.state === "applied" ? "已应用修改" : "确认并应用修改",
      description: "应用前核对文件版本，防止覆盖预览之后的修改。",
    },
  };
  const proposalRef = useRef(null);
  useEffect(() => {
    if (!proposal) return;
    proposalRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [proposal?.state, proposal?.blocks?.length]);
  return (
    <div className="ai-harness" data-testid="ai-harness">
      <details className="ai-context" data-testid="ai-context">
        <summary className="ai-context-summary" title="查看助手使用的上下文">
          <Icon name="chevron" size={12} />
          <span className="ai-context-file" title={file}>{file}</span>
          {hasSelection ? <span className="ai-context-meta">已选中文本</span> : null}
          {errorCount > 0 ? <span className="ai-context-meta is-error">{errorCount} 个错误</span> : null}
        </summary>
        <div className="ai-context-details">
          {context.map((chip) => (
            <span key={chip.id} className="ai-chip" data-chip={chip.id} title={`${chip.label}：${chip.value}`}>
              <em>{chip.label}</em>
              {" "}
              {chip.value}
            </span>
          ))}
        </div>
      </details>
      {runtime || plan.length || proposal ? <div className="ai-runtime-row">
        {providerLabel ? <span className="ai-provider-label" data-testid="ai-provider">{providerStatusLabel(providerLabel)}</span> : null}
        {runtime ? (
          <span
            className={`ai-runtime ai-runtime--${runtime.kind === "mock-local" ? "mock" : runtime.kind === "provider" ? "provider" : "unknown"}`}
            data-testid="ai-runtime"
            data-runtime={runtime.kind}
          >
            {runtime.label}
          </span>
        ) : null}
      </div> : null}
      {plan.length ? (
        <ol className="ai-plan" data-testid="ai-plan" aria-label="当前执行计划">
          {plan.map((step) => (
            <li
              key={step.id}
              className={`ai-plan-step is-${step.status}`}
              data-step={step.id}
              data-status={step.status}
              title={planLabels[step.id]?.description || step.description || ""}
            >
              <strong>{planLabels[step.id]?.title || step.title || step.text}</strong>
              {step.durationMs != null ? <span>{step.durationMs} ms</span> : null}
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
            <strong>{proposal.blocks?.length || 0} 个文件修改</strong>
            <span className={`ai-proposal-state is-${proposal.state}`}>{phaseLabel(proposal.state)}</span>
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
              {proposal.state === "applying" ? "应用中…" : "应用修改"}
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
          上次运行：{phaseLabel(trace.phase)}
          {trace.runtime ? ` · ${runtimeLabel(trace.runtime)}` : ""}
          {trace.durationMs != null ? ` · ${trace.durationMs} ms` : ""}
        </div>
      ) : null}
    </div>
  );
}
