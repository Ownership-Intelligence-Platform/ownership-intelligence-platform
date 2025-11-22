// intents.js
// Dashboard intent detection utilities.

export function triggerDashboardIntents(text) {
  const t = (text || "").toLowerCase();
  const dispatchClick = (id) =>
    document.getElementById(id)?.dispatchEvent(new Event("click"));
  const hasRoot = !!document.getElementById("rootId")?.value?.trim();
  const rules = [
    { re: /(交易|transact|transfer)/i, id: "loadTransactions", needRoot: true },
    { re: /(担保|guarantee)/i, id: "loadGuarantees", needRoot: true },
    { re: /(供应链|supply)/i, id: "loadSupplyChain", needRoot: true },
    {
      re: /(任职|就业|职位|employment|role)/i,
      id: "loadEmployment",
      needRoot: true,
    },
    { re: /(地址|location|address)/i, id: "loadLocations", needRoot: true },
    { re: /(新闻|news)/i, id: "loadNews", needRoot: true },
    {
      re: /(穿透|penetration|股权图|graph)/i,
      id: "loadPenetration",
      needRoot: false,
    },
    { re: /(账户|账号|account)/i, id: "loadAccounts", needRoot: true },
    { re: /(风险|risk)/i, id: "analyzeRisks", needRoot: true },
    {
      re: /(人际|关系网络|person network|关系图)/i,
      id: "loadPersonNetwork",
      needRoot: true,
    },
  ];
  for (const r of rules) {
    if (r.re.test(t) && (!r.needRoot || hasRoot)) dispatchClick(r.id);
  }
}

export function getDashboardMatches(text) {
  const t = (text || "").toLowerCase();
  const hasRoot = !!document.getElementById("rootId")?.value?.trim();
  const rules = [
    {
      re: /(交易|transact|transfer)/i,
      id: "loadTransactions",
      label: "交易",
      needRoot: true,
    },
    {
      re: /(担保|guarantee)/i,
      id: "loadGuarantees",
      label: "担保",
      needRoot: true,
    },
    {
      re: /(供应链|supply)/i,
      id: "loadSupplyChain",
      label: "供应链",
      needRoot: true,
    },
    {
      re: /(任职|就业|职位|employment|role)/i,
      id: "loadEmployment",
      label: "任职",
      needRoot: true,
    },
    {
      re: /(地址|location|address)/i,
      id: "loadLocations",
      label: "地址",
      needRoot: true,
    },
    { re: /(新闻|news)/i, id: "loadNews", label: "新闻", needRoot: true },
    {
      re: /(穿透|penetration|股权图|graph)/i,
      id: "loadPenetration",
      label: "穿透",
      needRoot: false,
    },
    {
      re: /(账户|账号|account)/i,
      id: "loadAccounts",
      label: "账户",
      needRoot: true,
    },
    { re: /(风险|risk)/i, id: "analyzeRisks", label: "风险", needRoot: true },
    {
      re: /(人际|关系网络|person network|关系图)/i,
      id: "loadPersonNetwork",
      label: "关系网络",
      needRoot: true,
    },
  ];
  const matches = [];
  for (const r of rules) {
    if (r.re.test(t) && (!r.needRoot || hasRoot)) matches.push(r);
  }
  return matches;
}
