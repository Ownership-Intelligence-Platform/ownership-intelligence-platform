// Report generation UI handlers (HTML output).
// Keeps report-specific logic separated from the main entry point.

import { resolveEntityInput } from "./utils.js";
import { loadEntityInfo } from "./entities.js";

export function wireReportHandlers() {
  document
    .getElementById("generateReportHtml")
    ?.addEventListener("click", async () => {
      const raw = document.getElementById("rootId").value.trim();
      const id = await resolveEntityInput(raw);
      if (!id) return;
      document.getElementById("rootId").value = id;
      loadEntityInfo(id);

      const depth = parseInt(document.getElementById("depth").value || "2", 10);
      const newsLimit = parseInt(
        document.getElementById("reportNewsLimit").value || "5",
        10
      );
      const bilingual = document.getElementById("reportBilingual").checked;

      const statusEl = document.getElementById("status");
      if (statusEl) statusEl.textContent = "正在生成报告…";
      try {
        const url = `/reports/cdd/${encodeURIComponent(
          id
        )}?format=html&depth=${depth}&news_limit=${newsLimit}&bilingual=${bilingual}`;
        const resp = await fetch(url);
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        const data = await resp.json();
        // Open HTML report in a new tab (served from disk path may not be accessible via /static so inline preview)
        if (data.content_html) {
          const w = window.open("about:blank", "_blank");
          if (w) {
            w.document.write(data.content_html);
            w.document.close();
          }

          // Also trigger a client-side download of the HTML using a Blob
          try {
            const blob = new Blob([data.content_html], {
              type: "text/html;charset=utf-8",
            });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `CDD_${id}.html`;
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
              URL.revokeObjectURL(link.href);
              link.remove();
            }, 500);
          } catch (_) {
            // noop if download fails; the new tab still shows the content
          }
        }
        if (statusEl) statusEl.textContent = "报告已生成。";
      } catch (e) {
        if (statusEl) statusEl.textContent = `生成报告失败：${e}`;
      }
    });
}
