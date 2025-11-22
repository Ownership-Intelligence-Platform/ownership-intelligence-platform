// Module to handle MCP Services Panel

const mcpCategories = [
  {
    title: "工商/登记/变更",
    items: [
      {
        id: "mcp-qichacha",
        name: "企查查企业API",
        desc: "企业主体、历史名称、股权结构",
        icon: "🏢",
      },
      {
        id: "mcp-tianyancha",
        name: "天眼查企业API",
        desc: "工商信息、关联风险",
        icon: "👁️",
      },
      {
        id: "mcp-gsxt",
        name: "国家企业信用公示",
        desc: "官方工商数据、经营异常",
        icon: "🇨🇳",
      },
    ],
  },
  {
    title: "司法/执行/失信",
    items: [
      {
        id: "mcp-wenshu",
        name: "中国裁判文书网",
        desc: "判决书、裁定书检索",
        icon: "⚖️",
      },
      {
        id: "mcp-shixin",
        name: "失信被执行人",
        desc: "失信黑名单、限制高消费",
        icon: "🚫",
      },
      {
        id: "mcp-legal-vendor",
        name: "法海风控",
        desc: "司法案件标签化数据",
        icon: "📜",
      },
    ],
  },
  {
    title: "招聘平台信号",
    items: [
      {
        id: "mcp-zhaopin",
        name: "智联招聘",
        desc: "岗位发布、薪资分析",
        icon: "💼",
      },
      { id: "mcp-51job", name: "前程无忧", desc: "企业招聘活跃度", icon: "👔" },
      {
        id: "mcp-boss",
        name: "BOSS直聘",
        desc: "急招岗位、业务扩张信号",
        icon: "⚡",
      },
    ],
  },
  {
    title: "招投标/政府采购",
    items: [
      {
        id: "mcp-gov-procure",
        name: "中国政府采购网",
        desc: "中标公告、废标记录",
        icon: "🏛️",
      },
      {
        id: "mcp-bid-agg",
        name: "招投标聚合平台",
        desc: "历史中标、供应商画像",
        icon: "📊",
      },
    ],
  },
  {
    title: "舆情/新闻/公告",
    items: [
      {
        id: "mcp-news-api",
        name: "主流媒体新闻源",
        desc: "官媒RSS、监管公告",
        icon: "📰",
      },
      {
        id: "mcp-sentiment",
        name: "商业舆情分析",
        desc: "情感倾向、负面预警",
        icon: "📉",
      },
    ],
  },
  {
    title: "合规/制裁/PEP",
    items: [
      {
        id: "mcp-sanctions",
        name: "全球制裁名单",
        desc: "UN/OFAC/EU/World-Check",
        icon: "🌍",
      },
      {
        id: "mcp-tax",
        name: "税务评级公示",
        desc: "纳税信用A级/黑名单",
        icon: "💰",
      },
    ],
  },
];

export function initMcpPanel() {
  const toggleBtn = document.getElementById("mcpToggleBtn");
  const panel = document.getElementById("mcpPanel");
  const backdrop = document.getElementById("mcpPanelBackdrop");
  const closeBtn = document.getElementById("mcpPanelClose");
  const listContainer = document.getElementById("mcpServicesList");
  const countSpan = document.getElementById("mcpActiveCount");

  if (!toggleBtn || !panel || !listContainer) return;

  // Render List
  renderMcpList(listContainer);

  // Event Listeners
  toggleBtn.addEventListener("click", () => openPanel(panel, backdrop));
  closeBtn.addEventListener("click", () => closePanel(panel, backdrop));
  backdrop.addEventListener("click", () => closePanel(panel, backdrop));

  // Update count on change
  listContainer.addEventListener("change", () => {
    updateActiveCount(listContainer, countSpan, toggleBtn);
  });

  // Initial update to reflect default state
  updateActiveCount(listContainer, countSpan, toggleBtn);
}

function renderMcpList(container) {
  container.innerHTML = mcpCategories
    .map(
      (cat) => `
    <div class="space-y-3">
      <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">${
        cat.title
      }</h3>
      <div class="space-y-2">
        ${cat.items
          .map(
            (item) => `
          <label class="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 hover:border-indigo-500 dark:hover:border-indigo-500 transition-all cursor-pointer group">
            <div class="flex-shrink-0 mt-0.5 text-xl">${item.icon}</div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between mb-0.5">
                <span class="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">${item.name}</span>
                <input type="checkbox" name="mcp_service" value="${item.id}" checked class="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:ring-offset-slate-800">
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">${item.desc}</p>
            </div>
          </label>
        `
          )
          .join("")}
      </div>
    </div>
  `
    )
    .join("");
}

function openPanel(panel, backdrop) {
  panel.classList.remove("-translate-x-full");
  backdrop.classList.remove("hidden");
  // small delay to allow display:block to apply before opacity transition
  setTimeout(() => {
    backdrop.classList.remove("opacity-0");
  }, 10);
}

function closePanel(panel, backdrop) {
  panel.classList.add("-translate-x-full");
  backdrop.classList.add("opacity-0");
  setTimeout(() => {
    backdrop.classList.add("hidden");
  }, 300);
}

function updateActiveCount(container, countSpan, toggleBtn) {
  const checked = container.querySelectorAll(
    'input[type="checkbox"]:checked'
  ).length;
  countSpan.textContent = checked;

  // Update toggle button text
  if (toggleBtn) {
    if (checked > 0) {
      toggleBtn.innerHTML = `
        <svg class="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
        已选 ${checked} 个 MCP
      `;
      toggleBtn.classList.add("text-indigo-600", "dark:text-indigo-400");
      toggleBtn.classList.remove("text-slate-500", "dark:text-slate-400");
    } else {
      toggleBtn.innerHTML = `
        <svg class="w-4 h-4 text-slate-400 group-hover/mcp:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
        添加 MCP 服务
      `;
      toggleBtn.classList.remove("text-indigo-600", "dark:text-indigo-400");
      toggleBtn.classList.add("text-slate-500", "dark:text-slate-400");
    }
  }
}
