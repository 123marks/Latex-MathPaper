import ActionTimeline from "../motifs/ActionTimeline.jsx";
import Icon from "../Icon.jsx";
import Logo from "../Logo.jsx";

function ProviderStatus({ provider }) {
  const state = provider || {
    mode: "loading",
    model: "Checking provider",
    source: "none",
    label: "Checking provider configuration",
  };

  return (
    <a
      className={"ai-provider-chip ai-provider-chip--" + state.mode}
      data-provider-source={state.source}
      href="/app/api-keys"
      title="Open AI provider settings"
    >
      <span className="ai-provider-chip__dot" aria-hidden="true" />
      <span>{state.label}</span>
    </a>
  );
}

function RuntimeStatus({ runtime }) {
  if (!runtime) return null;
  const isMock = runtime.kind === "mock-local";
  return (
    <div
      className={"ai-runtime ai-runtime--" + (isMock ? "mock" : "provider")}
      data-runtime={runtime.kind}
      role="status"
    >
      <Icon name={isMock ? "local" : "network"} size={13} />
      <span>{runtime.label}</span>
    </div>
  );
}

function DiffLines({ diff }) {
  if (!diff) return null;
  const hasChanges = diff.removed.length > 0 || diff.added.length > 0;
  return (
    <div className="ai-diff" aria-label="Calculated line replacement">
      {diff.context.map((line, index) => (
        <div className="ai-diff__line ai-diff__line--context" key={"context-" + index}>
          <span aria-hidden="true"> </span>{line || " "}
        </div>
      ))}
      {diff.removed.map((line, index) => (
        <div className="ai-diff__line ai-diff__line--removed" key={"removed-" + index}>
          <span aria-hidden="true">-</span>{line || " "}
        </div>
      ))}
      {diff.added.map((line, index) => (
        <div className="ai-diff__line ai-diff__line--added" key={"added-" + index}>
          <span aria-hidden="true">+</span>{line || " "}
        </div>
      ))}
      {!hasChanges ? <div className="ai-diff__empty">No line change detected.</div> : null}
      {diff.truncated ? <div className="ai-diff__note">Long replacement abbreviated.</div> : null}
    </div>
  );
}

function ProposalError({ proposal }) {
  if (!proposal?.error) return null;

  let title = "Preview failed";
  if (proposal.state === "conflict") title = "Preview is stale";
  if (proposal.state === "rollback") title = "Apply rolled back";

  return (
    <div className={"ai-proposal-error ai-proposal-error--" + proposal.state} role="alert">
      <strong>{title}</strong>
      <span>{proposal.error}</span>
      {proposal.conflicts?.length ? (
        <span>Changed files: {proposal.conflicts.join(", ")}</span>
      ) : null}
    </div>
  );
}

function ProposalPreview({
  proposal,
  busy,
  onApply,
  onReject,
  onRefreshPreview,
}) {
  if (!proposal) return null;
  const canApply = proposal.state === "ready" && !busy;

  return (
    <section className="ai-proposal" aria-labelledby="ai-proposal-title">
      <div className="ai-proposal__head">
        <div>
          <span className="ai-proposal__eyebrow">EditTransaction preview</span>
          <h5 id="ai-proposal-title">
            {proposal.blocks?.length || 0} file proposal
          </h5>
        </div>
        <span className={"ai-proposal__state ai-proposal__state--" + proposal.state}>
          {proposal.state}
        </span>
      </div>

      <ProposalError proposal={proposal} />

      <div className="ai-proposal__files">
        {(proposal.blocks || []).map((block) => (
          <article className="ai-proposal-file" key={block.path}>
            <div className="ai-proposal-file__head">
              <code>{block.path}</code>
              <span>
                {block.exists ? "Update" : "Create"} - {block.bytes ?? 0} bytes
              </span>
            </div>
            <DiffLines diff={block.diff} />
          </article>
        ))}
      </div>

      <div className="ai-proposal__actions">
        {["conflict", "rollback", "preview-error"].includes(proposal.state)
          && onRefreshPreview ? (
          <button className="btn btn-quiet btn-sm" type="button" onClick={onRefreshPreview}>
            Refresh preview
          </button>
        ) : null}
        <button
          className="btn btn-quiet btn-sm"
          type="button"
          onClick={onReject}
          disabled={busy || proposal.state === "applied" || proposal.state === "rejected"}
        >
          Reject
        </button>
        <button
          className="btn btn-primary btn-sm"
          type="button"
          onClick={onApply}
          disabled={!canApply}
        >
          Apply
        </button>
      </div>
    </section>
  );
}

export default function AIAssistantPanel({
  activePath = "",
  provider = null,
  runtime = null,
  messages = [],
  input = "",
  busy = false,
  plan = [],
  proposal = null,
  profiles = [],
  profileId = "",
  onProfileChange,
  onInput,
  onSubmit,
  onApply,
  onReject,
  onRefreshPreview,
}) {
  const proposalPending = ["ready", "conflict", "rollback"].includes(proposal?.state);

  return (
    <aside className="chat ai-assistant" aria-label="Paper OS Assistant">
      <div className="chat-head ai-assistant__head">
        <h4>
          <Logo size={22} />
          Paper OS Assistant
        </h4>
        <ProviderStatus provider={provider} />
      </div>

      <div className="chat-stream">
        <RuntimeStatus runtime={runtime} />

        {plan.length ? (
          <section className="ai-plan" aria-label="Current execution plan">
            <div className="ai-plan__title">
              <span>Execution plan</span>
              <span>{activePath || "workspace context"}</span>
            </div>
            <ActionTimeline steps={plan} label="Current AI execution plan" />
          </section>
        ) : null}

        {messages.map((message, index) => {
          const isUser = message.role === "user" || message.who === "You" || message.who === "你";
          return (
            <div
              className={"msg " + (isUser ? "user" : "assistant")}
              key={message.id || index}
            >
              <div className="who">
                {message.who || (isUser ? "You" : "Paper OS Assistant")}
                {message.streaming ? " - streaming" : ""}
              </div>
              <div className="msg__body">{message.text}</div>
            </div>
          );
        })}

        <ProposalPreview
          proposal={proposal}
          busy={busy}
          onApply={onApply}
          onReject={onReject}
          onRefreshPreview={onRefreshPreview}
        />
      </div>

      <form
        className="chat-input"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit?.();
        }}
      >
        {profiles.length > 0 ? (
          <div className="ai-profile-row">
            <label className="sr-only" htmlFor="workbench-ai-profile">本次对话使用的模型档案</label>
            <select
              id="workbench-ai-profile"
              value={profileId}
              disabled={busy}
              onChange={(event) => onProfileChange?.(event.target.value)}
            >
              <option value="">默认档案（激活的 / 单一配置）</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.model ? ` · ${p.model}` : ""}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <label className="sr-only" htmlFor="workbench-ai-input">Message Paper OS Assistant</label>
        <textarea
          id="workbench-ai-input"
          placeholder="提问或请求修改；用 @sections/intro.tex 附带文件内容…"
          value={input}
          disabled={busy || proposalPending}
          onChange={(event) => onInput?.(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              onSubmit?.();
            }
          }}
        />
        <div className="row">
          <span className="hints">Ctrl/Command + Enter</span>
          <button
            className="btn btn-primary btn-sm"
            type="submit"
            disabled={busy || proposalPending || !input.trim()}
          >
            {busy ? "Working..." : "Send"}
          </button>
        </div>
      </form>
    </aside>
  );
}
