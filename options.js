/* Shared constants — single source of truth in shared.js (loaded first).
   Note: isValidTagOrder reads `this.TAG_CATEGORIES`, so it must be called
   as TAGEXT.isValidTagOrder(...) — destructuring would break its context. */
const { DEFAULTS, ALLOWED_HOSTS, LIMITS, clampWeight, TAG_CATEGORIES, VALID_RATING_MODES } = TAGEXT;

const RATINGS = ["safe", "sensitive", "questionable", "explicit"];

const $ = (id) => document.getElementById(id);

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
    renderTagOrder(s.tagOrder);
    renderRules(Array.isArray(s.replacements) ? s.replacements : []);
    if (!s.ratingFilter || typeof s.ratingFilter !== "object") s.ratingFilter = { ...DEFAULTS.ratingFilter };
    $("rf-enabled").checked = !!s.ratingFilter.enabled;
    $("rf-mode").value = VALID_RATING_MODES.has(s.ratingFilter.mode) ? s.ratingFilter.mode : DEFAULTS.ratingFilter.mode;
    const allowed = new Set(Array.isArray(s.ratingFilter.allowed) && s.ratingFilter.allowed.length ? s.ratingFilter.allowed : DEFAULTS.ratingFilter.allowed);
    for (const r of RATINGS) $("rf-" + r).checked = allowed.has(r);
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
  $("rf-options").classList.toggle("hidden", !$("rf-enabled").checked);
}

function updateWarnings() {
  const v = parseFloat($("w-character").value);
  $("warn-character").style.display = v > 1.5 ? "block" : "none";
}

/* ============================== Tag order ============================== */

const orderSelects = TAG_CATEGORIES.map((_, i) => "order-" + (i + 1)).map($);

function renderTagOrder(order) {
  const ord = TAGEXT.isValidTagOrder(order) ? order : [...DEFAULTS.tagOrder];
  orderSelects.forEach((sel, i) => {
    sel.value = ord[i];
    sel.dataset.prev = ord[i];
  });
}

function readTagOrder() {
  const ord = orderSelects.map((sel) => sel.value);
  return TAGEXT.isValidTagOrder(ord) ? ord : [...DEFAULTS.tagOrder];
}

/* Keep the five selects a valid permutation: changing a select to a category
   already chosen elsewhere swaps it back into this select's old position. */
orderSelects.forEach((sel, i) => {
  sel.addEventListener("focus", () => { sel.dataset.prev = sel.value; });
  sel.addEventListener("change", () => {
    const prev = sel.dataset.prev || sel.value;
    if (prev !== sel.value) {
      const dup = orderSelects.find((o, j) => j !== i && o.value === sel.value);
      if (dup) {
        dup.value = prev;
        dup.dataset.prev = prev;
      }
      sel.dataset.prev = sel.value;
    }
  });
});

/* ============================== Replacement rules ============================== */

let pendingRules = [];

function rulesBytes(rules) {
  return rules.reduce((n, r) => n + r.find.length + r.replace.length, 0);
}

function renderRules(rules) {
  pendingRules = rules
    .filter((r) => r && typeof r === "object" && typeof r.find === "string" && typeof r.replace === "string")
    .map((r) => ({ find: r.find.slice(0, LIMITS.rule), replace: r.replace.slice(0, LIMITS.rule) }))
    .filter((r) => r.find)
    .slice(0, LIMITS.rules);
  drawRules();
}

function drawRules() {
  const el = $("rule-rows");
  el.textContent = "";
  pendingRules.forEach((r, i) => {
    const row = document.createElement("div");
    row.className = "override-item";
    const find = document.createElement("code");
    find.textContent = r.find;
    row.appendChild(find);
    row.appendChild(document.createTextNode(" \u2192 "));
    const repl = document.createElement("code");
    repl.textContent = r.replace || "(delete tag)";
    row.appendChild(repl);
    const spacer = document.createElement("span");
    spacer.style.flex = "1";
    row.appendChild(spacer);
    const del = document.createElement("button");
    del.className = "btn-danger";
    del.textContent = "Remove";
    del.addEventListener("click", () => { pendingRules.splice(i, 1); drawRules(); });
    row.appendChild(del);
    el.appendChild(row);
  });
  $("rule-count").textContent = pendingRules.length
    ? `${pendingRules.length}/${LIMITS.rules} rules \u00B7 ${rulesBytes(pendingRules)}/${LIMITS.rulesBytes} chars`
    : "";
}

$("rule-add").addEventListener("click", () => {
  const find = $("rule-find").value.trim().slice(0, LIMITS.rule);
  if (!find) { flash("Enter text to find first"); return; }
  if (pendingRules.length >= LIMITS.rules) { flash(`Limit is ${LIMITS.rules} rules`); return; }
  if (rulesBytes(pendingRules) + find.length + $("rule-replace").value.length > LIMITS.rulesBytes) { flash("Rules exceed the size limit"); return; }
  pendingRules.push({ find, replace: $("rule-replace").value.slice(0, LIMITS.rule) });
  $("rule-find").value = "";
  $("rule-replace").value = "";
  drawRules();
});

/* ============================== Rating filter ============================== */

/* Keep at least one rating checked so exclude mode never blocks everything. */
for (const r of RATINGS) {
  $("rf-" + r).addEventListener("click", () => {
    const boxes = RATINGS.map((x) => $("rf-" + x));
    if (!boxes.some((b) => b.checked)) {
      $("rf-" + r).checked = true;
      flash("At least one rating must stay allowed");
    }
  });
}

function gather() {
  const bl = $("blacklist").value.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, LIMITS.blacklist);
  const allowed = RATINGS.filter((r) => $("rf-" + r).checked);
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
    tagOrder: readTagOrder(),
    replacements: pendingRules,
    ratingFilter: {
      enabled: $("rf-enabled").checked,
      mode: VALID_RATING_MODES.has($("rf-mode").value) ? $("rf-mode").value : DEFAULTS.ratingFilter.mode,
      allowed: allowed.length ? allowed : [...DEFAULTS.ratingFilter.allowed],
    },
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
$("rf-enabled").addEventListener("change", updateVisibility);

/* Populate the tag-order selects (kept in HTML as empty shells for brevity) */
orderSelects.forEach((sel) => {
  for (const cat of TAG_CATEGORIES) {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
    sel.appendChild(opt);
  }
});

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
  chrome.storage.sync.set(
    {
      ...DEFAULTS,
      sdWeights: { ...DEFAULTS.sdWeights },
      blacklist: [...DEFAULTS.blacklist],
      tagOrder: [...DEFAULTS.tagOrder],
      replacements: [],
      ratingFilter: { ...DEFAULTS.ratingFilter, allowed: [...DEFAULTS.ratingFilter.allowed] },
      siteOverrides: {},
    },
    () => {
      load();
      flash("Reset to defaults");
    }
  );
});

load();
