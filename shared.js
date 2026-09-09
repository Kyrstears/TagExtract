/* TagExtract — shared constants and helpers (single source of truth).
   Loaded before content.js in content scripts and before options.js on the
   options page. Must stay context-agnostic: no chrome.* API calls here.
   Keep ALLOWED_HOSTS in lockstep with manifest.json and the options page
   per-site override dropdown. */

const TAGEXT = {
  /* Supported hosts — validated before any per-site override is stored */
  ALLOWED_HOSTS: new Set([
    "danbooru.donmai.us", "rule34.xxx", "rule34.us", "rule34hentai.net",
    "gelbooru.com", "safebooru.org", "aibooru.online", "xbooru.com",
    "hypnohub.net", "tbib.org", "e621.net", "e926.org",
    "yande.re", "konachan.com", "konachan.net", "lolibooru.moe",
  ]),

  /* Input size limits: chars for text fields, entry count for lists */
  LIMITS: { sdPrefix: 500, template: 2000, blacklist: 200, pattern: 100, rule: 200, rules: 100, rulesBytes: 7000, mergeWarn: 75 },

  /* Settings schema — defaults written to chrome.storage.sync */
  DEFAULTS: {
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
    tagOrder: ["character", "copyright", "artist", "meta", "general"],
    replacements: [],
    ratingFilter: { enabled: false, mode: "flag", allowed: ["safe", "sensitive", "questionable", "explicit"] },
  },

  /* SD prompt prefix presets. NoobAI per the official Laxhar Lab model card
     (eps 1.0/1.1 and V-Pred 1.0 share the same prefix). */
  PREFIX_PRESETS: {
    none: "",
    sd15: "masterpiece, best quality",
    pony: "score_9, score_8_up, score_7_up",
    illustrious: "masterpiece, best quality, newest, absurdres, highres",
    anima: "masterpiece, best quality, score_7, safe",
    noobai: "masterpiece, best quality, newest, absurdres, highres, safe",
  },

  /* Accepted values for enum-like settings */
  VALID_FORMATS: new Set(["space", "comma", "sd", "json", "custom"]),
  VALID_PRESETS: new Set(["none", "sd15", "pony", "illustrious", "anima", "noobai", "custom"]),
  VALID_TAGSTYLES: new Set(["spaces", "underscores"]),
  VALID_RATINGS: new Set(["safe", "sensitive", "questionable", "explicit"]),
  VALID_RATING_MODES: new Set(["flag", "exclude"]),

  /* Tag categories that may appear in a tagOrder permutation */
  TAG_CATEGORIES: ["character", "copyright", "artist", "meta", "general"],

  /* Keys accepted inside a per-site override entry */
  OVERRIDE_KEYS: new Set(["format", "prefixPreset", "tagStyle"]),

  /* Keys never accepted from storage (prototype pollution guard) */
  FORBIDDEN_KEYS: new Set(["__proto__", "prototype", "constructor"]),

  /* Clamp an SD weight to 0.1–2.0, rounded to 2 decimals */
  clampWeight(v) {
    const n = parseFloat(v);
    if (!isFinite(n)) return 1.0;
    return Math.min(2.0, Math.max(0.1, Math.round(n * 100) / 100));
  },

  /* True when arr is a permutation of all five tag categories */
  isValidTagOrder(arr) {
    if (!Array.isArray(arr) || arr.length !== this.TAG_CATEGORIES.length) return false;
    const seen = new Set(arr);
    if (seen.size !== arr.length) return false;
    return this.TAG_CATEGORIES.every((c) => seen.has(c));
  },

  /* Normalize any site's rating to safe|sensitive|questionable|explicit.
     Accepts full words (Safe/General/Sensitive/Questionable/Explicit) and
     single letters. The letter "s" is ambiguous across families: Danbooru uses
     g/s/q/e (s = sensitive) while Moebooru/Gelbooru/e621 use s/q/e (s = safe),
     so pass family="danbooru" to disambiguate. Returns null when unknown so
     callers can treat the rating as "not filterable". */
  normalizeRating(raw, family) {
    const s = String(raw || "").trim().toLowerCase();
    if (!s) return null;
    if (["safe", "general"].includes(s)) return "safe";
    if (s === "sensitive") return "sensitive";
    if (s === "questionable") return "questionable";
    if (s === "explicit") return "explicit";
    if (s.length !== 1) return null;
    if (family === "danbooru") {
      if (s === "g") return "safe";
      if (s === "s") return "sensitive";
    } else if (s === "s") {
      return "safe";
    }
    if (s === "q") return "questionable";
    if (s === "e") return "explicit";
    return null;
  },
};
