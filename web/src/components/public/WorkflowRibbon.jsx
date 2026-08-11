import Icon from "../Icon.jsx";
import Reveal from "../Reveal.jsx";
import { classes, requireItems, requireText } from "./_utils.js";

function normalizeNode(node, index) {
  if (!node || typeof node !== "object") {
    throw new TypeError(`WorkflowRibbon node ${index + 1} must be an object`);
  }
  return {
    id: node.id ?? index,
    icon: requireText("WorkflowRibbon", `node ${index + 1} icon`, node.icon),
    title: requireText("WorkflowRibbon", `node ${index + 1} title`, node.title),
    description: requireText(
      "WorkflowRibbon",
      `node ${index + 1} description`,
      node.description,
    ),
    code: requireText("WorkflowRibbon", `node ${index + 1} code`, node.code),
  };
}

function normalizeEvidence(item, index) {
  if (!item || typeof item !== "object") {
    throw new TypeError(`WorkflowRibbon evidence ${index + 1} must be an object`);
  }
  return {
    id: item.id ?? index,
    label: requireText("WorkflowRibbon", `evidence ${index + 1} label`, item.label),
  };
}

export default function WorkflowRibbon({
  className = "",
  evidence = [],
  label = "文档工作流",
  nodes = [],
}) {
  const normalizedNodes = requireItems("WorkflowRibbon", nodes).map(normalizeNode);
  const normalizedEvidence = requireItems("WorkflowRibbon", evidence).map(normalizeEvidence);
  const accessibleLabel = requireText("WorkflowRibbon", "label", label);

  return (
    <div className={classes("workflow-ribbon", className)}>
      <ol className="workflow-ribbon__track" aria-label={accessibleLabel}>
        {normalizedNodes.map((node, index) => (
          <li className="workflow-ribbon__node" key={node.id}>
            {index < normalizedNodes.length - 1 ? (
              <span className="workflow-ribbon__connector" aria-hidden="true" />
            ) : null}
            <Reveal className="workflow-ribbon__card" delay={index * 0.08}>
              <span className="workflow-ribbon__index" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="workflow-ribbon__icon" aria-hidden="true">
                <Icon name={node.icon} size={18} strokeWidth={1.7} />
              </span>
              <h3>{node.title}</h3>
              <p>{node.description}</p>
              <code>{node.code}</code>
            </Reveal>
          </li>
        ))}
      </ol>

      {normalizedEvidence.length ? (
        <div className="workflow-ribbon__evidence">
          <p>Evidence 能力由当前 Pack 决定</p>
          <ul aria-label="可追溯信息类型">
            {normalizedEvidence.map((item) => (
              <li className="workflow-ribbon__evidence-item" key={item.id}>
                <Icon name="evidence" size={14} strokeWidth={1.7} />
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
