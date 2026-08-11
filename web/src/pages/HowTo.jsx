import Reveal from "../components/Reveal.jsx";

const STEPS = [
  { n: "01", t: "安装与启动", d: "在 Windows 上双击 PaperOS.exe，打开原生 IDE 窗口（本地免登录）。完整验证/构建还需 Python 与 latexmk。", code: "PaperOS.exe" },
  { n: "02", t: "注册并配置网关", d: "注册账号（本机首个账号为 owner），在工作台填入 base URL、API Key 环境变量与模型。", code: "paperctl provider-set --base-url https://api.openai.com/v1 \\\n  --api-key-env OPENAI_API_KEY --model gpt-5.4" },
  { n: "03", t: "创建工作区", d: "一条命令创建工作区并导入文档、数据与规则，自动写入流水线报告与首个接入提示。", code: "paperctl onboard my-paper --problem problem.pdf --data data.csv" },
  { n: "04", t: "按阶段推进", d: "用 status 看下一步，advance 生成阶段提示，run-stage 调用模型，产出先落到 ai-runs 供审查。", code: "paperctl status my-paper\npaperctl advance my-paper --dry-run" },
  { n: "05", t: "审查后再落盘", d: "AI 响应中的 BEGIN_FILE 块默认只预览，确认无误后再用 --apply 写入论文文件。", code: "paperctl apply-response my-paper ai-runs/<run>/response.md --apply" },
  { n: "06", t: "验证·构建·打包", d: "verify 跑 50+ 项检查，build 用 latexmk 出 PDF，package-submission 生成最终提交包。", code: "paperctl verify my-paper\npaperctl build my-paper\npaperctl package-submission my-paper" },
];

export default function HowTo() {
  return (
    <div className="container section">
      <Reveal className="section-head">
        <span className="kicker">如何使用</span>
        <h2>六步，从新建工作区走到<span className="display italic" style={{ color: "var(--jade-bright)" }}>可验证的 PDF</span></h2>
        <p>运行闭环：status / pipeline → advance 或 run-stage → 审查 response → apply-response 预览 → --apply → verify → build。</p>
      </Reveal>

      <div className="stack" style={{ gap: 16 }}>
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.04} className="card lift" >
            <div style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: 20, alignItems: "start" }}>
              <div className="display" style={{ fontSize: 40, color: "var(--jade-bright)", fontStyle: "italic" }}>{s.n}</div>
              <div>
                <h3 style={{ fontSize: 19, marginBottom: 8 }}>{s.t}</h3>
                <p style={{ color: "var(--muted)", lineHeight: 1.7, marginBottom: 14 }}>{s.d}</p>
                <pre style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, background: "rgba(0,0,0,.35)", border: "1px solid var(--glass-border)", padding: "12px 14px", borderRadius: "var(--radius-xs)", overflowX: "auto", whiteSpace: "pre-wrap", color: "var(--text-soft)" }}>{s.code}</pre>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
