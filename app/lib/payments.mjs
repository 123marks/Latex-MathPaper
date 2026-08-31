// 支付通道注册表（诚实骨架）：manual（渠道外收款 + 激活码）今天即可用；
// 其余通道只有在真实商户凭据出现在环境变量里时才报告可用——绝不伪造对接。
// 接入真网关时在此扩展 handler，而不是在路由里散落 if。
export function paymentProviderStatus(env = process.env) {
  return [
    {
      id: "manual",
      name: "线下收款 + 激活码",
      available: true,
      note: "收款在渠道外完成（转账/对公/平台代收），管理员在本页签发激活码。当前唯一可用通道。",
    },
    {
      id: "stripe",
      name: "Stripe",
      available: Boolean(env.STRIPE_SECRET_KEY),
      note: env.STRIPE_SECRET_KEY ? "检测到 STRIPE_SECRET_KEY；结算流程尚未实现。" : "需要 STRIPE_SECRET_KEY 商户凭据。",
    },
    {
      id: "wechat",
      name: "微信支付",
      available: Boolean(env.WECHAT_PAY_MCH_ID),
      note: env.WECHAT_PAY_MCH_ID ? "检测到商户号；结算流程尚未实现。" : "需要商户号与 API 证书。",
    },
    {
      id: "alipay",
      name: "支付宝",
      available: Boolean(env.ALIPAY_APP_ID),
      note: env.ALIPAY_APP_ID ? "检测到应用凭据；结算流程尚未实现。" : "需要开放平台应用凭据。",
    },
  ];
}
