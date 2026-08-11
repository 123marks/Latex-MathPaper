import { Link } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import Reveal from "../components/Reveal.jsx";
import CtaBand from "../components/public/CtaBand.jsx";
import SectionHead from "../components/public/SectionHead.jsx";

const CAPABILITIES = [
  {
    icon: "enterprise",
    title: "私有化部署",
    status: "需评估",
    tone: "planned",
    description: "当前开发预览尚未证明 self-contained 内网分发、安装、升级和回滚链。部署范围需按目标环境评估。",
  },
  {
    icon: "lock",
    title: "SSO 单点登录",
    status: "需评估",
    tone: "planned",
    description: "OIDC、SAML 或 LDAP 接入不是当前已交付能力。身份源、离职回收和桌面信任边界需共同设计。",
  },
  {
    icon: "audit",
    title: "审计合规 & SLA",
    status: "合同确认",
    tone: "contract",
    description: "现有审计 API 表面不等于合规认证或可用性承诺。保留周期、导出、告警和 SLA 需写入范围。",
  },
  {
    icon: "admin",
    title: "RBAC 权限",
    status: "需评估",
    tone: "planned",
    description: "当前账户角色不构成完整 Workspace ACL。资源、命令、Pack 和管理面的最小权限模型仍需复审。",
  },
  {
    icon: "network",
    title: "数据本地边界",
    status: "可配置",
    tone: "current",
    description: "Workspace 文件与本地编译留在用户环境；模型请求遵循所配置 OpenAI-compatible provider 的网络边界。",
  },
  {
    icon: "award",
    title: "专属支持",
    status: "合同确认",
    tone: "contract",
    description: "支持通道、响应时间、升级评估和版本维护窗口必须按团队规模与部署方式确认。",
  },
];

const FOUNDATIONS = [
  {
    icon: "key",
    title: "密钥静态加密",
    description: "账户 provider 密钥使用 AES-256-GCM 加密；轮换、迁移和备份恢复仍需运维方案。",
  },
  {
    icon: "local",
    title: "Workspace 路径约束",
    description: "服务端检查相对路径、绝对路径、根删除与 junction/symlink 逃逸，拒绝 Workspace 外访问。",
  },
  {
    icon: "lock",
    title: "本机启动信任",
    description: "桌面 bootstrap 绑定 loopback 且一次性使用；登录和敏感接口具有限流基础。",
  },
  {
    icon: "releases",
    title: "发布清单签名",
    description: "Ed25519 清单可校验篡改，但不替代 Authenticode，也不证明 launcher 更新链已完成。",
  },
];

const ARCHITECTURE_LAYERS = [
  {
    number: "01",
    label: "CURRENT FOUNDATION",
    title: "当前安全基础",
    description: "加密密钥、路径边界、loopback bootstrap、限流与发布清单签名均有源码或测试证据。",
  },
  {
    number: "02",
    label: "CONFIGURABLE BOUNDARY",
    title: "可配置 provider 边界",
    description: "模型请求可指向兼容 endpoint；数据是否离开内网取决于企业选择、网络策略与 provider 配置。",
  },
  {
    number: "03",
    label: "SCOPE TO CONFIRM",
    title: "部署与合同范围",
    description: "内网分发、SSO、RBAC、审计、SLA、支持和签名更新链都必须在实施前确认。",
  },
];

function CapabilityCard({ capability }) {
  const className = "enterprise-capability card is-" + capability.tone;
  return (
    <Reveal className="enterprise-capability-reveal">
      <article className={className}>
        <div className="enterprise-capability__topline">
          <span className="enterprise-capability__icon" aria-hidden="true">
            <Icon name={capability.icon} size={20} strokeWidth={1.6} />
          </span>
          <span className="chip">{capability.status}</span>
        </div>
        <h3>{capability.title}</h3>
        <p>{capability.description}</p>
      </article>
    </Reveal>
  );
}

export default function Enterprise() {
  return (
    <div className="container section public-page public-page--enterprise">
      <SectionHead
        headingLevel={1}
        eyebrow="企业版 · 范围评估"
        title="把整套系统部署进你的内网。"
        description="这是目标部署方向，不是现成保证。先核对当前安全基础、provider 边界和仍需确认的企业能力。"
      />

      <Reveal className="enterprise-truth-note">
        <Icon name="audit" size={19} strokeWidth={1.7} />
        <p>
          企业页面只陈述可验证事实。私有化部署、身份、权限、合规、SLA 与支持范围必须经过架构评估和合同确认。
        </p>
      </Reveal>

      <section className="enterprise-capability-section" aria-labelledby="enterprise-capabilities-title">
        <Reveal>
          <SectionHead
            eyebrow="六项企业主题"
            id="enterprise-capabilities-title"
            title="每一项都带可用性标签"
            description="可配置表示已有边界可选；需评估与合同确认不代表当前产品已交付。"
          />
        </Reveal>
        <div className="enterprise-capabilities">
          {CAPABILITIES.map((capability) => (
            <CapabilityCard capability={capability} key={capability.title} />
          ))}
        </div>
      </section>

      <section className="enterprise-security" aria-labelledby="enterprise-security-title">
        <Reveal>
          <SectionHead
            eyebrow="当前安全基础"
            id="enterprise-security-title"
            title="从已有防护开始谈部署"
            description="这些基础能力有源码和测试证据，同时保留各自尚未完成的运维或平台边界。"
          />
        </Reveal>
        <div className="enterprise-foundations">
          {FOUNDATIONS.map((foundation, index) => (
            <Reveal className="enterprise-foundation" delay={index * 0.04} key={foundation.title}>
              <span className="enterprise-foundation__icon" aria-hidden="true">
                <Icon name={foundation.icon} size={18} strokeWidth={1.7} />
              </span>
              <div>
                <h3>{foundation.title}</h3>
                <p>{foundation.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <Reveal>
        <section className="enterprise-architecture" aria-labelledby="enterprise-architecture-title">
          <div className="enterprise-architecture__intro">
            <span className="eyebrow">安全架构</span>
            <h2 id="enterprise-architecture-title">三层边界，不混成一句承诺</h2>
          </div>
          <ol>
            {ARCHITECTURE_LAYERS.map((layer) => (
              <li key={layer.number}>
                <div className="enterprise-layer__meta">
                  <span>{layer.number}</span>
                  <code>{layer.label}</code>
                </div>
                <h3>{layer.title}</h3>
                <p>{layer.description}</p>
              </li>
            ))}
          </ol>
        </section>
      </Reveal>

      <Reveal delay={0.08}>
        <CtaBand
          className="enterprise-cta"
          eyebrow="MANUAL HANDOFF"
          title="先把网络、身份和发布约束说清楚"
          description="邮件会进入人工沟通；不会自动创建部署、报价或 SLA 承诺。"
          actions={(
            <>
              <a className="btn btn-primary" href="mailto:enterprise@paper-os.local">
                联系企业团队
              </a>
              <Link className="btn btn-glass" to="/docs">查看架构文档</Link>
              <Link className="btn btn-quiet" to="/pricing">对比方案边界</Link>
            </>
          )}
        />
      </Reveal>
    </div>
  );
}
