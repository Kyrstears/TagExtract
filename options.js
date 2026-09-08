const DEFAULTS = {
  format: "space",
  prefixPreset: "sd15",
  sdPrefix: "masterpiece, best quality",
  template: "Tags: {tags}\nCopyrights: {copyright}\nArtists: {artist}\nCharacters: {character}\nMetadata:\n{meta}",
  blacklist: ["commentary", "translated", "request", "commentary request", "visible watermark", "hidden watermark", "md5 mismatch", "bad id"],
  sdWeights: { character: 1.1, artist: 1.0, copyright: 1.0, general: 1.0 },
  autoCopy: false,
  tagStyle: "spaces",
  stripQualifiers: false,
  appendSource: false,
  prefixArtistsWithAt: false,
  siteOverrides: {},
};

const $ = (id) => document.getElementById(id);

// Supported hosts only — prevents prototype pollution and spurious overrides
const ALLOWED_HOSTS = new Set([
  "danbooru.donmai.us", "rule34.xxx", "rule34.us", "rule34hentai.net",
  "gelbooru.com", "safebooru.org", "aibooru.online", "xbooru.com",
  "hypnohub.net", "tbib.org", "e621.net", "e926.org",
  "yande.re", "konachan.com", "konachan.net", "lolibooru.moe",
]);
const LIMITS = { sdPrefix: 500, template: 2000, blacklist: 200 };

function clampWeight(v) {
  const n = parseFloat(v);
  if (!isFinite(n)) return 1.0;
  return Math.min(2.0, Math.max(0.1, Math.round(n * 100) / 100));
}

function load() {
  chrome.storage.sync.get(DEFAULTS, (s) => {
    for (const k of Object.keys(DEFAULTS)) if (s[k] === undefined) s[k] = DEFAULTS[k];
    if (!s.sdWeights) s.sdWeights = { ...DEFAULTS.sdWeights };
    else for (const k of Object.keys(DEFAULTS.sdWeights)) if (s.sdWeights[k] === undefined) s.sdWeights[k] = DEFAULTS.sdWeights[k];
    $("format").value = s.format;
    $("prefix-preset").value = s.prefixPreset || "sd15";
    $("sd-prefix").value = s.sdPrefix || "";
    $("template").value = s.template || DEFAULTS.template;
    $("w-character").value = s.sdWeights.character;
    $("w-copyright").value = s.sdWeights.copyright;
    $("w-artist").value = s.sdWeights.artist;
    $("w-general").value = s.sdWeights.general;
    $("tag-style").value = s.tagStyle || "spaces";
    $("strip-qualifiers").checked = !!s.stripQualifiers;
    $("blacklist").value = (s.blacklist || []).join("\n");
    $("auto-copy").checked = !!s.autoCopy;
    $("append-source").checked = !!s.appendSource;
    $("anima-artist").checked = !!s.prefixArtistsWithAt;
    renderOverrides(s.siteOverrides || {});
    updateVisibility();
    updateWarnings();
  });
}

function updateVisibility() {
  const f = $("format").value;
  const isSD = f === "sd";
  $("sd-section").classList.toggle("hidden", !isSD);
  $("custom-row").classList.toggle("hidden", f !== "custom");
  const preset = $("prefix-preset").value;
  $("sd-custom-wrap").classList.toggle("hidden", preset !== "custom");
  const isAnima = isSD && preset === "anima";
  $("anima-artist-wrap").classList.toggle("hidden", !isAnima);
  $("anima-hint").classList.toggle("hidden", !isAnima);
  // Anima forces spaces+lowercase — disable tag-style control when active
  $("tag-style").disabled = isAnima;
  if (isAnima) $("tag-style").value = "spaces";
}

function updateWarnings() {
  const v = parseFloat($("w-character").value);
  $("warn-character").style.display = v > 1.5 ? "block" : "none";
}

function gather() {
  const bl = $("blacklist").value.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, LIMITS.blacklist);
  return {
    format: $("format").value,
    prefixPreset: $("prefix-preset").value,
    sdPrefix: $("sd-prefix").value.trim().slice(0, LIMITS.sdPrefix),
    template: $("template").value.slice(0, LIMITS.template),
    sdWeights: {
      character: clampWeight($("w-character").value),
      copyright: clampWeight($("w-copyright").value),
      artist: clampWeight($("w-artist").value),
      general: clampWeight($("w-general").value),
    },
    tagStyle: $("tag-style").value,
    stripQualifiers: $("strip-qualifiers").checked,
    blacklist: bl,
    autoCopy: $("auto-copy").checked,
    appendSource: $("append-source").checked,
    prefixArtistsWithAt: $("anima-artist").checked,
  };
}

function flash(msg) {
  $("status").textContent = msg;
  setTimeout(() => ($("status").textContent = ""), 1800);
}

/* Overrides */
let pendingOverrides = {};

function renderOverrides(map) {
  pendingOverrides = { ...map };
  const el = $("ov-list");
  el.textContent = "";
  for (const [host, o] of Object.entries(pendingOverrides)) {
    if (!ALLOWED_HOSTS.has(host)) continue;
    const row = document.createElement("div");
    row.className = "override-item";
    const summary = document.createElement("span");
    summary.style.flex = "1";
    const hostCode = document.createElement("code");
    hostCode.textContent = host;
    summary.appendChild(hostCode);
    const parts = [`format: ${o.format || "(global)"}`];
    if (o.prefixPreset) parts.push(`prefix: ${o.prefixPreset}`);
    if (o.tagStyle) parts.push(`style: ${o.tagStyle}`);
    summary.appendChild(document.createTextNode(" " + parts.join(" · ")));
    row.appendChild(summary);
    const del = document.createElement("button");
    del.className = "btn-danger";
    del.textContent = "Remove";
    del.addEventListener("click", () => { delete pendingOverrides[host]; renderOverrides(pendingOverrides); });
    row.appendChild(del);
    el.appendChild(row);
  }
}

$("ov-add").addEventListener("click", () => {
  const host = $("ov-host").value.trim();
  if (!host) { flash("Choose a site first"); return; }
  if (!ALLOWED_HOSTS.has(host)) { flash("Unsupported site"); return; }
  const entry = {};
  const fmt = $("ov-format").value;
  if (fmt) entry.format = fmt;
  const preset = $("ov-preset").value;
  if (preset) entry.prefixPreset = preset;
  const ts = $("ov-tagstyle").value;
  if (ts) entry.tagStyle = ts;
  pendingOverrides[host] = entry;
  renderOverrides(pendingOverrides);
});

$("format").addEventListener("change", updateVisibility);
$("prefix-preset").addEventListener("change", updateVisibility);
$("w-character").addEventListener("input", updateWarnings);

$("save").addEventListener("click", () => {
  const data = gather();
  data.siteOverrides = pendingOverrides;
  // Reflect weight clamping in UI
  $("w-character").value = data.sdWeights.character;
  $("w-copyright").value = data.sdWeights.copyright;
  $("w-artist").value = data.sdWeights.artist;
  $("w-general").value = data.sdWeights.general;
  chrome.storage.sync.set(data, () => {
    if (chrome.runtime.lastError) flash("Save failed: " + chrome.runtime.lastError.message);
    else flash("Saved");
  });
});

$("reset").addEventListener("click", () => {
  if (!confirm("Reset all settings to defaults?")) return;
  pendingOverrides = {};
  chrome.storage.sync.set({ ...DEFAULTS, sdWeights: { ...DEFAULTS.sdWeights }, blacklist: [...DEFAULTS.blacklist], siteOverrides: {} }, () => {
    load();
    flash("Reset to defaults");
  });
});

load();
