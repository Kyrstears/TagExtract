(() => {
  "use strict";

  /* ============================== Site detection ============================== */

  const host = location.hostname;
  const SITES = {
    DANBOORU: /(^|\.)(danbooru\.donmai\.us|aibooru\.online)$/.test(host),
    GELBOORU: /(^|\.)(rule34\.(xxx|us)|rule34hentai\.net|gelbooru\.com|safebooru\.org|xbooru\.com|hypnohub\.net|tbib\.org)$/.test(host),
    E621: /(^|\.)(e621\.net|e926\.org)$/.test(host),
    MOEBOORU: /(^|\.)(yande\.re|konachan\.(com|net)|lolibooru\.moe)$/.test(host),
  };
  const SUPPORTED = Object.values(SITES).some(Boolean);
  if (!SUPPORTED) return;

  /* Shared constants — single source of truth in shared.js (loaded first) */
  const { DEFAULTS, ALLOWED_HOSTS, LIMITS, PREFIX_PRESETS, VALID_FORMATS, VALID_PRESETS, VALID_TAGSTYLES, FORBIDDEN_KEYS, clampWeight } = TAGEXT;

  const TAG_TYPES = ["character", "copyright", "artist", "meta", "general"];
  const DANBOORU_TYPES = { 0: "general", 1: "artist", 3: "copyright", 4: "character", 5: "meta" };

  let settings = { ...DEFAULTS, sdWeights: { ...DEFAULTS.sdWeights } };

  function sanitizeSettings(raw) {
    const out = {};
    for (const k of Object.keys(DEFAULTS)) {
      if (FORBIDDEN_KEYS.has(k)) continue;
      if (raw[k] !== undefined) out[k] = raw[k];
    }
    // type guards for critical keys
    if (out.sdWeights !== undefined && (typeof out.sdWeights !== "object" || out.sdWeights === null || Array.isArray(out.sdWeights))) {
      out.sdWeights = { ...DEFAULTS.sdWeights };
    } else if (out.sdWeights) {
      const w = {};
      for (const k of Object.keys(DEFAULTS.sdWeights)) {
        if (FORBIDDEN_KEYS.has(k)) continue;
        const v = parseFloat(out.sdWeights[k]);
        w[k] = isFinite(v) ? Math.min(2.0, Math.max(0.1, Math.round(v * 100) / 100)) : DEFAULTS.sdWeights[k];
      }
      out.sdWeights = w;
    }
    if (out.blacklist !== undefined && !Array.isArray(out.blacklist)) out.blacklist = [...DEFAULTS.blacklist];
    if (out.blacklist && Array.isArray(out.blacklist)) out.blacklist = out.blacklist.filter((p) => typeof p === "string").slice(0, LIMITS.blacklist);
    if (out.template !== undefined && typeof out.template !== "string") out.template = DEFAULTS.template;
    if (typeof out.template === "string") out.template = out.template.slice(0, LIMITS.template);
    if (typeof out.sdPrefix === "string") out.sdPrefix = out.sdPrefix.slice(0, LIMITS.sdPrefix);
    if (out.format !== undefined && !VALID_FORMATS.has(out.format)) out.format = DEFAULTS.format;
    if (out.prefixPreset !== undefined && !VALID_PRESETS.has(out.prefixPreset)) out.prefixPreset = DEFAULTS.prefixPreset;
    if (out.tagStyle !== undefined && !VALID_TAGSTYLES.has(out.tagStyle)) out.tagStyle = DEFAULTS.tagStyle;
    // siteOverrides: host allowlist + per-host key validation
    if (out.siteOverrides !== undefined && (typeof out.siteOverrides !== "object" || out.siteOverrides === null || Array.isArray(out.siteOverrides))) {
      out.siteOverrides = {};
    } else if (out.siteOverrides) {
      const clean = {};
      for (const [h, o] of Object.entries(out.siteOverrides)) {
        if (!ALLOWED_HOSTS.has(h)) continue;
        if (typeof o !== "object" || o === null || Array.isArray(o)) continue;
        const entry = {};
        for (const [k, v] of Object.entries(o)) {
          if (FORBIDDEN_KEYS.has(k)) continue;
          if (k === "format" && !VALID_FORMATS.has(v)) continue;
          if (k === "prefixPreset" && !VALID_PRESETS.has(v)) continue;
          if (k === "tagStyle" && !VALID_TAGSTYLES.has(v)) continue;
          entry[k] = v;
        }
        if (Object.keys(entry).length) clean[h] = entry;
      }
      out.siteOverrides = clean;
    }
    return out;
  }

  function effectiveSettings() {
    const eff = { ...settings, sdWeights: { ...settings.sdWeights } };
    const over = settings.siteOverrides && settings.siteOverrides[host];
    if (over && typeof over === "object") {
      for (const k of Object.keys(over)) {
        if (FORBIDDEN_KEYS.has(k)) continue;
        if (k === "sdWeights" && over.sdWeights && typeof over.sdWeights === "object") eff.sdWeights = { ...eff.sdWeights, ...over.sdWeights };
        else eff[k] = over[k];
      }
      if (eff.format && !VALID_FORMATS.has(eff.format)) eff.format = settings.format;
      if (eff.prefixPreset && !VALID_PRESETS.has(eff.prefixPreset)) eff.prefixPreset = settings.prefixPreset;
      if (eff.tagStyle && !VALID_TAGSTYLES.has(eff.tagStyle)) eff.tagStyle = settings.tagStyle;
    }
    return eff;
  }

  function resolvePrefix(eff) {
    if (eff.prefixPreset === "custom") return (eff.sdPrefix || "").trim();
    if (eff.prefixPreset in PREFIX_PRESETS) return PREFIX_PRESETS[eff.prefixPreset];
    return PREFIX_PRESETS.sd15;
  }

  /* ============================== Page type ============================== */

  function isPostPage() {
    if (SITES.DANBOORU) return /^\/posts\/\d+/.test(location.pathname);
    if (SITES.E621) return /^\/posts\/\d+/.test(location.pathname);
    if (SITES.MOEBOORU) return /^\/post\/(show|view)\/\d+/.test(location.pathname) || (/page=post/.test(location.search) && /s=view|s=show/.test(location.search));
    if (SITES.GELBOORU) return /page=post/.test(location.search) && /s=view/.test(location.search);
    return false;
  }

  function isListingPage() {
    if (SITES.DANBOORU) return location.pathname === "/posts" || location.pathname.startsWith("/posts?");
    if (SITES.E621) return location.pathname === "/posts";
    return false;
  }

  function clean(s) { return (s || "").replace(/\s+/g, " ").trim(); }

  /* ============================== Extractors ============================== */

  function extractDanbooru() {
    const tags = emptyTags();
    document.querySelectorAll("#tag-list li").forEach((li) => {
      const cls = [...li.classList].find((c) => c.startsWith("tag-type-"));
      const num = cls ? cls.replace("tag-type-", "") : "0";
      const type = DANBOORU_TYPES[num] || "general";
      const name = li.dataset.tagName ? li.dataset.tagName.replace(/_/g, " ") : clean((li.querySelector("a.search-tag") || {}).textContent);
      if (name) (tags[type] || tags.general).push(name);
    });
    const meta = {};
    document.querySelectorAll("#post-information li").forEach((li) => {
      const m = clean(li.textContent).match(/^([\w\s]+?)\s*:\s*(.+)$/);
      if (m) meta[m[1].trim()] = m[2].replace(/\s*»\s*$/, "").trim();
    });
    return { tags, meta };
  }

  function extractGelbooru() {
    const tags = emptyTags();
    // rule34.xxx uses #tag-sidebar; gelbooru uses #tag-list — try both
    const tagLis = document.querySelectorAll("#tag-sidebar li, #tag-list li, .tag-list li");
    const lis = tagLis.length ? tagLis : document.querySelectorAll("li.tag-type-general, li.tag-type-artist, li.tag-type-copyright, li.tag-type-character, li.tag-type-metadata, li[class*='tag-type-']");
    lis.forEach((li) => {
      const cls = [...li.classList].find((c) => c.startsWith("tag-type-"));
      if (!cls) return;
      const raw = cls.replace("tag-type-", "");
      const type = raw === "tag" || raw === "general" ? "general" : raw === "metadata" ? "meta" : raw;
      const a = li.querySelector('a[href*="tags="]') || li.querySelector("a.search-tag, a.tag");
      if (!a) return;
      const name = clean(a.textContent);
      if (name && name !== "?") (tags[type] || tags.general).push(name);
    });
    // fallback: rule34.xxx also renders tags without tag-type class — use any link with index.php?page=post&s=list&tags=
    if (!tags.general.length && !tags.artist.length && !tags.character.length && !tags.copyright.length) {
      document.querySelectorAll('a[href*="tags="]').forEach((a) => {
        const li = a.closest("li");
        // only sidebar tags, not nav links
        if (!li || !li.closest("#tag-sidebar, #tag-list, .tag-sidebar")) return;
        const name = clean(a.textContent);
        if (name && name !== "?" && !Object.values(tags).flat().includes(name)) tags.general.push(name);
      });
    }
    const meta = {};
    const metaLis = document.querySelectorAll("#tag-sidebar li, #tag-list li");
    (metaLis.length ? metaLis : document.querySelectorAll("#stats li")).forEach((li) => {
      if (li.className.includes("tag-type-")) return;
      const m = clean(li.textContent).match(/^(Id|Posted|By|Size|Source|Rating|Score|Status)\s*:\s*(.+)$/i);
      if (m) { const key = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase(); meta[key] = m[2].trim(); }
    });
    return { tags, meta };
  }

  function extractE621() {
    const tags = emptyTags();
    document.querySelectorAll("#tag-list li[data-category]").forEach((li) => {
      const raw = li.dataset.category;
      const type = raw === "species" ? "general" : raw;
      const name = decodeURIComponent(li.dataset.name || "").replace(/_/g, " ");
      if (name) (tags[type] || tags.general).push(name);
    });
    const meta = {};
    document.querySelectorAll(".post-sidebar-info").forEach((info) => {
      const labels = info.querySelectorAll(":scope > .post-sidebar-label");
      const values = info.querySelectorAll(":scope > .post-sidebar-value");
      labels.forEach((lbl, i) => {
        const key = clean(lbl.textContent);
        const val = values[i] ? clean(values[i].textContent) : "";
        if (key && val) meta[key] = val;
      });
    });
    return { tags, meta };
  }

  function extractMoebooru() {
    const tags = emptyTags();
    document.querySelectorAll("#tag-sidebar li, ul.tag-list li").forEach((li) => {
      const cls = [...li.classList].find((c) => c.startsWith("tag-type-"));
      if (!cls) return;
      const raw = cls.replace("tag-type-", "");
      const type = raw === "circle" ? "copyright" : raw === "faults" ? "meta" : raw;
      const a = li.querySelector('a[href*="/post?tags="], a[href*="tags="]');
      if (!a) return;
      const name = clean(a.textContent);
      if (name && name !== "?") (tags[type] || tags.general).push(name);
    });
    const meta = {};
    const stats = document.querySelector("#stats ul");
    if (stats) {
      for (const li of stats.querySelectorAll("li")) {
        const m = clean(li.textContent).match(/^(Id|Posted|By|Size|Source|Rating|Score|Status)\s*:\s*(.+)$/i);
        if (m) { const key = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase(); meta[key] = m[2].trim(); }
      }
    }
    return { tags, meta };
  }

  function emptyTags() { return { artist: [], copyright: [], character: [], meta: [], general: [] }; }

  /* ============================== Blacklist (glob) — cached + bounded ============================== */

  const reCache = new Map();
  const RE_CACHE_MAX = 256;
  function globToRe(pattern) {
    if (pattern.length > LIMITS.pattern) throw new Error("blacklist pattern too long");
    // [^ ]* instead of .* — avoids backtracking blowup on space-separated tags
    const esc = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^ ]*");
    const wildcards = (esc.match(/\[\^ \]\*/g) || []).length;
    if (wildcards > 10) throw new Error("too many wildcards");
    return new RegExp("^" + esc + "$", "i");
  }
  function getRe(pattern) {
    let r = reCache.get(pattern);
    if (r !== undefined) {
      // LRU refresh
      reCache.delete(pattern);
      reCache.set(pattern, r);
      return r;
    }
    try { r = globToRe(pattern); } catch (_) { r = null; }
    // cache even failures as null to avoid retry
    if (reCache.size >= RE_CACHE_MAX) reCache.delete(reCache.keys().next().value);
    reCache.set(pattern, r);
    return r;
  }
  function isBlacklisted(tag, blacklist) {
    if (!blacklist || !blacklist.length) return false;
    if (blacklist.length > 200) blacklist = blacklist.slice(0, 200);
    const t = tag.toLowerCase();
    for (const pat of blacklist) {
      const p = (pat || "").trim();
      if (!p) continue;
      if (p.length > 100) continue;
      try {
        const re = getRe(p);
        if (re) { if (re.test(t)) return true; }
        else if (t === p.toLowerCase()) return true;
      } catch (_) { if (t === p.toLowerCase()) return true; }
    }
    return false;
  }

  /* ============================== Collect ============================== */

  function collect() {
    let result = null;
    if (SITES.DANBOORU) result = extractDanbooru();
    else if (SITES.E621) result = extractE621();
    else if (SITES.MOEBOORU) result = extractMoebooru();
    else if (SITES.GELBOORU) result = extractGelbooru();
    if (!result) return null;

    const eff = effectiveSettings();
    const blacklist = eff.blacklist || [];
    // Warm cache once per collect
    for (const p of blacklist) { const trimmed = (p || "").trim(); if (trimmed) getRe(trimmed); }
    let excluded = 0;
    const filtered = {};
    for (const t of TAG_TYPES) {
      const src = result.tags[t] || [];
      filtered[t] = [];
      for (const tag of src) {
        if (isBlacklisted(tag, blacklist)) excluded++;
        else filtered[t].push(tag);
      }
    }
    const all = TAG_TYPES.flatMap((t) => filtered[t] || []);
    if (!all.length) return { tags: filtered, meta: result.meta, all: [], counts: { total: 0, excluded }, empty: true };
    return { tags: filtered, meta: result.meta, all, counts: { total: all.length, excluded, copyright: (filtered.copyright || []).length, artist: (filtered.artist || []).length } };
  }

  /* ============================== Tag normalization + SD helpers ============================== */

  function escapeParens(tag) {
    return tag.replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  }
  function normalizeTag(tag, eff, category) {
    let t = tag;
    if (eff.stripQualifiers && category === "character") {
      t = t.replace(/\s*\(.*?\)\s*$/, "").trim() || t;
    }
    const isAnima = eff.format === "sd" && eff.prefixPreset === "anima";
    if (isAnima) {
      t = t.replace(/_/g, " ").toLowerCase();
    } else if (eff.tagStyle === "underscores") t = t.replace(/ /g, "_");
    else t = t.replace(/_/g, " ");
    if (isAnima && eff.prefixArtistsWithAt && category === "artist") {
      if (!t.startsWith("@")) t = "@" + t;
    }
    return t;
  }
  function sdWrap(tag, weight) {
    const w = clampWeight(weight);
    if (Math.abs(w - 1.0) < 0.001) return tag;
    return `(${tag}:${w.toFixed(2)})`;
  }
  function weightForCategory(cat, eff) {
    if (cat === "meta") cat = "general";
    const w = eff.sdWeights && eff.sdWeights[cat];
    return clampWeight(w != null ? w : 1.0);
  }
  function buildSdParts(data, eff) {
    const parts = [];
    const prefix = resolvePrefix(eff);
    if (prefix) parts.push(prefix);
    for (const cat of TAG_TYPES) {
      const w = weightForCategory(cat, eff);
      for (const raw of (data.tags[cat] || [])) {
        const norm = normalizeTag(raw, eff, cat);
        parts.push(sdWrap(escapeParens(norm), w));
      }
    }
    return parts;
  }

  /* ============================== Formatting ============================== */

  function formatOutput(data, kind) {
    const eff = effectiveSettings();

    if (eff.format === "json" && kind === "all") {
      const normTags = {};
      for (const t of TAG_TYPES) normTags[t] = (data.tags[t] || []).map((tag) => normalizeTag(tag, eff, t));
      const obj = { tags: normTags, meta: data.meta };
      if (eff.appendSource) obj.source = location.href;
      return JSON.stringify(obj, null, 2);
    }

    if (eff.format === "sd" && kind === "tags") {
      let out = buildSdParts(data, eff).join(", ");
      if (eff.appendSource) out += "\nSource: " + location.href;
      return out;
    }

    const asComma = eff.format === "comma" || eff.format === "sd";
    const joiner = eff.format === "comma" || eff.format === "sd" ? ", " : " ";

    if (kind === "all" && eff.format === "sd") {
      const promptParts = buildSdParts(data, eff);
      const lines = [promptParts.join(", ")];
      for (const t of ["copyright", "artist", "character"]) {
        if (data.tags[t] && data.tags[t].length) {
          const label = t.charAt(0).toUpperCase() + t.slice(1);
          lines.push(`${label}${data.tags[t].length > 1 ? "s" : ""}: ${data.tags[t].map((x) => normalizeTag(x, eff, t)).join(", ")}`);
        }
      }
      const mb = metaBlock(data.meta);
      if (mb) lines.push("Metadata:", mb);
      let out = lines.join("\n");
      if (eff.appendSource) out += "\nSource: " + location.href;
      return out;
    }

    if (kind === "tags") {
      const flat = [];
      for (const cat of TAG_TYPES) {
        for (const raw of (data.tags[cat] || [])) {
          let tag = normalizeTag(raw, eff, cat);
          if (eff.format === "comma" || eff.format === "sd") tag = escapeParens(tag);
          flat.push(tag);
        }
      }
      let out = flat.join(joiner);
      if (eff.appendSource) out += "\nSource: " + location.href;
      return out;
    }

    if (eff.format === "custom") {
      const safe = (s) => String(s).replace(/\$/g, "$$$$");
      const flatForTpl = (() => {
        const f = [];
        for (const cat of TAG_TYPES) for (const raw of (data.tags[cat] || [])) f.push(normalizeTag(raw, eff, cat));
        return f;
      })();
      const joinForTpl = ", ";
      const tagsStr = flatForTpl.map((t) => eff.format === "comma" ? escapeParens(t) : t).join(joinForTpl);
      let out = eff.template
        .replace(/\{tags\}/g, safe(tagsStr))
        .replace(/\{copyright\}/g, safe((data.tags.copyright || []).map((x) => normalizeTag(x, eff, "copyright")).join(", ")))
        .replace(/\{artist\}/g, safe((data.tags.artist || []).map((x) => normalizeTag(x, eff, "artist")).join(", ")))
        .replace(/\{character\}/g, safe((data.tags.character || []).map((x) => normalizeTag(x, eff, "character")).join(", ")))
        .replace(/\{meta\}/g, safe(metaBlock(data.meta)));
      if (eff.appendSource) out += "\nSource: " + location.href;
      return out;
    }

    const flat2 = [];
    for (const cat of TAG_TYPES) for (const raw of (data.tags[cat] || [])) {
      let tag = normalizeTag(raw, eff, cat);
      if (asComma) tag = escapeParens(tag);
      flat2.push(tag);
    }
    const lines = [`Tags: ${flat2.join(joiner)}`];
    for (const t of ["copyright", "artist", "character"]) {
      if (data.tags[t] && data.tags[t].length) {
        const label = t.charAt(0).toUpperCase() + t.slice(1);
        lines.push(`${label}${data.tags[t].length > 1 ? "s" : ""}: ${data.tags[t].map((x) => normalizeTag(x, eff, t)).join(", ")}`);
      }
    }
    const mb = metaBlock(data.meta);
    if (mb) lines.push("Metadata:", mb);
    let out = lines.join("\n");
    if (eff.appendSource) out += "\nSource: " + location.href;
    return out;
  }

  function metaBlock(meta) {
    const keys = Object.keys(meta);
    if (!keys.length) return "";
    return keys.map((k) => `  ${k}: ${meta[k]}`).join("\n");
  }

  /* ============================== History ============================== */

  function recordHistory(text, count) {
    chrome.storage.local.get({ teHistory: [] }, ({ teHistory }) => {
      if (!Array.isArray(teHistory)) teHistory = [];
      const entry = { u: location.href, c: count, t: Date.now(), x: text.slice(0, 4000) };
      const next = [entry, ...teHistory].slice(0, 10);
      chrome.storage.local.set({ teHistory: next }, () => {
        if (chrome.runtime.lastError) console.warn("[TagExtract] history save failed:", chrome.runtime.lastError.message);
      });
    });
  }

  /* ============================== Clipboard + feedback ============================== */

  function flash(btn, msg) {
    if (!btn) return;
    const label = btn.querySelector(".te-label");
    const target = label || btn;
    const orig = target.dataset.origText || target.textContent;
    target.dataset.origText = orig;
    target.textContent = msg;
    btn.classList.add("te-flash");
    clearTimeout(btn._flashTimer);
    btn._flashTimer = setTimeout(() => { target.textContent = orig; btn.classList.remove("te-flash"); }, 1400);
  }

  function writeClipboard(text) {
    return navigator.clipboard.writeText(text).catch(() => {
      if (!document.body) return Promise.reject(new Error("no document.body for fallback"));
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      let ok = false;
      try {
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        ok = document.execCommand("copy");
      } finally {
        try { ta.remove(); } catch (_) {}
      }
      return ok ? Promise.resolve() : Promise.reject(new Error("execCommand failed"));
    });
  }

  function doCopy(kind, btn, opts) {
    const silent = opts && opts.silent;
    const skipHistory = opts && opts.skipHistory;
    const data = collect();
    if (!data || data.empty || !data.all.length) {
      if (!silent) flash(btn, "No tags found");
      return false;
    }
    const text = formatOutput(data, kind);
    const excluded = data.counts.excluded || 0;
    const base = kind === "tags" ? `Copied ${data.counts.total} tags` : `Copied ${data.counts.total} tags + metadata`;
    const msg = excluded ? `${base} (${excluded} excluded)` : base;
    writeClipboard(text).then(() => {
      if (!silent) flash(btn, msg);
      if (!skipHistory) recordHistory(text, data.counts.total);
    }).catch(() => {
      if (!silent) flash(btn, "Clipboard blocked");
    });
    return true;
  }

  /* ============================== Theme ============================== */

  let cachedTheme = null;
  function detectTheme() {
    if (cachedTheme) return cachedTheme;
    try {
      const bg = getComputedStyle(document.body).backgroundColor;
      const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (m) {
        const lum = 0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3];
        cachedTheme = lum < 128 ? "dark" : "light";
        return cachedTheme;
      }
    } catch (_) {}
    try {
      cachedTheme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch (_) { cachedTheme = "light"; }
    return cachedTheme;
  }
  function applyTheme() {
    const theme = detectTheme();
    const box = document.getElementById("te-buttons");
    if (box) box.dataset.teTheme = theme;
    const bar = document.getElementById("te-merge-bar");
    if (bar) bar.dataset.teTheme = theme;
  }

  /* ============================== Buttons — textContent (no innerHTML) ============================== */

  function buildButtons(counts) {
    const bTags = document.createElement("button");
    bTags.type = "button";
    bTags.className = "te-btn";
    bTags.title = "Copy all tags in your chosen format";
    bTags.setAttribute("aria-label", `Copy Tags${counts ? ` (${counts.total})` : ""}`);
    const labelTags = document.createElement("span");
    labelTags.className = "te-label";
    labelTags.textContent = "Copy Tags";
    bTags.appendChild(labelTags);
    if (counts) {
      const c = document.createElement("span");
      c.className = "te-count";
      c.textContent = String(counts.total);
      c.setAttribute("aria-hidden", "true");
      bTags.appendChild(c);
    }

    const bAll = document.createElement("button");
    bAll.type = "button";
    bAll.className = "te-btn te-btn-all";
    bAll.title = "Copy tags + metadata";
    bAll.setAttribute("aria-label", `Copy All${counts ? ` (${counts.total})` : ""}`);
    const labelAll = document.createElement("span");
    labelAll.className = "te-label";
    labelAll.textContent = "Copy All";
    bAll.appendChild(labelAll);
    if (counts) {
      const c2 = document.createElement("span");
      c2.className = "te-count";
      c2.textContent = String(counts.total);
      c2.setAttribute("aria-hidden", "true");
      bAll.appendChild(c2);
    }

    bTags.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); doCopy("tags", bTags); });
    bAll.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); doCopy("all", bAll); });
    const box = document.createElement("div");
    box.id = "te-buttons";
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", "TagExtract copy actions");
    box.dataset.teTheme = detectTheme();
    box.append(bTags, bAll);
    return box;
  }

  function tagListAnchor() {
    if (SITES.DANBOORU) return document.querySelector("#tag-list");
    if (SITES.E621) return document.querySelector("#tag-list");
    if (SITES.MOEBOORU) return document.querySelector("#tag-sidebar");
    if (SITES.GELBOORU) return document.querySelector("#tag-sidebar") || document.querySelector("#tag-list") || document.querySelector(".tag-list");
    return null;
  }

  function injectButtons() {
    if (!isPostPage() || document.getElementById("te-buttons")) return;
    const data = collect();
    const counts = data && !data.empty ? data.counts : null;
    const box = buildButtons(counts);
    const anchor = tagListAnchor();
    if (anchor && anchor.isConnected) {
      box.classList.add("te-embedded");
      anchor.insertAdjacentElement("afterend", box);
    } else {
      document.body.appendChild(box);
    }
  }

  /* ============================== Multi-post listing ============================== */

  let listingInjected = false;

  function parseDataTags(str) {
    if (!str) return [];
    return str.trim().split(/\s+/).filter(Boolean).map((t) => t.replace(/_/g, " "));
  }

  function injectListingUI() {
    if (!isListingPage()) return;
    if (document.getElementById("te-merge-bar")) return;
    const previews = document.querySelectorAll("article.post-preview[data-tags], div.post-preview[data-tags]");
    if (!previews.length) return;
    if (listingInjected && document.querySelector(".te-check")) return;
    listingInjected = true;

    previews.forEach((el) => {
      if (el.querySelector(".te-check")) return;
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "te-check";
      cb.title = "Include in merged copy";
      cb.setAttribute("aria-label", "Include in merged copy");
      const cs = getComputedStyle(el);
      if (cs.position === "static") el.style.position = "relative";
      el.prepend(cb);
      cb.addEventListener("click", (e) => e.stopPropagation());
      cb.addEventListener("change", updateMergeBar);
    });

    const bar = document.createElement("div");
    bar.id = "te-merge-bar";
    bar.dataset.teTheme = detectTheme();
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "Merged copy");
    const label = document.createElement("span");
    label.className = "te-merge-label";
    label.textContent = "0 posts selected \u00B7 0 tags";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "te-btn te-btn-merge";
    btn.textContent = "Copy merged tags";
    btn.addEventListener("click", doMergeCopy);
    bar.append(label, btn);

    const postsContainer = document.querySelector("#posts, #post-list, .post-list");
    if (postsContainer && postsContainer.parentElement) {
      // Insert BEFORE flex container to avoid breaking flex flow
      postsContainer.parentElement.insertBefore(bar, postsContainer);
    } else if (postsContainer) {
      postsContainer.prepend(bar);
    } else {
      const main = document.querySelector("main");
      if (main) main.prepend(bar);
      else document.body.prepend(bar);
    }
    updateMergeBar();
  }

  function selectedTags() {
    const cbs = document.querySelectorAll("article.post-preview .te-check:checked, div.post-preview .te-check:checked");
    const eff = effectiveSettings();
    const seen = new Set();
    const merged = [];
    let excluded = 0;
    cbs.forEach((cb) => {
      const article = cb.closest("[data-tags]");
      const raw = article ? article.getAttribute("data-tags") : "";
      for (const tag of parseDataTags(raw)) {
        if (isBlacklisted(tag, eff.blacklist || [])) { excluded++; continue; }
        let t = normalizeTag(tag, eff, "general");
        if (eff.format === "comma" || eff.format === "sd") t = escapeParens(t);
        if (eff.format === "sd") {
          const w = weightForCategory("general", eff);
          t = sdWrap(t, w);
        }
        const key = t.toLowerCase();
        if (!seen.has(key)) { seen.add(key); merged.push(t); }
      }
    });
    return { tags: merged, count: merged.length, posts: cbs.length, excluded };
  }

  function updateMergeBar() {
    const bar = document.getElementById("te-merge-bar");
    if (!bar) return;
    const { count, posts } = selectedTags();
    const label = bar.querySelector(".te-merge-label");
    if (label) label.textContent = `${posts} post${posts !== 1 ? "s" : ""} selected \u00B7 ${count} tag${count !== 1 ? "s" : ""}`;
  }

  function doMergeCopy() {
    const { tags, count, posts, excluded } = selectedTags();
    if (!count) return;
    const eff = effectiveSettings();
    const prefix = eff.format === "sd" ? resolvePrefix(eff) : "";
    let text;
    if (eff.format === "json") {
      const obj = { tags, count, posts };
      if (eff.appendSource) obj.source = location.href;
      text = JSON.stringify(obj, null, 2);
    } else if (eff.format === "sd" && prefix) {
      text = [prefix, ...tags].join(", ");
      if (eff.appendSource) text += "\nSource: " + location.href;
    } else {
      const joiner = eff.format === "comma" || eff.format === "sd" ? ", " : " ";
      text = tags.join(joiner);
      if (eff.appendSource) text += "\nSource: " + location.href;
    }
    const msg = excluded ? `Copied ${count} tags from ${posts} posts (${excluded} excluded)` : `Copied ${count} tags from ${posts} posts`;
    const barBtn = document.querySelector("#te-merge-bar .te-btn-merge");
    writeClipboard(text).then(() => {
      if (barBtn) flash(barBtn, msg);
      recordHistory(text, count);
    }).catch(() => {
      if (barBtn) flash(barBtn, "Clipboard blocked");
    });
  }

  /* ============================== Observer + init ============================== */

  let observer = null;
  let debounceTimer = 0;
  let lastAutoKey = "";

  function observeTarget() {
    // Narrow scope: sidebar / posts containers only, not the whole document
    return document.querySelector("#tag-list, #tag-sidebar, #posts, #post-list, .post-list, main, body");
  }

  function startObserving() {
    if (observer) return;
    observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (isPostPage()) injectButtons();
        if (isListingPage()) { injectListingUI(); }
        applyTheme();
      }, 250);
    });
    const target = observeTarget();
    if (target) observer.observe(target, { childList: true, subtree: true });
    else observer.observe(document.documentElement, { childList: true, subtree: true });
  }
  function stopObserving() {
    if (observer) { observer.disconnect(); observer = null; }
    clearTimeout(debounceTimer);
  }

  // SPA navigation: popstate + patched pushState/replaceState (replaces 5s polling watchdog)
  function onSpaNav() {
    setTimeout(() => {
      cachedTheme = null;
      if (isListingPage() && !document.getElementById("te-merge-bar")) { listingInjected = false; injectListingUI(); }
      if (isPostPage() && !document.getElementById("te-buttons")) injectButtons();
      tryAutoCopy();
    }, 300);
  }
  window.addEventListener("popstate", onSpaNav);
  try {
    const origPush = history.pushState;
    history.pushState = function (...args) { const r = origPush.apply(this, args); onSpaNav(); return r; };
    const origReplace = history.replaceState;
    history.replaceState = function (...args) { const r = origReplace.apply(this, args); onSpaNav(); return r; };
  } catch (_) {}

  function tryAutoCopy() {
    const eff = effectiveSettings();
    if (!eff.autoCopy || !isPostPage()) return;
    const key = location.pathname + location.search;
    if (key === lastAutoKey) return;
    lastAutoKey = key;
    setTimeout(() => {
      // re-check settings in case user toggled off
      if (!effectiveSettings().autoCopy) return;
      const data = collect();
      if (!data || data.empty) return;
      const text = formatOutput(data, "tags");
      writeClipboard(text).catch(() => {});
      const btn = document.querySelector("#te-buttons .te-btn");
      if (btn) flash(btn, `Auto-copied ${data.counts.total} tags`);
    }, 600);
  }

  // Init: load settings first, then inject
  chrome.storage.sync.get(DEFAULTS, (s) => {
    const sanitized = sanitizeSettings(s);
    for (const k of Object.keys(DEFAULTS)) if (sanitized[k] === undefined) sanitized[k] = DEFAULTS[k];
    if (!sanitized.sdWeights) sanitized.sdWeights = { ...DEFAULTS.sdWeights };
    else for (const k of Object.keys(DEFAULTS.sdWeights)) if (sanitized.sdWeights[k] === undefined) sanitized.sdWeights[k] = DEFAULTS.sdWeights[k];
    if (!sanitized.blacklist) sanitized.blacklist = [...DEFAULTS.blacklist];
    Object.assign(settings, sanitized);
    if (isPostPage()) { injectButtons(); tryAutoCopy(); }
    if (isListingPage()) injectListingUI();
    startObserving();
    try {
      matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { cachedTheme = null; applyTheme(); });
    } catch (_) {}
    setTimeout(tryAutoCopy, 1200);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    const sanitized = sanitizeSettings(Object.fromEntries(Object.entries(changes).map(([k, c]) => [k, c.newValue])));
    for (const k of Object.keys(DEFAULTS)) if (sanitized[k] === undefined && changes[k] !== undefined && changes[k].newValue === undefined) settings[k] = DEFAULTS[k];
    Object.assign(settings, sanitized);
    applyTheme();
  });

  window.addEventListener("pagehide", () => { stopObserving(); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopObserving();
    else startObserving();
  });

  /* ============================== Popup / hotkey messages ============================== */

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && (msg.type === "copy-tags" || msg.type === "copy-all")) {
      chrome.storage.sync.get(DEFAULTS, (s) => {
        const sanitized = sanitizeSettings(s);
        for (const k of Object.keys(DEFAULTS)) if (sanitized[k] === undefined) sanitized[k] = DEFAULTS[k];
        if (!sanitized.sdWeights) sanitized.sdWeights = { ...DEFAULTS.sdWeights };
        Object.assign(settings, sanitized);
        const isListing = isListingPage() && document.querySelector("[data-tags]");
        if (isListing && msg.type === "copy-tags") {
          const { tags, count, excluded } = selectedTags();
          if (!count) { sendResponse({ ok: false, msg: "Select at least one post (checkboxes on thumbnails)" }); return; }
          const eff = effectiveSettings();
          let text;
          if (eff.format === "json") {
            const obj = { tags, count };
            if (eff.appendSource) obj.source = location.href;
            text = JSON.stringify(obj, null, 2);
          } else if (eff.format === "sd") {
            const pre = resolvePrefix(eff);
            text = pre ? [pre, ...tags].join(", ") : tags.join(", ");
            if (eff.appendSource) text += "\nSource: " + location.href;
          } else {
            text = tags.join(eff.format === "comma" ? ", " : " ");
            if (eff.appendSource) text += "\nSource: " + location.href;
          }
          writeClipboard(text).then(() => {
            if (msg.via !== "hotkey") recordHistory(text, count);
            const m = excluded ? `Copied ${count} tags (${excluded} excluded)` : `Copied ${count} tags`;
            sendResponse({ ok: true, msg: m });
          }).catch(() => sendResponse({ ok: false, msg: "Clipboard blocked" }));
          return;
        }
        const data = collect();
        if (!data || data.empty || !data.all.length) { sendResponse({ ok: false, msg: "No tags found on this page" }); return; }
        const text = formatOutput(data, msg.type === "copy-tags" ? "tags" : "all");
        writeClipboard(text).then(() => {
          if (msg.via !== "hotkey") recordHistory(text, data.counts.total);
          const ex = data.counts.excluded ? ` (${data.counts.excluded} excluded)` : "";
          sendResponse({ ok: true, msg: msg.type === "copy-tags" ? `Copied ${data.counts.total} tags${ex}` : `Copied ${data.counts.total} tags + metadata${ex}` });
        }).catch(() => sendResponse({ ok: false, msg: "Clipboard blocked. Use the on-page buttons." }));
      });
      return true;
    }
    if (msg && msg.type === "ping") sendResponse({ ok: true, post: isPostPage(), listing: isListingPage() });
    return false;
  });
})();
