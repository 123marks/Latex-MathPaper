import Reveal from "../components/Reveal.jsx";

const PRINCIPLES = [
  ["LaTeX 是最终真相来源", "Markdown 与 AI 响应只是规划件，最终交付物从 main.tex 与模块化章节构建。"],
  ["先证据，后润色", "重要论断必须先连接到结果/图表/来源/论断账本，写作与润色才能触碰终稿。"],
  ["AI 提案，人来落盘", "模型输出的文件块永远先 Preview，你确认 diff 后才 Apply；冲突拦截、失败回滚。"],
  ["真实优先于好看", "界面上每个数字都来自本机真实数据；没有的能力如实标注「未就绪」，绝不演示假数据。"],
];

const LINEAGE = [
  ["可视化标注 → AI 提案", "受 Agentation 启发：圈选源码行或 PDF 区域，把审阅意见变成结构化修改请求。"],
  ["AI 会话管理", "受 CLI-Manager / codeg 启发：历史对话可搜索、可查看提案文件块、可一键复用。"],
  ["文献双链", "受 Agentero 启发：.bib 与 \\cite 双向链接、缺失引用检测、DOI / arXiv 导入。"],
  ["多 Provider 网关", "sub2api / newapi 式的档案管理：多网关加密保存、一键切换、按次指定。"],
];

export default function About() {
  return (
    <div className="container section">
      <Reveal className="section-head">
        <span className="kicker">关于我们</span>
        <h2>
          为时间压力下的写作者，
          <span className="display italic" style={{ color: "var(--amber-bright, var(--amber))" }}>守住论文的严谨</span>
        </h2>
        <p>
          数学建模竞赛与学术论文都是在限时高压下被审阅的作品。工具的价值不是把话说得更漂亮，
          而是在加速写作的同时，绝不让薄弱的证据藏在华丽的语言背后。
        </p>
      </Reveal>

      <div className="feature-grid" style={{ marginBottom: 40 }}>
        {PRINCIPLES.map(([t, d], i) => (
          <Reveal key={t} delay={i * 0.06} className="card lift feature">
            <h3>{t}</h3>
            <p>{d}</p>
          </Reveal>
        ))}
      </div>

      <Reveal className="card" style={{ marginBottom: 40 }}>
        <div style={{ padding: 8 }}>
          <span className="kicker">本地优先</span>
          <h3 className="display" style={{ fontSize: 26, margin: "14px 0" }}>
            你的论文、数据与 Key 都留在你的机器上
          </h3>
          <p style={{ color: "var(--muted)", lineHeight: 1.8, maxWidth: 780 }}>
            服务只监听 127.0.0.1；工作区文件、编译、用量记录全部落在本地目录；模型 API Key 以
            AES-256-GCM 加密存储、永不回传明文。唯一出机器的流量，是你主动发起的模型请求——
            由你自己配置的 provider 处理。
          </p>
        </div>
      </Reveal>

      <Reveal className="section-head" style={{ marginBottom: 24 }}>
        <span className="kicker">设计谱系</span>
        <h2 style={{ fontSize: 30 }}>站在同行的肩膀上，按自己的纪律实现</h2>
        <p>我们研究了一批优秀的开源与商业工具，吸收它们的交互思想，再以本地优先与真实性纪律重新实现。</p>
      </Reveal>
      <div className="feature-grid">
        {LINEAGE.map(([t, d], i) => (
          <Reveal key={t} delay={i * 0.06} className="card lift feature">
            <h3>{t}</h3>
            <p>{d}</p>
          </Reveal>
        ))}
      </div>

      <Reveal className="card" style={{ marginTop: 40 }}>
        <div style={{ padding: 8 }}>
          <span className="kicker">服务对象</span>
          <h3 className="display" style={{ fontSize: 26, margin: "14px 0" }}>
            MCM/ICM、CUMCM 等竞赛团队，以及需要证据纪律的论文写作者
          </h3>
          <p style={{ color: "var(--muted)", lineHeight: 1.8, maxWidth: 780 }}>
            你需要接入题目、配置 AI 网关、管理文献与引用、产出有证据支撑的建模产物，并编译出一篇可追溯的
            LaTeX 论文——而且要在比赛的时钟下完成。这正是 Paper OS 被设计来做的事：低依赖、本地优先、
            证据闭环、LaTeX 原生。
          </p>
        </div>
      </Reveal>
    </div>
  );
}
