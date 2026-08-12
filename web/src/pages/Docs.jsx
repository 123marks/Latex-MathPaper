import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Reveal from "../components/Reveal.jsx";

const TOC = [
  ["quickstart", "下载安装"],
  ["configure-key", "配置 API Key"],
  ["first-doc", "创建第一个文档"],
  ["compile", "本地编译 PDF"],
  ["ai-assist", "AI 写作与 Inline Edit"],
  ["annotate", "标注 → AI 修改提案"],
  ["references", "文献与 PDF 审阅"],
  ["sessions", "会话管理与多网关"],
  ["community", "社区与技能市场"],
];

const PRE_STYLE = {
  background: "rgba(212, 163, 65, 0.08)",
  border: "1px solid rgba(212, 163, 65, 0.18)",
  borderRadius: 10,
  padding: "13px 16px",
  margin: "14px 0 0",
  fontFamily: "var(--font-mono)",
  fontSize: 12.5,
  lineHeight: 1.7,
  color: "var(--amber-bright)",
  overflowX: "auto",
  whiteSpace: "pre",
};

const P_STYLE = {
  color: "var(--text-soft)",
  fontSize: 14,
  lineHeight: 1.78,
  marginTop: 10,
};

const LIST_STYLE = {
  margin: "12px 0 0",
  paddingLeft: 20,
  color: "var(--text-soft)",
  fontSize: 14,
  lineHeight: 1.9,
};

function useWide(query = "(min-width: 960px)") {
  const [wide, setWide] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e) => setWide(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return wide;
}

function DocSection({ id, index, title, children }) {
  return (
    <section id={id} style={{ scrollMarginTop: 96 }}>
      <Reveal className="card" delay={0.04}>
        <span className="feature-num">{String(index + 1).padStart(2, "0")}</span>
        <h3
          className="display"
          style={{ fontSize: 23, margin: "10px 0 2px", letterSpacing: "-0.01em" }}
        >
          {title}
        </h3>
        {children}
      </Reveal>
    </section>
  );
}

export default function Docs() {
  const wide = useWide();
  return (
    <div className="container section">
      <Reveal className="section-head">
        <span className="eyebrow">文档</span>
        <h2>
          十分钟,从安装到<span className="serif-it" style={{ color: "var(--amber)" }}>第一份 PDF</span>。
        </h2>
        <p>
          Paper OS 的编辑与编译都在你自己的机器上运行;AI 写作则由你配置的 provider 处理。
          跟着下面九节走完,你就拥有一个本地优先、证据可追溯的 LaTeX 工作台。
        </p>
      </Reveal>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: wide ? "230px minmax(0, 1fr)" : "1fr",
          gap: 28,
          alignItems: "start",
          marginTop: 28,
        }}
      >
        <nav
          className="glass aside-block"
          style={wide ? { position: "sticky", top: 96 } : {}}
          aria-label="本页目录"
        >
          <h4>本页目录</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {TOC.map(([id, label], i) => (
              <a key={id} className="side-link" href={`#${id}`}>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--amber)",
                    width: 18,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                {label}
              </a>
            ))}
          </div>
        </nav>

        <div className="stack" style={{ gap: 18 }}>
          <DocSection id="quickstart" index={0} title="下载安装">
            <p style={P_STYLE}>
              前往<Link to="/download" className="ulink">下载页</Link>
              获取对应平台的桌面客户端(Windows / macOS / Linux)。
              当前版本依赖本地 Node.js 运行时,安装前请确认版本不低于 20:
            </p>
            <pre style={PRE_STYLE}>{`node -v
# 需要 v20.0.0 或更高`}</pre>
            <p style={P_STYLE}>
              首次启动时,客户端会请你选择一个文件夹作为工作区根目录——
              之后所有文档、图表与编译产物都留在这个目录里,不经过任何服务器。
            </p>
          </DocSection>

          <DocSection id="configure-key" index={1} title="配置 API Key">
            <p style={P_STYLE}>
              AI 能力采用自带 Key(BYOK)模式,免费版即可使用,见
              <Link to="/pricing" className="ulink">定价</Link>。
              打开 <code>设置 → AI 服务商</code>,粘贴你自己的 API Key 并保存。
            </p>
            <ul style={LIST_STYLE}>
              <li>Key 以 AES-256-GCM 按用户加密后存储在本地,不上传、不写日志。</li>
              <li>可随时更换服务商或删除 Key,删除后立即失效。</li>
              <li>企业可将网关指向内网自建的推理服务。</li>
            </ul>
          </DocSection>

          <DocSection id="first-doc" index={2} title="创建第一个文档">
            <p style={P_STYLE}>
              在工作台点击「新建工作区」,选择一个论文模板,客户端会生成{" "}
              <code>main.tex</code> 与模块化章节文件。左侧文件树管理{" "}
              <code>figures/</code> 与 <code>refs.bib</code>;
              随时按 <span className="kbd">Ctrl+P</span>{" "}
              快速打开工作区里的任意文件,支持模糊匹配。
            </p>
            <pre style={PRE_STYLE}>{`my-paper/
├── main.tex        # 最终真相来源
├── sections/       # 模块化章节
├── figures/        # 图表
└── refs.bib        # 参考文献`}</pre>
          </DocSection>

          <DocSection id="compile" index={3} title="本地编译 PDF">
            <p style={P_STYLE}>
              按 <span className="kbd">Ctrl+Shift+B</span>{" "}
              触发本地编译,PDF 在源码右侧并排刷新。编译跑在你自己的 CPU 上,
              没有次数限制,也没有排队。出错时,编译日志面板会把报错定位到具体行。
            </p>
            <pre style={PRE_STYLE}>{`# 等效的命令行编译(客户端内置,无需手动执行)
latexmk -pdf main.tex`}</pre>
          </DocSection>

          <DocSection id="ai-assist" index={4} title="AI 写作与 Inline Edit">
            <p style={P_STYLE}>
              选中一段源码,按 <span className="kbd">Ctrl+K</span>{" "}
              唤起行内编辑,用自然语言描述改法。AI 的修改以可审查草稿呈现,
              逐块确认后才落盘,批量改动以事务方式应用——要么全部成功,要么整体回滚。
            </p>
            <ul style={LIST_STYLE}>
              <li>聊天面板的回答会注明引用的行号与上下文。</li>
              <li>重要论断可连接到证据账本,写作始终有出处。</li>
            </ul>
          </DocSection>

          <DocSection id="annotate" index={5} title="标注 → AI 修改提案">
            <p style={P_STYLE}>
              审阅式修改的完整闭环:在编辑器里选中若干行,在下方标注面板填写意图
              (改写 / 修复 / 疑问 / 待办)与优先级;点「交给 AI 修改」,
              所有打开的标注会被组装成一条结构化修改请求填入 AI 输入框——
              由你审阅后发送,AI 的文件提案仍走 Preview → Apply 人审流程。
            </p>
            <ul style={LIST_STYLE}>
              <li>编译出 PDF 后,可以直接在页面上拖框做区域标注(自动换算为缩放无关的坐标)。</li>
              <li>标注状态流转:open → proposed → resolved,已解决的区域在 PDF 上转绿。</li>
            </ul>
          </DocSection>

          <DocSection id="references" index={6} title="文献与 PDF 审阅">
            <p style={P_STYLE}>
              工作台底部的「文献」面板解析工作区里的 <code>.bib</code> 文件:
              每条文献显示作者 / 发表处 / 被引次数,点引用位置直达源码行;
              引了却没有条目的 key 会被醒目列出。
            </p>
            <ul style={LIST_STYLE}>
              <li>粘贴 DOI(<code>10.xxxx/yyy</code>)或 arXiv ID(<code>2401.12345</code>)一键导入 BibTeX,按条目 key 自动去重。</li>
              <li>编译出的 PDF 支持划词——选中一段文字点「问 AI」,检查表述与源码是否一致。</li>
            </ul>
          </DocSection>

          <DocSection id="sessions" index={7} title="会话管理与多网关">
            <p style={P_STYLE}>
              「会话」页保存你与 AI 的全部历史对话:可搜索、可查看当时的文件提案、
              一键「在工作台复用」并自动回到当时的工作区。
            </p>
            <ul style={LIST_STYLE}>
              <li>「模型 API Key」页可保存多个 Provider 档案(官方 / 中转 / 本地 vLLM),一键切换。</li>
              <li>工作台 AI 输入框上方可为单次对话临时指定档案。</li>
              <li>「API 用量」页给出真实的 token 输入/输出构成、24h 分布与按工作区排名。</li>
            </ul>
          </DocSection>

          <DocSection id="community" index={8} title="社区与技能市场">
            <p style={P_STYLE}>
              到<Link to="/community" className="ulink">社区广场</Link>
              分享模板与写作经验;在
              <Link to="/market" className="ulink">技能市场</Link>
              安装技能(一个 <code>SKILL.md</code> 加可选 MCP 工具),
              安装后即可在任意 <code>.tex</code> 文件里行级触发,
              也可以把团队自己的工作流写成技能共享给队友。
            </p>
          </DocSection>

          <Reveal delay={0.06}>
            <div className="row wrap" style={{ justifyContent: "center", marginTop: 10 }}>
              <Link to="/download" className="btn btn-primary">
                下载客户端
              </Link>
              <Link to="/pricing" className="btn btn-quiet">
                查看定价
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
