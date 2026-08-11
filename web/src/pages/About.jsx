import Reveal from "../components/Reveal.jsx";

const PRINCIPLES = [
  ["LaTeX 是最终真相来源", "Markdown 与 AI 响应只是规划件，最终交付物从 main.tex 与模块化章节构建。"],
  ["先证据，后润色", "重要论断必须先连接到结果/图表/来源/论断账本，写作与润色才能触碰终稿。"],
  ["MCP 是工具层，不是大脑", "产品状态、闸门与产物归属始终留在本地文件与 paperctl 中。"],
  ["技能是经审查的建议", "外部技能先评审再安装，绝不覆盖本地证据纪律或编造结果。"],
];

export default function About() {
  return (
    <div className="container section">
      <Reveal className="section-head">
        <span className="kicker">关于我们</span>
        <h2>为时间压力下的建模者，<span className="display italic" style={{ color: "var(--jade-bright)" }}>守住论文的严谨</span></h2>
        <p>数学建模竞赛的论文是在限时高压下被评委审阅的作品。工具的价值不是把话说得更漂亮，而是在加速写作的同时，绝不让薄弱的证据藏在华丽的语言背后。</p>
      </Reveal>

      <div className="feature-grid" style={{ marginBottom: 40 }}>
        {PRINCIPLES.map(([t, d], i) => (
          <Reveal key={t} delay={i * 0.06} className="card lift feature">
            <h3>{t}</h3>
            <p>{d}</p>
          </Reveal>
        ))}
      </div>

      <Reveal className="card" >
        <div style={{ padding: 8 }}>
          <span className="kicker">服务对象</span>
          <h3 className="display" style={{ fontSize: 26, margin: "14px 0" }}>
            MCM/ICM、CUMCM 等数学建模竞赛的参赛者与团队
          </h3>
          <p style={{ color: "var(--muted)", lineHeight: 1.8, maxWidth: 780 }}>
            你需要接入官方题目、配置 AI 网关、协调技能与工具、产出有证据支撑的建模产物，并编译出一篇可追溯的
            LaTeX 论文，而且要在比赛的时钟下完成。这正是本产品被设计来做的事：低依赖、本地优先、证据闭环、LaTeX 原生。
          </p>
        </div>
      </Reveal>
    </div>
  );
}
