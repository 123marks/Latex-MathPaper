import Reveal from "../components/Reveal.jsx";

// 六步真实上手路径：以 IDE 工作流为主线（下载 → 模型档案 → 工作区 →
// AI 审改 → 文献 → 编译），每步都对应产品里真实存在的能力。
const STEPS = [
  {
    n: "01",
    t: "下载并启动",
    d: "Windows 解压 ZIP 后运行；macOS / Linux 用便携版（需要 Node.js 20+）。服务只监听本机 127.0.0.1:3719，数据全部留在本地。",
    code: "# Windows\n解压 PaperOS-x.y.z-windows-x64.zip → 双击 PaperOS.exe 或 node app/server.mjs\n\n# macOS / Linux（便携版）\ntar -xzf PaperOS-x.y.z-portable-node.tar.gz && sh PaperOS-*/start.sh",
  },
  {
    n: "02",
    t: "首个账号即 owner，配置模型档案",
    d: "本机注册的第一个账号自动成为 owner。在「模型 API Key」里保存一个或多个 Provider 档案（官方 / 中转 / 本地 vLLM），Key 以 AES-256-GCM 加密存本机，一键切换，聊天时还能按次指定。",
    code: "设置 → 模型 API Key → Provider 档案 → 添加（名称 / Base URL / Model / Key）",
  },
  {
    n: "03",
    t: "建工作区，管好文件",
    d: "顶栏切换器新建或切换工作区。文件树支持新建文件/文件夹、重命名（改完整路径即移动）、删除；Ctrl+P 模糊打开任意文件。",
    code: "工作台左栏：＋文件 / ＋目录 / ✎ 重命名 / × 删除　·　Ctrl+P 快速打开",
  },
  {
    n: "04",
    t: "让 AI 改，但你说了算",
    d: "选中源码行圈选批注（意图/优先级），一键「交给 AI 修改」生成结构化请求；AI 的文件提案永远先 Preview 再 Apply，冲突会拦截、失败会回滚。历史对话在「会话」页可搜索、可复用。",
    code: "编辑器选中 → 加批注 → 交给 AI 修改 → 审查 diff → Apply",
  },
  {
    n: "05",
    t: "文献与 PDF 审阅",
    d: "工作台底部「文献」面板解析工作区 .bib：citation↔source 双链、缺失引用警示、DOI / arXiv 一键导入。编译出的 PDF 可划词问 AI，也可拖框做区域标注。",
    code: "文献 → 导入框粘贴 10.xxxx/yyy 或 arXiv:2401.12345\nPDF → 选中文字「问 AI」 / ▣ 标注区域",
  },
  {
    n: "06",
    t: "编译、验证、看用量",
    d: "工作台内一键下载 Tectonic 后即可 Recompile 出 PDF。API 用量页给出真实的 token 构成、24h 分布与按工作区排名。进阶用户可用 paperctl 命令行跑 verify / build / package-submission。",
    code: "⟲ Recompile → PDF 预览\npaperctl verify my-paper && paperctl build my-paper",
  },
];

export default function HowTo() {
  return (
    <div className="container section">
      <Reveal className="section-head">
        <span className="kicker">如何使用</span>
        <h2>
          六步，从下载走到
          <span className="display italic" style={{ color: "var(--amber-bright, var(--amber))" }}>可验证的 PDF</span>
        </h2>
        <p>每一步都是产品里真实存在的能力：本地运行、人审 AI 提案、证据可追溯。</p>
      </Reveal>

      <div className="stack" style={{ gap: 16 }}>
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.04} className="card lift">
            <div style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: 20, alignItems: "start" }}>
              <div className="display" style={{ fontSize: 40, color: "var(--amber-bright, var(--amber))", fontStyle: "italic" }}>{s.n}</div>
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
