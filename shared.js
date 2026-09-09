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

  /* Input size limits: chars for text fields, entry count for blacklist */
  LIMITS: { sdPrefix: 500, template: 2000, blacklist: 200, pattern: 100 },

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
  },

  /* SD prompt prefix presets */
  PREFIX_PRESETS: {
    none: "",
    sd15: "masterpiece, best quality",
    pony: "score_9, score_8_up, score_7_up",
    illustrious: "masterpiece, best quality, newest, absurdres, highres",
    anima: "masterpiece, best quality, score_7, safe",
  },

  /* Accepted values for enum-like settings */
  VALID_FORMATS: new Set(["space", "comma", "sd", "json", "custom"]),
  VALID_PRESETS: new Set(["none", "sd15", "pony", "illustrious", "anima", "custom"]),
  VALID_TAGSTYLES: new Set(["spaces", "underscores"]),

  /* Keys never accepted from storage (prototype pollution guard) */
  FORBIDDEN_KEYS: new Set(["__proto__", "prototype", "constructor"]),

  /* Clamp an SD weight to 0.1–2.0, rounded to 2 decimals */
  clampWeight(v) {
    const n = parseFloat(v);
    if (!isFinite(n)) return 1.0;
    return Math.min(2.0, Math.max(0.1, Math.round(n * 100) / 100));
  },
};
