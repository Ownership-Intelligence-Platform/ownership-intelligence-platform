function setStatus(msg, timeout = 2000) {
  const el = document.getElementById("status");
  if (el) {
    el.textContent = msg;
    if (timeout) setTimeout(() => (el.textContent = ""), timeout);
  }
}

export async function loadPersonOpening(personId) {
  const box = document.getElementById("personOpeningBox");
  if (!box) return;
  try {
    setStatus("Loading person opening info…", 0);
    box.innerHTML = "Loading…";
    const res = await fetch(
      `/persons/${encodeURIComponent(personId)}/account-opening`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const info = data && data.account_opening ? data.account_opening : null;
    if (!info) {
      box.innerHTML = `<span class="text-gray-500">No account-opening info found.</span>`;
      setStatus("Opening info loaded.");
      return;
    }
    const rows = [
      ["姓名", info.name || ""],
      ["银行", info.bank_name || ""],
      ["账户类型", info.account_type || ""],
      ["币种", info.currencies || ""],
      ["账号", info.account_number_masked || ""],
      ["身份证号", info.id_no_masked || ""],
      ["手机", info.phone || ""],
      ["邮箱", info.email || ""],
      ["地址", info.address || ""],
      ["职业/单位", info.employer || ""],
    ];
    const html = `
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <tbody>
            ${rows
              .map(
                ([k, v]) => `
              <tr class="border-t border-gray-200 dark:border-gray-800">
                <td class="px-2 py-1 text-gray-500">${k}</td>
                <td class="px-2 py-1">${v || "-"}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <div class="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
        提示：敏感字段已掩码处理，仅展示尾号。
      </div>`;
    box.innerHTML = html;
    setStatus("Opening info loaded.");
  } catch (e) {
    box.innerHTML = `<span class="text-rose-600">Failed: ${e}</span>`;
    setStatus(`Failed: ${e}`);
  }
}
