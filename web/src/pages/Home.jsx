import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import Reveal from "../components/Reveal.jsx";
import Logo from "../components/Logo.jsx";
import Icon from "../components/Icon.jsx";
import TraceBadge from "../components/TraceBadge.jsx";
import HeroIdeMock from "../components/HeroIdeMock.jsx";
import CtaBand from "../components/public/CtaBand.jsx";
import FAQ from "../components/public/FAQ.jsx";
import FeatureCard from "../components/public/FeatureCard.jsx";
import LogoWall from "../components/public/LogoWall.jsx";
import SectionHead from "../components/public/SectionHead.jsx";
import StatRow from "../components/public/StatRow.jsx";
import WorkflowRibbon from "../components/public/WorkflowRibbon.jsx";
import Table from "../components/ui/Table.jsx";
import { usePointerParallax, useReducedMotion } from "../lib/motion.js";

const EASE = [0.16, 1, 0.3, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 1, ease: EASE, delay: 0.12 + i * 0.1 },
  }),
};

const HERO_STATS = [
  { id: "packs", value: "4", label: "内置 Pack" },
  { id: "apply", value: "Preview → Apply", label: "AI 写入" },
  { id: "license", value: "Apache-2.0", label: "开源许可" },
];

const CAPS = [
  {
    n: "01",
    icon: "latex",
    title: "LaTeX 原生 IDE",
    body: "Monaco 源码与实时 PDF 并排，Tectonic 在本机编译。改动即所见，不离开编辑器，不拼插件。",
    wide: true,
  },
  {
    n: "02",
    icon: "evidence",
    title: "证据可追溯",
    body: "每段论断、每张图、每条公式都能反查到生成它的脚本、数据集与源文献。",
    wide: false,
  },
  {
    n: "03",
    icon: "compose",
    title: "可审查的 AI",
    body: "AI 的修改以草稿块呈现，逐块确认才落盘。它提议，你决定。",
    wide: false,
  },
  {
    n: "04",
    icon: "team",
    title: "Pack 驱动的工作区",
    body: "Workspace Kernel 保持通用，专业 Pack 只在需要时加入领域语义与检查流程。",
    wide: true,
  },
  {
    n: "05",
    icon: "skills",
    title: "内置 Pack 与 MCP",
    body: "从已内置 Pack 启用专业能力，并通过明确的 Capability 边界连接本地工具与 MCP。",
    wide: false,
  },
  {
    n: "06",
    icon: "local",
    title: "本地优先",
    body: "工作区文件与编译留在本机；需要模型时由你配置 OpenAI 兼容 provider，AI 修改先预览再写入。",
    wide: false,
  },
];

const WORKFLOW_NODES = [
  {
    id: "intent",
    icon: "compose",
    title: "自然语言指令",
    description: "描述要修改的章节、约束与交付目标。",
    code: "revise method section",
  },
  {
    id: "tools",
    icon: "mcp",
    title: "Skills/MCP 调度",
    description: "按当前 Pack 的 Capability 边界调用已启用工具。",
    code: "skills · mcp",
  },
  {
    id: "workspace",
    icon: "local",
    title: "本地项目文件",
    description: "通过 Workspace Kernel 读取项目 Resource，不绕过路径边界。",
    code: "method.tex · refs.bib",
  },
  {
    id: "diff",
    icon: "latex",
    title: "LaTeX 编辑（差异）",
    description: "AI 修改先成为可审查 diff；冲突时停止，不静默覆盖。",
    code: "Preview → Apply",
  },
  {
    id: "verify",
    icon: "evidence",
    title: "PDF 与证据校验",
    description: "本地构建 PDF；支持 Evidence 的 Pack 再核对来源与 Artifact。",
    code: "build · verify",
  },
];

const EVIDENCE_TYPES = [
  { id: "source", label: "数据来源" },
  { id: "citation", label: "引用依据" },
  { id: "figure", label: "图表数据" },
  { id: "claim", label: "结论主张" },
];

const AUDIENCES = [
  { id: "research", icon: "users", label: "研究组" },
  { id: "engineering", icon: "terminal", label: "工程团队" },
  { id: "writing", icon: "compose", label: "技术写作团队" },
  { id: "coursework", icon: "template", label: "课程与项目小组" },
];

const FAQ_ITEMS = [
  {
    id: "provider",
    question: "模型请求会留在本机吗？",
    answer: "不会把 provider 说成本地模型。工作区文件与编译留在本机；你主动提交的模型请求由自己配置的 OpenAI-compatible provider 处理。",
  },
  {
    id: "platform",
    question: "现在支持哪些桌面平台？",
    answer: "Windows 提供未签名的自包含开发预览。macOS / Linux 目前是需要 Node.js 20+ 的便携 tar.gz，不是原生 App。下载页只在本机发布目录有文件时给出下载按钮。",
  },
  {
    id: "packs",
    question: "每个 Workspace 都有证据追溯吗？",
    answer: "不是。Workspace Kernel 保持通用，Evidence 等专业语义只在当前 Pack 声明相应 Capability 时出现。",
  },
  {
    id: "apply",
    question: "AI 会直接改写文件吗？",
    answer: "修改先以 Preview 或 diff 呈现，确认 Apply 后才写入；版本冲突会阻止静默覆盖。",
  },
];

const COMPARISON_COLUMNS = [
  { key: "dimension", header: "工作方式" },
  { key: "paper", header: "Paper OS" },
  { key: "cloud", header: "云端 LaTeX" },
  { key: "local", header: "传统本地编辑器" },
];

const COMPARISON_ROWS = [
  {
    dimension: "项目位置",
    paper: "本地 Workspace",
    cloud: "通常在服务项目空间",
    local: "本地文件夹",
  },
  {
    dimension: "编译位置",
    paper: "本机工具链",
    cloud: "服务端工具链",
    local: "本机工具链",
  },
  {
    dimension: "AI 写入控制",
    paper: "Preview → Apply",
    cloud: "依具体服务而定",
    local: "通常依插件或外部工具",
  },
  {
    dimension: "Evidence 语义",
    paper: "由支持它的 Pack 提供",
    cloud: "依具体服务或插件",
    local: "通常手工维护",
  },
  {
    dimension: "扩展边界",
    paper: "Pack / Capability / MCP",
    cloud: "模板与服务集成",
    local: "插件与脚本",
  },
];

export default function Home() {
  const reducedMotion = useReducedMotion();
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  // subtle parallax: the IDE mock drifts up slower than the copy as you scroll
  const mockY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const mockOpacity = useTransform(scrollYProgress, [0, 0.9], [1, 0.3]);
  // pointer tilt lives on an inner wrapper so it never fights the scroll transform
  const tiltRef = usePointerParallax({ max: 5 });
  const entranceMotion = reducedMotion
    ? {
        initial: false,
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0 },
      }
    : { initial: "hidden", animate: "show" };

  return (
    <>
      <section
        className="hero"
        ref={heroRef}
        data-motion={reducedMotion ? "static" : "active"}
      >
        <div className="container hero-inner">
          <div>
            <motion.div
              className="hero-eyebrow"
              initial={reducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reducedMotion ? { duration: 0 } : { duration: 0.8, ease: EASE }}
            >
              <Logo size={48} style={{ marginBottom: 18 }} />
              <span className="eyebrow" style={{ marginLeft: 14 }}>
                LaTeX Native · Local First
              </span>
            </motion.div>

            <h1 className="hero-title">
              <motion.span className="line" variants={fadeUp} custom={0} {...entranceMotion}>
                从想法，
              </motion.span>
              <motion.span className="line" variants={fadeUp} custom={1} {...entranceMotion}>
                到可以交付的<span className="grad">文档</span>。
              </motion.span>
            </h1>

            <motion.p className="hero-foil" variants={fadeUp} custom={2} {...entranceMotion}>
              Local first · Pack powered.
            </motion.p>

            <motion.p className="hero-sub" variants={fadeUp} custom={3} {...entranceMotion}>
              Paper OS 把本地文档编辑、可审查的 AI 修改与 Pack 驱动工作流装进同一个 Workspace。
              文件留在本机，证据追溯等专业能力按需启用。
            </motion.p>

            <motion.div className="hero-actions" variants={fadeUp} custom={4} {...entranceMotion}>
              <Link to="/download" className="btn btn-primary btn-lg">
                <Icon name="releases" size={17} style={{ marginRight: 8 }} />
                下载桌面端
              </Link>
              <a href="#workflow" className="btn btn-ghost-amber btn-lg">
                查看工作流
                <Icon name="play" size={16} style={{ marginLeft: 8 }} />
              </a>
            </motion.div>

            <motion.div
              className="hero-platform"
              variants={fadeUp}
              custom={5}
              {...entranceMotion}
            >
              Windows 开发预览 · macOS/Linux 便携包（需 Node.js）
              <span className="dot signal" style={{ margin: "0 8px 0 14px" }} />
              文件留在本机
            </motion.div>

            <motion.div variants={fadeUp} custom={6} {...entranceMotion}>
              <StatRow className="hero-meta" label="当前可核实指标" items={HERO_STATS} />
            </motion.div>
          </div>

          <motion.div
            className="hero-stage-wrap"
            style={{ y: reducedMotion ? 0 : mockY, opacity: reducedMotion ? 1 : mockOpacity }}
            initial={reducedMotion ? false : { opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reducedMotion
              ? { duration: 0 }
              : { duration: 1.2, ease: EASE, delay: 0.4 }}
          >
            <div className="hero-stage" ref={tiltRef}>
              <TraceBadge size={200} className="hero-badge" />
              <HeroIdeMock />
            </div>
          </motion.div>
        </div>
        <div className="horizon" aria-hidden="true" />
      </section>

      <section className="container section">
        <Reveal>
          <SectionHead
            eyebrow="核心能力"
            title={(
              <>
                为长期、可追溯的
                <span className="serif-it" style={{ color: "var(--amber)" }}>文档工程</span>
                而设计
              </>
            )}
            description="从源码到交付，从通用 Workspace 到专业 Pack。每一层都为严肃写作而生。"
          />
        </Reveal>

        <div className="feature-grid section-content">
          {CAPS.map((cap, i) => (
            <Reveal
              key={cap.n}
              delay={i * 0.07}
              className={`feature-slot${cap.wide ? " wide" : ""}`}
            >
              <FeatureCard
                number={cap.n}
                icon={cap.icon}
                title={cap.title}
                description={cap.body}
                wide={cap.wide}
              />
            </Reveal>
          ))}
        </div>
      </section>

      <section className="container section" id="workflow">
        <Reveal>
          <SectionHead
            eyebrow="工作流"
            title={(
              <>
                一条贯穿全文的
                <span className="serif-it" style={{ color: "var(--amber)" }}>工作流</span>
              </>
            )}
            description="从目标、工具与本地 Resource，到可审查修改和最终 Artifact，每一步都有明确边界。"
          />
        </Reveal>

        <WorkflowRibbon
          className="section-content"
          label="从自然语言指令到 PDF 与证据校验"
          nodes={WORKFLOW_NODES}
          evidence={EVIDENCE_TYPES}
        />
      </section>

      <section className="container section home-comparison-section">
        <Reveal>
          <SectionHead
            eyebrow="工作方式"
            title={(
              <>
                把工具差异说得
                <span className="serif-it" style={{ color: "var(--amber)" }}>具体一点</span>
              </>
            )}
            description="这里比较的是常见工作方式，不替任何具体产品下结论。实际能力以各自版本与配置为准。"
          />
        </Reveal>

        <Reveal className="home-comparison section-content">
          <Table
            caption="Paper OS 与常见文档工具的工作方式"
            columns={COMPARISON_COLUMNS}
            rowKey="dimension"
            rows={COMPARISON_ROWS}
          />
        </Reveal>

        <Reveal className="home-audience">
          <LogoWall
            label="适用的严肃文档场景"
            description="面向需要长期维护源码、数据、引用与交付物的人，而不是一份虚构的客户名单。"
            items={AUDIENCES}
          />
        </Reveal>
      </section>

      <section className="container section home-faq-section">
        <div className="home-faq-layout">
          <Reveal>
            <SectionHead
              eyebrow="产品边界"
              title={(
                <>
                  常见问题，
                  <span className="serif-it" style={{ color: "var(--amber)" }}>直接回答</span>
                </>
              )}
              description="本地优先不等于模型请求永不出机；开发预览也不等于全平台已经发布。"
            />
          </Reveal>
          <Reveal delay={0.08}>
            <FAQ label="产品边界常见问题" items={FAQ_ITEMS} />
          </Reveal>
        </div>
      </section>

      <section className="container section">
        <Reveal>
          <CtaBand
            className="glass"
            eyebrow="本地优先 · 开源"
            title={(
              <>
                把下一份严肃文档，
                <br />
                放进一个<span className="serif-it" style={{ color: "var(--amber)" }}>真正懂它</span>的编辑器。
              </>
            )}
            description="免费下载 Windows 开发预览，或注册账户进入工作台。工作区与编译留在本机；模型请求按你配置的 provider 处理。"
            actions={(
              <>
                <Link to="/download" className="btn btn-primary btn-lg">
                  <Icon name="releases" size={17} />
                  下载桌面端
                </Link>
                <Link to="/register" className="btn btn-glass btn-lg">
                  免费注册
                </Link>
              </>
            )}
          />
        </Reveal>
      </section>
    </>
  );
}
