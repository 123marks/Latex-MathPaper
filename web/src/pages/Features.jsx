import { Link } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import Reveal from "../components/Reveal.jsx";
import CtaBand from "../components/public/CtaBand.jsx";
import SectionHead from "../components/public/SectionHead.jsx";

const DEEP_DIVES = [
  {
    number: "01",
    kicker: "LOCAL BUILD",
    icon: "local",
    title: "本地 LaTeX 编译",
    description: "Tectonic 与 latexmk 由本机运行，源码、编译日志和 PDF 预览留在 Workspace 的工作边界内。",
    boundary: "当前实现：IDE 编译路由与 PDF 预览已接入；通用 Build Profile / Build Job 仍在演进。",
    fragment: "compile",
    capture: true,
  },
  {
    number: "02",
    kicker: "REVIEWABLE AI",
    icon: "evidence",
    title: "可审查的 AI 修改",
    description: "AI 先提出变更，再由你逐块预览与 Apply。路径安全、mtime 冲突和回滚让写入保持可追踪。",
    boundary: "当前实现：Preview → Apply 兼容路径；持久 transaction ID、hunk review 与 undo 仍在路线图中。",
    fragment: "apply",
  },
  {
    number: "03",
    kicker: "EVIDENCE",
    icon: "magnifier",
    title: "证据与放大镜",
    description: "在支持 Evidence 的 Pack 中，把论断定位到脚本、数据、来源和 Artifact；让审查回到真实上下文。",
    boundary: "需要 Pack capability：Magnifier 不是所有 Workspace 的全局功能。",
    fragment: "evidence",
  },
  {
    number: "04",
    kicker: "CAPABILITIES",
    icon: "mcp",
    title: "Skills / MCP 生态",
    description: "Pack 通过声明的 Capability 扩展编辑器、预览、诊断和工具；Skills/MCP 是可审查的扩展边界。",
    boundary: "当前市场与 API 表面是 partial；安装能力不等于所有社区技能都已审核或可用。",
    fragment: "skills",
    link: { to: "/market", label: "查看技能市场" },
  },
  {
    number: "05",
    kicker: "WORKSPACE",
    icon: "users",
    title: "团队工作区",
    description: "每个人都围绕同一个 Workspace、Resource 和可审查变更工作；团队 API 表面正在收口。",
    boundary: "实时协作、云端同步、角色权限等能力仍在路线图中，企业范围需单独确认。",
    fragment: "workspace",
    link: { to: "/enterprise", label: "讨论团队边界" },
  },
];

const FRAGMENT_ROWS = {
  compile: [
    ["article.tex", "SOURCE"],
    ["tectonic", "LOCAL TOOL"],
    ["preview.pdf", "ARTIFACT"],
  ],
  apply: [
    ["Draft diff", "PREVIEW"],
    ["Apply blocks", "EXPLICIT"],
    ["mtime conflict", "409 GUARD"],
  ],
  evidence: [
    ["Claim", "TRACE"],
    ["Script / data", "SOURCE"],
    ["Artifact", "RESULT"],
  ],
  skills: [
    ["Pack", "CAPABILITY"],
    ["Skill", "EXTENSION"],
    ["MCP", "BOUNDARY"],
  ],
  workspace: [
    ["Workspace", "LOCAL ROOT"],
    ["Resource", "CONTEXT"],
    ["Review", "HUMAN GATE"],
  ],
};

function InterfaceFragment({ type }) {
  const rows = FRAGMENT_ROWS[type] ?? [];
  return (
    <div className="feature-fragment feature-fragment--static" aria-label="静态产品界面片段">
      <div className="feature-fragment__bar">
        <span className="feature-fragment__dot" aria-hidden="true" />
        <span>Paper OS / interface fragment</span>
      </div>
      <div className="feature-fragment__body">
        {rows.map(([label, value], index) => (
          <div className="feature-fragment__row" key={label}>
            <span className="feature-fragment__index">{String(index + 1).padStart(2, "0")}</span>
            <span className="feature-fragment__label">{label}</span>
            <span className="feature-fragment__value">{value}</span>
          </div>
        ))}
      </div>
      <p className="feature-fragment__caption">静态界面片段 · 不代表正在运行的任务</p>
    </div>
  );
}

function CaptureFragment() {
  return (
    <figure className="feature-fragment feature-fragment--capture">
      <div className="feature-fragment__image">
        <img
          src="/assets/feature-workbench.png"
          alt="Paper OS Workbench 的真实浏览器界面截图"
          loading="lazy"
          decoding="async"
        />
      </div>
      <figcaption className="feature-fragment__caption">
        真实 Workbench 截图 · 当前浏览器证据
      </figcaption>
    </figure>
  );
}

function DeepDive({ item, index }) {
  const className = "feature-deep-dive" + (index % 2 ? " feature-deep-dive--reverse" : "");
  return (
    <Reveal className={className} delay={Math.min(index * 0.04, 0.16)}>
      <div className="feature-deep-dive__copy">
        <div className="feature-deep-dive__topline">
          <span className="feature-num">{item.number}</span>
          <span className="chip">{item.kicker}</span>
        </div>
        <div className="feature-deep-dive__title-row">
          <span className="feature-deep-dive__icon" aria-hidden="true">
            <Icon name={item.icon} size={20} strokeWidth={1.6} />
          </span>
          <h3>{item.title}</h3>
        </div>
        <p className="feature-deep-dive__description">{item.description}</p>
        <p className="feature-deep-dive__boundary">
          <span>边界</span>
          {item.boundary}
        </p>
        {item.link ? (
          <Link className="feature-deep-dive__link" to={item.link.to}>
            {item.link.label}
            <Icon name="arrowRight" size={15} strokeWidth={1.8} />
          </Link>
        ) : null}
      </div>
      <div className="feature-deep-dive__visual">
        {item.capture ? <CaptureFragment /> : <InterfaceFragment type={item.fragment} />}
      </div>
    </Reveal>
  );
}

export default function Features() {
  return (
    <div className="container section public-page public-page--features">
      <SectionHead
        headingLevel={1}
        eyebrow="产品功能"
        title={<>写作，<span className="serif-it">不止生成</span>。</>}
        description="Paper OS 把 Workspace、编译、证据和可审查自动化放在同一条工作线上。每一项能力都标明它今天能做到什么。"
      />

      <div className="feature-deep-dive-list">
        {DEEP_DIVES.map((item, index) => (
          <DeepDive item={item} index={index} key={item.number} />
        ))}
      </div>

      <Reveal delay={0.08}>
        <CtaBand
          className="features-cta"
          eyebrow="LOCAL FIRST · PACK POWERED"
          title="把下一份严肃文档放进 Paper OS"
          description="下载 Windows 开发预览，打开一个 Workspace，先看清楚每一步，再决定下一步。"
          actions={(
            <>
              <Link className="btn btn-primary" to="/download">
                下载桌面端
                <Icon name="arrowRight" size={15} strokeWidth={1.8} />
              </Link>
              <Link className="btn btn-quiet" to="/docs">
                阅读产品文档
              </Link>
            </>
          )}
        />
      </Reveal>
    </div>
  );
}
