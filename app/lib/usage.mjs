// Pure usage/pricing helpers. Extracted from server.mjs (STATUS risk #6:
// monolith split) with zero behaviour change; unit-testable directly.

export const PRICE_PER_1K = {
  "gpt-4o": { prompt: 0.005, completion: 0.015 },
  "gpt-4o-mini": { prompt: 0.00015, completion: 0.0006 },
  "gpt-5.4": { prompt: 0.01, completion: 0.03 },
  "claude-sonnet-4": { prompt: 0.003, completion: 0.015 },
  "claude-opus-4": { prompt: 0.015, completion: 0.075 },
  "deepseek-chat": { prompt: 0.00027, completion: 0.0011 },
  "deepseek-reasoner": { prompt: 0.00055, completion: 0.00219 },
  default: { prompt: 0.002, completion: 0.006 },
};

export function estimateCost(model, promptTok, completionTok) {
  const p = PRICE_PER_1K[model] || PRICE_PER_1K.default;
  return (promptTok / 1000) * p.prompt + (completionTok / 1000) * p.completion;
}

export function aggregateUsage(records, days = 30) {
  const cutoff = Date.now() - days * 86400000;
  const inWindow = records.filter((r) => new Date(r.at).getTime() >= cutoff);
  const byDay = {};
  const byModel = {};
  const byWorkspace = {};
  const byHour = new Array(24).fill(0);
  let total = 0, prompt = 0, completion = 0, cost = 0;
  for (const r of inWindow) {
    const day = String(r.at).slice(0, 10);
    byDay[day] = (byDay[day] || 0) + r.totalTokens;
    byModel[r.model] = byModel[r.model] || { tokens: 0, cost: 0, requests: 0 };
    byModel[r.model].tokens += r.totalTokens;
    byModel[r.model].cost += r.costUsd;
    byModel[r.model].requests += 1;
    // Server-local hour of day; older records without workspace group honestly.
    const hour = new Date(r.at).getHours();
    if (hour >= 0 && hour < 24) byHour[hour] += r.totalTokens;
    const ws = r.workspace || "未标注";
    byWorkspace[ws] = byWorkspace[ws] || { tokens: 0, requests: 0 };
    byWorkspace[ws].tokens += r.totalTokens;
    byWorkspace[ws].requests += 1;
    total += r.totalTokens;
    prompt += r.promptTokens;
    completion += r.completionTokens;
    cost += r.costUsd;
  }
  const daily = Object.entries(byDay).sort().map(([day, tokens]) => ({ day, tokens }));
  const models = Object.entries(byModel).map(([model, v]) => ({ model, ...v, costUsd: Number(v.cost.toFixed(6)) })).sort((a, b) => b.tokens - a.tokens);
  const workspaces = Object.entries(byWorkspace)
    .map(([workspace, v]) => ({ workspace, ...v }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 20);
  return {
    totalRequests: inWindow.length,
    totalTokens: total,
    promptTokens: prompt,
    completionTokens: completion,
    costUsd: Number(cost.toFixed(6)),
    daily,
    models,
    workspaces,
    hours: byHour,
  };
}
