import { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import Reveal from "../components/Reveal.jsx";
import CtaBand from "../components/public/CtaBand.jsx";
import FAQ from "../components/public/FAQ.jsx";
import SectionHead from "../components/public/SectionHead.jsx";
import Segmented from "../components/ui/Segmented.jsx";
import Table from "../components/ui/Table.jsx";

const BILLING_OPTIONS = [
  { value: "monthly", label: "月付" },
  { value: "yearly", label: "年付" },
];

const PLANS = [
  {
    key: "free",
    name: "免费",
    en: "FREE",
    price: "免费",
    tagline: "先用当前本地工作台完成一份真实文档。",
    features: [
      "本地 LaTeX 编译与 PDF 预览",
      "Workspace 注册、文件与搜索",
      "自带 API Key（BYOK）· 3 个 Provider 档案",
      "AI 会话历史保留 200 条",
    ],
    action: { label: "下载开发预览", to: "/download", kind: "btn-glass" },
  },
  {
    key: "pro",
    name: "专业",
    en: "PRO",
    price: "价格待发布",
    tagline: "面向个人的正式方案结构，权益仍需随版本发布。",
    features: [
      "包含免费方案的当前能力",
      "10 个 Provider 档案（一键切换 / 按次指定）",
      "AI 会话历史保留 1000 条",
      "模型 token 继续由 BYOK provider 结算",
    ],
    action: { label: "查看发布说明", to: "/changelog", kind: "btn-primary" },
    highlight: true,
  },
  {
    key: "team",
    name: "团队",
    en: "TEAM",
    price: "价格待发布",
    tagline: "团队 API 表面仍为 partial，正式权益不会提前售卖。",
    features: [
      "团队范围与席位模型待发布",
      "共享工作流能力需逐项确认",
      "实时协作不属于当前保证",
      "模型 token 不随席位打包",
    ],
    action: { label: "查看能力边界", to: "/docs", kind: "btn-glass" },
  },
  {
    key: "enterprise",
    name: "企业",
    en: "ENTERPRISE",
    price: "联系确认",
    tagline: "部署、身份、权限与支持范围按实际环境评估。",
    features: [
      "安全架构与网络边界评审",
      "身份和权限集成需评估",
      "SLA 与支持范围以合同为准",
      "不默认包含模型 token",
    ],
    action: { label: "讨论企业范围", to: "/enterprise", kind: "btn-glass" },
  },
];

const COMPARISON_ROWS = [
  {
    id: "compile",
    feature: "本地 LaTeX 编译",
    free: "当前包含",
    pro: "当前包含",
    team: "当前包含",
    enterprise: "当前包含",
  },
  {
    id: "provider",
    feature: "OpenAI-compatible provider",
    free: "用户配置",
    pro: "用户配置",
    team: "用户配置",
    enterprise: "边界可评估",
  },
  {
    id: "tokens",
    feature: "模型 token",
    free: "不包含",
    pro: "不包含",
    team: "不包含",
    enterprise: "不默认包含",
  },
  {
    id: "profiles",
    feature: "Provider 档案数",
    free: "3 个",
    pro: "10 个",
    team: "10 个",
    enterprise: "按需评估",
  },
  {
    id: "history",
    feature: "AI 会话历史保留",
    free: "200 条",
    pro: "1000 条",
    team: "1000 条",
    enterprise: "按需评估",
  },
  {
    id: "price",
    feature: "公开价格",
    free: "免费",
    pro: "待发布",
    team: "待发布",
    enterprise: "联系确认",
  },
  {
    id: "collaboration",
    feature: "实时协作",
    free: "路线图",
    pro: "路线图",
    team: "非当前保证",
    enterprise: "范围评估",
  },
  {
    id: "support",
    feature: "支持范围",
    free: "文档 / 社区",
    pro: "待发布",
    team: "待发布",
    enterprise: "合同确认",
  },
];

const FAQ_ITEMS = [
  {
    id: "byok",
    question: "BYOK 是什么？",
    answer: "BYOK 指自带 API Key。你选择并配置 OpenAI-compatible provider，Paper OS 不替你转售模型 token。",
  },
  {
    id: "provider-boundary",
    question: "模型请求一定留在本机吗？",
    answer: "不一定。Workspace 文件和本地编译以本机为事实来源；模型请求遵循你配置的 provider 数据边界。",
  },
  {
    id: "tokens",
    question: "订阅会包含模型 token 吗？",
    answer: "不会。当前产品合同明确不把平台付费模型 token 作为默认方案内容。",
  },
  {
    id: "open-source",
    question: "开源和付费方案是什么关系？",
    answer: "当前代码以 Apache-2.0 提供。付费方案用于未来正式服务边界，不改变本地文件属于用户的原则。",
  },
  {
    id: "availability",
    question: "专业、团队和企业方案现在可以购买吗？",
    answer: "公开价格与正式权益尚未发布。企业部署、身份、权限、SLA 和支持范围需要人工评估与合同确认。",
  },
];

const COMPARISON_COLUMNS = [
  { key: "feature", header: "方案边界" },
  { key: "free", header: "免费" },
  { key: "pro", header: "专业", className: "is-recommended", cellClassName: "is-recommended" },
  { key: "team", header: "团队" },
  { key: "enterprise", header: "企业" },
];

function PricingPlan({ billing, plan }) {
  const className = "pricing-plan card" + (plan.highlight ? " is-recommended" : "");
  const period = plan.key === "free"
    ? "开发预览"
    : billing === "yearly"
      ? "年付 · 金额待发布"
      : "月付 · 金额待发布";

  return (
    <Reveal className="pricing-plan-reveal">
      <article className={className}>
        <div className="plan-heading">
          <div>
            <span className="plan-en">{plan.en}</span>
            <h3>{plan.name}</h3>
          </div>
          {plan.highlight ? <span className="chip">推荐</span> : null}
        </div>
        <div className="plan-price">
          <strong>{plan.price}</strong>
          <span>{period}</span>
        </div>
        <p className="plan-tagline">{plan.tagline}</p>
        <ul className="plan-features">
          {plan.features.map((feature) => (
            <li key={feature}>
              <Icon name="check" size={15} strokeWidth={2} />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <Link className={"btn btn-block " + plan.action.kind} to={plan.action.to}>
          {plan.action.label}
        </Link>
      </article>
    </Reveal>
  );
}

export default function Pricing() {
  const [billing, setBilling] = useState("monthly");

  return (
    <div className="container section public-page public-page--pricing">
      <SectionHead
        headingLevel={1}
        eyebrow="定价与边界"
        title={<>先看清楚费用，<span className="serif-it">再选择方案</span>。</>}
        description="本地编译不按次收费。模型 token 由你配置的 BYOK provider 结算，不包含在 Paper OS 订阅中。"
      />

      <Reveal className="pricing-boundary">
        <div>
          <Icon name="local" size={18} strokeWidth={1.7} />
          <span><strong>本地编译</strong>不按次计费</span>
        </div>
        <div>
          <Icon name="key" size={18} strokeWidth={1.7} />
          <span><strong>BYOK</strong> 由用户选择 provider</span>
        </div>
        <div>
          <Icon name="usage" size={18} strokeWidth={1.7} />
          <span><strong>模型 token</strong> 不随方案打包</span>
        </div>
      </Reveal>

      <div className="pricing-controls">
        <Segmented
          ariaLabel="计费周期"
          options={BILLING_OPTIONS}
          value={billing}
          onValueChange={setBilling}
        />
        <p>
          年付省 2 月；具体金额与正式权益以发布公告为准。
        </p>
      </div>

      <div className="pricing-plans">
        {PLANS.map((plan) => (
          <PricingPlan billing={billing} key={plan.key} plan={plan} />
        ))}
      </div>

      <Reveal className="pricing-comparison">
        <SectionHead
          eyebrow="方案对比"
          title="把当前能力与未来范围分开看"
          description="待发布和需确认不是缺省包含；它们是避免提前承诺的明确状态。"
        />
        <Table
          caption="Paper OS 方案边界矩阵"
          columns={COMPARISON_COLUMNS}
          rows={COMPARISON_ROWS}
        />
      </Reveal>

      <Reveal className="pricing-faq">
        <SectionHead
          eyebrow="FAQ"
          title="计费、provider 与数据边界"
          description="这里回答最容易被营销话术混淆的几个问题。"
        />
        <FAQ label="定价与产品边界常见问题" items={FAQ_ITEMS} />
      </Reveal>

      <Reveal delay={0.08}>
        <CtaBand
          className="pricing-cta"
          eyebrow="CURRENT PREVIEW"
          title="先验证工作流，再等待正式定价"
          description="下载当前 Windows 开发预览；公开价格与付费权益发布后会同步到更新日志。"
          actions={(
            <>
              <Link className="btn btn-primary" to="/download">下载开发预览</Link>
              <Link className="btn btn-quiet" to="/changelog">查看更新日志</Link>
            </>
          )}
        />
      </Reveal>
    </div>
  );
}
