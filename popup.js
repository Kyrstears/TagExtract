const statusEl = document.getElementById("status");
const FORMAT_NAMES = { space: "Format: Spaces", comma: "Format: Commas", sd: "Format: SD prompt", json: "Format: JSON", custom: "Format: Custom" };

chrome.storage.sync.get({ format: "space" }, (s) => {
  document.getElementById("format-label").textContent = FORMAT_NAMES[s.format] || "";
});

document.getElementById("options-link").addEventListener("click", () => chrome.runtime.openOptionsPage());

async function send(type) {
  statusEl.textContent = "Copying\u2026";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) { statusEl.textContent = "No active tab"; return; }
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type });
    if (res && res.ok) {
      statusEl.textContent = res.msg;
      setTimeout(() => window.close(), 900);
    } else {
      statusEl.textContent = (res && res.msg) || "No tags found on this page";
    }
  } catch (_) {
    statusEl.textContent = "Not a supported page (try reloading it)";
  }
  refreshHistory();
}

document.getElementById("copy-tags").addEventListener("click", () => send("copy-tags"));
document.getElementById("copy-all").addEventListener("click", () => send("copy-all"));

/* Probe page type to show status when unsupported */
(async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;
    const res = await chrome.tabs.sendMessage(tab.id, { type: "ping" });
    if (res && !res.post && !res.listing) {
      statusEl.textContent = "Not a supported page (try reloading it)";
    }
  } catch (_) {}
})();

/* History */
const histToggle = document.getElementById("history-toggle");
const histEl = document.getElementById("history");

histToggle.addEventListener("click", () => {
  const willOpen = !histEl.classList.contains("open");
  histEl.classList.toggle("open", willOpen);
  histToggle.setAttribute("aria-expanded", String(willOpen));
  const count = histEl.dataset.count || "0";
  updateToggleLabel(willOpen, count);
  if (willOpen) {
    const first = histEl.querySelector(".h-item");
    if (first) first.focus();
  } else {
    histToggle.focus();
  }
});

function updateToggleLabel(open, count) {
  const glyph = document.createElement("span");
  glyph.setAttribute("aria-hidden", "true");
  glyph.textContent = open ? "\u25BE" : "\u25B8";
  histToggle.textContent = "";
  histToggle.append(glyph, document.createTextNode(` History (${count})`));
}

function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " " + d.toLocaleDateString();
}

function refreshHistory() {
  chrome.storage.local.get({ teHistory: [] }, ({ teHistory }) => {
    if (!Array.isArray(teHistory)) teHistory = [];
    histEl.dataset.count = String(teHistory.length);
    const open = histEl.classList.contains("open");
    updateToggleLabel(open, teHistory.length);
    histToggle.setAttribute("aria-expanded", String(open));
    histEl.textContent = "";
    if (!teHistory.length) {
      const empty = document.createElement("div");
      empty.className = "h-empty";
      empty.textContent = "No copies yet";
      histEl.appendChild(empty);
      return;
    }
    teHistory.forEach((h) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "h-item";
      btn.title = "Click to re-copy";
      const preview = (h.x || "").split("\n")[0].slice(0, 80);
      const host = (() => { try { return new URL(h.u).hostname; } catch (_) { return String(h.u || "").slice(0, 30); } })();
      const meta = document.createElement("div");
      meta.className = "h-meta";
      meta.textContent = `${host} \u00B7 ${h.c} tags \u00B7 ${fmtTime(h.t)}`;
      const prev = document.createElement("div");
      prev.className = "h-preview";
      prev.textContent = preview;
      btn.append(meta, prev);
      btn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(h.x || "");
          statusEl.textContent = `Re-copied ${h.c} tags`;
        } catch (_) {
          // fallback for restricted popup contexts
          try {
            const ta = document.createElement("textarea");
            ta.value = h.x || "";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            ta.remove();
            statusEl.textContent = `Re-copied ${h.c} tags`;
          } catch (_) { statusEl.textContent = "Clipboard blocked"; }
        }
      });
      histEl.appendChild(btn);
    });
    const actions = document.createElement("div");
    actions.className = "h-actions";
    const clear = document.createElement("button");
    clear.type = "button";
    clear.id = "clear-history";
    clear.textContent = "Clear history";
    clear.addEventListener("click", (e) => {
      e.stopPropagation();
      if (clear.dataset.confirming === "1") {
        chrome.storage.local.set({ teHistory: [] }, refreshHistory);
        return;
      }
      clear.dataset.confirming = "1";
      clear.textContent = "Confirm clear?";
      setTimeout(() => {
        clear.dataset.confirming = "";
        clear.textContent = "Clear history";
      }, 2500);
    });
    actions.appendChild(clear);
    histEl.appendChild(actions);
  });
}

refreshHistory();
