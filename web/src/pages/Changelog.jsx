import { Link } from "react-router-dom";
import Reveal from "../components/Reveal.jsx";

const RELEASES = [
  {
    ver: "v0.5.0",
    date: "2026-07-08",
    title: "事务化 Apply 与账户中心",
    latest: true,
    items: [
      "EditTransaction:AI 修改以事务化 Apply 落盘,批量改动要么全部成功、要么整体回滚",
      "Ctrl+P 快速打开:模糊匹配工作区内任意文件",
      "每用户加密 API Key:AES-256-GCM 本地加密存储,多账户相互隔离",
      "账户中心:个人资料、会话管理与用量明细",
      "安全加固:loopback 信任校验、路径遍历与 junction 逃逸防护、敏感接口限流",
    ],
  },
  {
    ver: "v0.4.0",
    date: "2026-05-19",
    title: "技能市场",
    items: [
      "技能市场上线:浏览、安装、运行与发布 SKILL.md 技能",
      "内建四类技能执行器:引用核验、CSV 探查、评审批注、紧凑改写",
      "社区帖子支持挂接技能,一键安装",
    ],
  },
  {
    ver: "v0.3.0",
    date: "2026-03-12",
    title: "Pack 能力门控与社区",
    items: [
      "Pack 能力门控:按 Pack 声明解锁编辑器能力,默认最小权限",
      "社区广场:模板分享、发帖与贡献排行榜",
      "团队空间雏形:多人工作区与任务看板",
    ],
  },
  {
    ver: "v0.2.0",
    date: "2026-01-20",
    title: "本地 LaTeX 编译",
    items: [
      "本地 LaTeX 编译:Ctrl+Shift+B 一键编译,源码与 PDF 并排预览",
      "编译日志面板:报错定位到具体行",
      "文件树与多标签编辑器打磨",
    ],
  },
  {
    ver: "v0.1.0",
    date: "2025-11-02",
    title: "Workspace Kernel",
    items: [
      "Workspace Kernel 首个公开版本:工作区、文件树、标签页与基础 LaTeX 编辑",
      "AI 聊天面板原型:行级引用与上下文注入",
    ],
  },
];

export default function Changelog() {
  return (
    <div className="container section">
      <Reveal className="section-head">
        <span className="eyebrow">更新日志</span>
        <h2>
          每一个版本,都朝着<span className="serif-it" style={{ color: "var(--amber)" }}>更快、更稳、更私密</span>。
        </h2>
        <p>
          从 Workspace Kernel 到事务化 Apply,这里记录 Paper OS
          的每一次公开发布。语义化版本,重要变更绝不悄悄发生。
        </p>
      </Reveal>

      <div style={{ position: "relative", marginTop: 32, maxWidth: 860 }}>
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 5,
            top: 12,
            bottom: 12,
            width: 1,
            background: "var(--ink-line-2)",
          }}
        />
        {RELEASES.map((r, i) => (
          <div
            key={r.ver}
            style={{ position: "relative", paddingLeft: 34, marginBottom: 20 }}
          >
            {r.latest ? (
              <span className="dot" style={{ position: "absolute", left: 2, top: 30 }} />
            ) : (
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: 2,
                  top: 30,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "var(--faint)",
                }}
              />
            )}
            <Reveal delay={i * 0.05}>
              <div
                className={r.latest ? "card lift" : "card"}
                style={
                  r.latest
                    ? {
                        border: "1px solid rgba(212, 163, 65, 0.5)",
                        boxShadow: "0 0 60px -24px rgba(212, 163, 65, 0.5)",
                      }
                    : {}
                }
              >
                <div className="spread wrap" style={{ marginBottom: 12 }}>
                  <div className="row wrap">
                    <span className={r.latest ? "chip" : "chip muted"}>{r.ver}</span>
                    {r.latest && <span className="chip signal">最新</span>}
                    <h3 className="display" style={{ fontSize: 21 }}>
                      {r.title}
                    </h3>
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "var(--muted)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {r.date}
                  </span>
                </div>
                <ul
                  style={{
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {r.items.map((it) => (
                    <li
                      key={it}
                      style={{
                        display: "flex",
                        gap: 10,
                        fontSize: 13.5,
                        lineHeight: 1.65,
                        color: "var(--text-soft)",
                      }}
                    >
                      <span style={{ color: "var(--amber)", flexShrink: 0 }}>—</span>
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        ))}
      </div>

      <Reveal delay={0.08}>
        <div className="row wrap" style={{ justifyContent: "center", marginTop: 36 }}>
          <Link to="/download" className="btn btn-primary">
            获取最新版本
          </Link>
          <Link to="/docs" className="btn btn-quiet">
            阅读入门文档
          </Link>
        </div>
      </Reveal>
    </div>
  );
}
