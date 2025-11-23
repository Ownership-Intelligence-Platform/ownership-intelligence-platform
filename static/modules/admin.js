// Admin/Data Console: bind form buttons to backend endpoints.
// All comments are in English to keep consistency with backend code.

import { loadLayers } from "./layers.js";
import { showLoading, hideLoading } from "./utils.js";

function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}
function num(id) {
  const v = val(id);
  if (v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}
async function postJson(url, body) {
  showLoading("正在提交数据...");
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    if (!res.ok)
      throw new Error(typeof data === "string" ? data : JSON.stringify(data));
    return data;
  } finally {
    hideLoading();
  }
}
function setStatus(msg, timeout = 2000) {
  const el = document.getElementById("status");
  el.textContent = msg;
  if (timeout) setTimeout(() => (el.textContent = ""), timeout);
}

export function initAdmin() {
  // Person
  document
    .getElementById("btnCreatePerson")
    ?.addEventListener("click", async () => {
      const id = val("personId");
      if (!id) return alert("person id is required");
      const payload = {
        id,
        name: val("personName") || null,
        type: "Person",
        job_info: val("personJobTitle")
          ? { title: val("personJobTitle") }
          : null,
      };
      try {
        setStatus("Creating person…", 0);
        await postJson("/persons", payload);
        setStatus("Person created.");
      } catch (e) {
        setStatus(`Failed: ${e}`);
      }
    });

  // Company
  document
    .getElementById("btnCreateCompany")
    ?.addEventListener("click", async () => {
      const id = val("companyId");
      if (!id) return alert("company id is required");
      const payload = {
        id,
        name: val("companyName") || null,
        type: "Company",
        status: val("companyStatus") || null,
        industry: val("companyIndustry") || null,
      };
      try {
        setStatus("Creating company…", 0);
        await postJson("/companies", payload);
        setStatus("Company created.");
      } catch (e) {
        setStatus(`Failed: ${e}`);
      }
    });

  // Account
  document
    .getElementById("btnCreateAccount")
    ?.addEventListener("click", async () => {
      const owner_id = val("accOwnerId");
      const account_number = val("accNumber");
      if (!owner_id || !account_number)
        return alert("owner_id and account_number are required");
      const payload = {
        owner_id,
        account_number,
        bank_name: val("accBank") || null,
        balance: num("accBalance"),
      };
      try {
        setStatus("Creating account…", 0);
        await postJson("/accounts", payload);
        setStatus("Account created.");
      } catch (e) {
        setStatus(`Failed: ${e}`);
      }
    });

  // Locations
  document
    .getElementById("btnCreateLocations")
    ?.addEventListener("click", async () => {
      const entity_id = val("locEntityId");
      if (!entity_id) return alert("entity_id is required");
      const payload = {
        entity_id,
        registered: val("locRegistered") || null,
        operating: val("locOperating") || null,
        offshore: val("locOffshore") || null,
      };
      try {
        setStatus("Linking locations…", 0);
        await postJson("/locations", payload);
        setStatus("Locations linked.");
      } catch (e) {
        setStatus(`Failed: ${e}`);
      }
    });

  // Transaction
  document
    .getElementById("btnCreateTransaction")
    ?.addEventListener("click", async () => {
      const from_id = val("txFrom");
      const to_id = val("txTo");
      const amount = num("txAmount");
      if (!from_id || !to_id || amount == null)
        return alert("from_id, to_id, amount are required");
      const payload = {
        from_id,
        to_id,
        amount,
        time: val("txTime") || null,
        tx_type: val("txType") || null,
        channel: val("txChannel") || null,
      };
      try {
        setStatus("Creating transaction…", 0);
        await postJson("/transactions", payload);
        setStatus("Transaction created.");
      } catch (e) {
        setStatus(`Failed: ${e}`);
      }
    });

  // Guarantee
  document
    .getElementById("btnCreateGuarantee")
    ?.addEventListener("click", async () => {
      const guarantor_id = val("guaGuarantor");
      const guaranteed_id = val("guaGuaranteed");
      const amount = num("guaAmount");
      if (!guarantor_id || !guaranteed_id || amount == null)
        return alert("guarantor_id, guaranteed_id, amount are required");
      const payload = { guarantor_id, guaranteed_id, amount };
      try {
        setStatus("Creating guarantee…", 0);
        await postJson("/guarantees", payload);
        setStatus("Guarantee created.");
      } catch (e) {
        setStatus(`Failed: ${e}`);
      }
    });

  // Supply link
  document
    .getElementById("btnCreateSupply")
    ?.addEventListener("click", async () => {
      const supplier_id = val("supSupplier");
      const customer_id = val("supCustomer");
      const frequency = num("supFrequency");
      if (!supplier_id || !customer_id)
        return alert("supplier_id and customer_id are required");
      const payload = { supplier_id, customer_id, frequency };
      try {
        setStatus("Creating supply link…", 0);
        await postJson("/supply-links", payload);
        setStatus("Supply link created.");
      } catch (e) {
        setStatus(`Failed: ${e}`);
      }
    });

  // Employment
  document
    .getElementById("btnCreateEmployment")
    ?.addEventListener("click", async () => {
      const company_id = val("empCompany");
      const person_id = val("empPerson");
      const role = val("empRole") || null;
      if (!company_id || !person_id)
        return alert("company_id and person_id are required");
      const payload = { company_id, person_id, role };
      try {
        setStatus("Creating employment…", 0);
        await postJson("/employment", payload);
        setStatus("Employment created.");
      } catch (e) {
        setStatus(`Failed: ${e}`);
      }
    });

  // Auto-refresh layers if rootId matches involved entity to help user feedback
  const refreshIfRoot = async () => {
    const currentRoot = document.getElementById("rootId")?.value?.trim();
    if (currentRoot) {
      try {
        await loadLayers();
      } catch {}
    }
  };

  // After any creation, try to refresh layers silently
  [
    "btnCreatePerson",
    "btnCreateCompany",
    "btnCreateAccount",
    "btnCreateLocations",
    "btnCreateTransaction",
    "btnCreateGuarantee",
    "btnCreateSupply",
    "btnCreateEmployment",
  ].forEach((id) => {
    document.getElementById(id)?.addEventListener("click", () => {
      setTimeout(refreshIfRoot, 500);
    });
  });
}
