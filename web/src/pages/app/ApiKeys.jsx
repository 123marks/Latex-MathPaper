import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { useAuth } from "../../lib/auth.jsx";

// 模型 API Key:配置 OpenAI 兼容网关 + 管理本机加密存储的 Key。
// Key 走 AES-256-GCM 加密写入本机数据目录,后端永远不会回传明文。
export default function ApiKeys() {
  const { user } = useAuth();

  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 网关配置表单
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [temperature, setTemperature] = useState("0.7");
  const [configBusy, setConfigBusy] = useState(false);
  const [configError, setConfigError] = useState("");
  const [configSaved, setConfigSaved] = useState(false);

  // API Key 表单(只写不读)
  const [keyInput, setKeyInput] = useState("");
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [keyMsg, setKeyMsg] = useState("");

  const applyProvider = useCallback((p) => {
    setProvider(p || null);
    setBaseUrl(p?.base_url || "");
    setModel(p?.model || "");
    setTemperature(
      p?.temperature === null || p?.temperature === undefined ? "0.7" : String(p.temperature),
    );
  }, []);

  useEffect(() => {
    api
      .get("/api/account/overview")
      .then((data) => applyProvider(data.provider))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [applyProvider]);

  async function saveConfig(e) {
    e.preventDefault();
    setConfigError("");
    setConfigSaved(false);
    const temp = Number(temperature);
    if (!Number.isFinite(temp) || temp < 0 || temp > 2) {
      setConfigError("Temperature 需要在 0 到 2 之间。");
      return;
    }
    setConfigBusy(true);
    try {
      const data = await api.put("/api/account/provider", {
        base_url: baseUrl.trim(),
        model: model.trim(),
        temperature: temp,
      });
      if (data.provider) applyProvider(data.provider);
      setConfigSaved(true);
    } catch (err) {
      setConfigError(err.message);
    } finally {
      setConfigBusy(false);
    }
  }

  async function saveKey() {
    setKeyError("");
    setKeyMsg("");
    const apiKey = keyInput.trim();
    if (!apiKey) {
      setKeyError("请先粘贴要保存的 API Key。");
      return;
    }
    setKeyBusy(true);
    try {
      const data = await api.put("/api/account/provider", { apiKey });
      if (data.provider) {
        applyProvider(data.provider);
      } else {
        setProvider((p) => (p ? { ...p, hasKey: true, source: "user" } : p));
      }
      setKeyInput("");
      setKeyMsg("Key 已加密保存");
    } catch (err) {
      setKeyError(err.message);
    } finally {
      setKeyBusy(false);
    }
  }

  async function deleteKey() {
    setKeyError("");
    setKeyMsg("");
    setKeyBusy(true);
    try {
      const data = await api.del("/api/account/provider/key");
      if (data.provider) {
        applyProvider(data.provider);
      } else {
        setProvider((p) => (p ? { ...p, hasKey: false } : p));
      }
      setKeyMsg("Key 已删除");
    } catch (err) {
      setKeyError(err.message);
    } finally {
      setKeyBusy(false);
    }
  }

  const hasKey = !!provider?.hasKey;
  const isFallback = provider?.source === "fallback";

  return (
    <>
      <div className="page-head">
        <h1>模型 API Key</h1>
        <p>
          Key 使用 AES-256-GCM 加密后只存放在本机,永远不会上传;仅用于你自己的对话与行内编辑调用。
        </p>
      </div>

      {error && (
        <div className="alert error" style={{ margin: "18px 26px 0" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="spinner" style={{ margin: 26 }} />
      ) : !provider ? null : (
        <div className="dash-grid">
          <section className="panel c12 glass">
            <div className="panel-head">
              <h3>模型网关</h3>
              <span className={`chip ${isFallback ? "muted" : ""}`}>
                {isFallback ? "共享默认网关" : "自定义网关"}
              </span>
            </div>

            {isFallback && (
              <div
                style={{
                  marginBottom: 16,
                  padding: "10px 12px",
                  border: "1px dashed var(--glass-border-2)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--muted)",
                  fontSize: 12.5,
                  lineHeight: 1.6,
                }}
              >
                当前正在使用共享/默认网关配置。填入你自己的 Base URL、模型与 Key
                后,所有调用都会改走你的网关。
              </div>
            )}

            {configError && (
              <div className="alert error" style={{ marginBottom: 14 }}>
                {configError}
              </div>
            )}

            <form onSubmit={saveConfig}>
              <div className="grid-2">
                <label className="field">
                  <span>Base URL</span>
                  <input
                    value={baseUrl}
                    onChange={(e) => {
                      setBaseUrl(e.target.value);
                      setConfigSaved(false);
                    }}
                    placeholder="https://api.openai.com/v1"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
                <label className="field">
                  <span>Model</span>
                  <input
                    value={model}
                    onChange={(e) => {
                      setModel(e.target.value);
                      setConfigSaved(false);
                    }}
                    placeholder="gpt-4o"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
              </div>
              <label className="field" style={{ maxWidth: 220 }}>
                <span>Temperature(0 - 2)</span>
                <input
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => {
                    setTemperature(e.target.value);
                    setConfigSaved(false);
                  }}
                />
              </label>
              <div className="row" style={{ gap: 10 }}>
                <button
                  className={`btn btn-primary ${configBusy ? "is-running" : ""}`}
                  disabled={configBusy}
                >
                  {configBusy ? "保存中" : "保存配置"}
                </button>
                {configSaved && <span className="chip signal">配置已保存</span>}
              </div>
            </form>

            <hr className="divider" style={{ margin: "22px 0" }} />

            <div className="panel-head">
              <h3>API Key</h3>
              {hasKey ? (
                <span className="chip signal">已配置 · 已加密存储</span>
              ) : (
                <span className="chip muted">未配置</span>
              )}
            </div>

            {keyError && (
              <div className="alert error" style={{ marginBottom: 14 }}>
                {keyError}
              </div>
            )}

            <label className="field">
              <span>新的 API Key(只写入,保存后不再显示)</span>
              <input
                type="password"
                value={keyInput}
                onChange={(e) => {
                  setKeyInput(e.target.value);
                  setKeyMsg("");
                }}
                placeholder={hasKey ? "粘贴新 Key 以替换已存储的 Key" : "sk-..."}
                autoComplete="new-password"
                spellCheck={false}
              />
            </label>
            <div className="row wrap" style={{ gap: 10 }}>
              <button
                type="button"
                className={`btn btn-primary ${keyBusy ? "is-running" : ""}`}
                disabled={keyBusy}
                onClick={saveKey}
              >
                {keyBusy ? "处理中" : "保存 Key"}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={keyBusy || !hasKey}
                onClick={deleteKey}
              >
                删除 Key
              </button>
              {keyMsg && <span className="chip signal">{keyMsg}</span>}
            </div>
          </section>

          <div
            className="panel c12"
            style={{
              background: "transparent",
              border: "1px dashed var(--ink-line-2)",
              color: "var(--muted)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              lineHeight: 1.7,
            }}
          >
            安全说明:@{user?.username || "你"} 的 Key 经 AES-256-GCM
            加密后写入本机数据目录,不会进入任何遥测或云端同步;只有本机发起的
            chat / inline-edit 请求会在内存中解密使用。删除 Key 即时生效。
          </div>
        </div>
      )}
    </>
  );
}
