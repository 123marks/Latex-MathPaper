const stageOrder = ["intake", "modeling", "figure", "writing", "verification"];
const stateLabels = {
  done: "Done",
  todo: "Todo",
  in_progress: "Writing",
  blocked: "Blocked",
};

const el = (id) => document.getElementById(id);

function setView(view) {
  const nextView = view === "app" ? "app" : "home";
  document.body.dataset.view = nextView;
  el("viewToggle").textContent = nextView === "app" ? "Official Site" : "Enter App";
  el("viewToggle").setAttribute("aria-pressed", nextView === "app" ? "true" : "false");
  if (location.hash !== (nextView === "app" ? "#app" : "#home")) {
    history.replaceState(null, "", nextView === "app" ? "#app" : "#home");
  }
  requestAnimationFrame(() => {
    document.querySelector(nextView === "app" ? "#studio" : "#home")?.scrollIntoView({ block: "start" });
  });
}

function setDrawerTab(tab) {
  document.querySelectorAll("[data-drawer-tab]").forEach((button) => {
    const active = button.dataset.drawerTab === tab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.querySelectorAll("[data-drawer-panel]").forEach((panel) => {
    const active = panel.dataset.drawerPanel === tab;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function log(message, payload) {
  const stamp = new Date().toLocaleTimeString();
  const body = payload
    ? `${message}\n${typeof payload === "string" ? payload : JSON.stringify(payload, null, 2)}`
    : message;
  el("log").textContent = `[${stamp}] ${body}\n\n${el("log").textContent}`;
}

function setBusy(target, busy) {
  if (!target) return;
  target.disabled = busy;
  target.classList.toggle("is-running", busy);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "request failed");
  return data;
}

function activeContest() {
  return el("contestSelect").value || el("activeContest").textContent;
}

function renderStages(status) {
  const statuses = status?.statuses || {};
  const nextStage = status?.nextStage || "unknown";
  el("nextStage").textContent = nextStage ? `Next: ${nextStage}` : "All stages still need final review";
  el("stages").innerHTML = stageOrder
    .map((stage, index) => {
      const item = statuses[stage] || { state: "todo", note: "waiting for status" };
      return `
        <article class="stage ${escapeHtml(item.state)}" style="animation-delay:${index * 90}ms">
          <span class="state">${escapeHtml(stateLabels[item.state] || item.state)}</span>
          <small class="stage-index">${String(index + 1).padStart(2, "0")}</small>
          <h3>${escapeHtml(stage)}</h3>
          <p>${escapeHtml(item.note)}</p>
          <code>paperctl:${escapeHtml(stage)}</code>
        </article>
      `;
    })
    .join("");
}

function renderRecommendations(id, items, emptyText) {
  const target = el(id);
  if (!items.length) {
    target.innerHTML = `<p>${escapeHtml(emptyText)}</p>`;
    return;
  }
  target.innerHTML = items
    .map((item) => {
      const install = item.install ? `<code>${escapeHtml(item.install)}</code>` : "";
      const risk = item.risk ? `<p class="risk">${escapeHtml(item.risk)}</p>` : "";
      return `
        <article class="recommend">
          <strong>${escapeHtml(item.id)}</strong>
          <span>${escapeHtml(item.priority || item.source || "candidate")}</span>
          <p>${escapeHtml(item.summary || "")}</p>
          ${risk}
          ${install}
        </article>
      `;
    })
    .join("");
}

function renderBlueprint(blueprint) {
  const lanes = blueprint?.lanes || [];
  el("blueprintLanes").innerHTML = lanes
    .map((lane, index) => `
      <article class="lane-card" style="animation-delay:${index * 70}ms">
        <span>${escapeHtml(lane.id)}</span>
        <h3>${escapeHtml(lane.title)}</h3>
        <p>${escapeHtml(lane.goal)}</p>
        <code>${escapeHtml(lane.entry_command)}</code>
      </article>
    `)
    .join("");
}

function fillProvider(config) {
  const providers = config?.providers || {};
  const provider = providers.default || Object.values(providers)[0] || {};
  el("providerName").value = "default";
  el("baseUrl").value = provider.base_url || "";
  el("apiKeyEnv").value = provider.api_key_env || "";
  el("model").value = provider.model || "";
  el("temperature").value = provider.temperature ?? 0.2;
  el("timeout").value = provider.timeout ?? 120;
}

function fillRuntime(runtime) {
  if (!runtime) return;
  el("runtimeUrl").textContent = runtime.url || "unknown";
  el("runtimeNode").textContent = runtime.node || "unknown";
  el("runtimePython").textContent = runtime.python?.ok ? runtime.python.detail : "missing";
  el("runtimeLatex").textContent = runtime.latexmk?.ok ? runtime.latexmk.detail || "available" : "missing";
}

async function loadSummary() {
  const summary = await api("/api/summary");
  el("contestSelect").innerHTML = summary.contests.length
    ? summary.contests.map((contest) => `<option value="${escapeHtml(contest)}">${escapeHtml(contest)}</option>`).join("")
    : `<option value="">No contest workspace</option>`;
  if (summary.activeContest) el("contestSelect").value = summary.activeContest;
  el("activeContest").textContent = summary.activeContest || "no-contest";
  fillRuntime(summary.runtime);
  fillProvider(summary.providerConfig);
  renderStages(summary.status);
  log("Workbench connected", { root: summary.root, providerConfigPath: summary.providerConfigPath });
}

async function loadIntelligence() {
  const stage = el("intelStage").value;
  const data = await api(`/api/intelligence?stage=${encodeURIComponent(stage)}`);
  renderBlueprint(data.blueprint);
  renderRecommendations("skillList", data.skills, "No skill candidates configured for this stage.");
  renderRecommendations("mcpList", data.mcp, "No MCP candidates configured for this stage.");
}

async function createContest() {
  const contestId = el("contestIdInput").value.trim();
  if (!contestId) return log("Contest ID is required");
  setBusy(el("createContestBtn"), true);
  try {
    const result = await api("/api/contest", {
      method: "POST",
      body: JSON.stringify({ contestId }),
    });
    log("Workspace command executed", result.stdout || result.stderr);
    await loadSummary();
    el("contestSelect").value = contestId;
  } finally {
    setBusy(el("createContestBtn"), false);
  }
}

async function saveProvider() {
  const payload = {
    provider: el("providerName").value.trim() || "default",
    base_url: el("baseUrl").value.trim(),
    api_key_env: el("apiKeyEnv").value.trim(),
    model: el("model").value.trim(),
    temperature: el("temperature").value,
    timeout: el("timeout").value,
  };
  setBusy(el("saveProviderBtn"), true);
  try {
    const result = await api("/api/provider", { method: "POST", body: JSON.stringify(payload) });
    fillProvider(result.providerConfig);
    log("Provider saved", result.stdout || result);
  } finally {
    setBusy(el("saveProviderBtn"), false);
  }
}

async function uploadFile() {
  const payload = {
    contestId: activeContest(),
    sourcePath: el("sourcePath").value.trim(),
    targetArea: el("targetArea").value,
  };
  setBusy(el("uploadBtn"), true);
  try {
    const result = await api("/api/upload", { method: "POST", body: JSON.stringify(payload) });
    log("Material imported", result.stdout || result);
  } finally {
    setBusy(el("uploadBtn"), false);
  }
}

function splitPaths(value) {
  return value
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function onboardContest() {
  const payload = {
    contestId: activeContest(),
    problemFiles: splitPaths(el("onboardProblem").value),
    dataFiles: splitPaths(el("onboardData").value),
    referenceFiles: splitPaths(el("onboardReferences").value),
  };
  setBusy(el("onboardBtn"), true);
  try {
    const result = await api("/api/onboard", { method: "POST", body: JSON.stringify(payload) });
    log("Contest onboard complete", result.stdout || result.stderr || result);
    await loadSummary();
  } finally {
    setBusy(el("onboardBtn"), false);
  }
}

async function refreshContestDetail() {
  const contest = activeContest();
  if (!contest || contest === "no-contest") return;
  const detail = await api(`/api/contest/${contest}`);
  renderStages(detail.status);
}

async function runCommand(command) {
  const button = document.querySelector(`[data-command="${CSS.escape(command)}"]`);
  setBusy(button, true);
  try {
    const result = await api("/api/run", {
      method: "POST",
      body: JSON.stringify({ contestId: activeContest(), command }),
    });
    log(`Command complete: ${command}`, result.stdout || result.stderr || result);
    if (["status", "pipeline", "advance", "verify", "build", "package-submission"].includes(command)) {
      await refreshContestDetail();
    }
  } finally {
    setBusy(button, false);
  }
}

document.addEventListener("click", (event) => {
  const drawerTab = event.target?.dataset?.drawerTab;
  if (drawerTab) {
    setDrawerTab(drawerTab);
    return;
  }
  const command = event.target?.dataset?.command;
  if (command) {
    runCommand(command).catch((error) => log("Command failed", error.message));
  }
});

el("refreshBtn").addEventListener("click", () => loadSummary().catch((error) => log("Refresh failed", error.message)));
el("viewToggle").addEventListener("click", () => setView(document.body.dataset.view === "app" ? "home" : "app"));
el("enterAppBtn").addEventListener("click", () => setView("app"));
el("backHomeBtn").addEventListener("click", () => setView("home"));
el("createContestBtn").addEventListener("click", () => createContest().catch((error) => log("Create failed", error.message)));
el("saveProviderBtn").addEventListener("click", () => saveProvider().catch((error) => log("Save failed", error.message)));
el("uploadBtn").addEventListener("click", () => uploadFile().catch((error) => log("Import failed", error.message)));
el("onboardBtn").addEventListener("click", () => onboardContest().catch((error) => log("Onboard failed", error.message)));
el("clearLogBtn").addEventListener("click", () => {
  el("log").textContent = "";
});
el("contestSelect").addEventListener("change", () => runCommand("status").catch((error) => log("Status failed", error.message)));
el("intelStage").addEventListener("change", () => loadIntelligence().catch((error) => log("Intelligence failed", error.message)));

loadSummary().catch((error) => log("Startup failed", error.message));
loadIntelligence().catch((error) => log("Intelligence failed", error.message));
window.setView = setView;
window.loadSummary = loadSummary;
window.loadIntelligence = loadIntelligence;
setDrawerTab("provider");
setView(location.hash === "#app" || location.hash === "#studio" ? "app" : "home");
