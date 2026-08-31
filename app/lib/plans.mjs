// 计划与容量档位（付费权益的单一事实来源）。免费档保持既有能力不倒退；
// 付费档只增加容量。发布在定价页的数字必须与这里一致。
export const PLAN_LIMITS = {
  free: { providerProfiles: 3, chatHistory: 200 },
  pro: { providerProfiles: 10, chatHistory: 1000 },
  team: { providerProfiles: 10, chatHistory: 1000 },
};

// 过期即回落 free；未知计划一律按 free 处理。
export function effectivePlan(user, now = Date.now()) {
  const plan = user?.plan;
  if (!plan || !PLAN_LIMITS[plan] || plan === "free") return "free";
  const expires = user?.planExpiresAt ? new Date(user.planExpiresAt).getTime() : 0;
  return Number.isFinite(expires) && expires > now ? plan : "free";
}

export function planLimits(user, now = Date.now()) {
  return PLAN_LIMITS[effectivePlan(user, now)];
}

// 按用户裁剪会话历史：仅删除该用户最旧的超额线程，别人的不动。
export function trimUserThreads(threads, userId, limit) {
  const mine = threads.filter((t) => t.userId === userId);
  if (mine.length <= limit) return threads;
  const drop = new Set(mine.slice(0, mine.length - limit).map((t) => t.id));
  return threads.filter((t) => !drop.has(t.id));
}
