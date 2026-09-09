# TagExtract

> Copy tags, metadata, and copyright from supported image boards in one click. Output is ready for your prompt.

[![Release](https://img.shields.io/github/v/release/Kyrstears/TagExtract)](https://github.com/Kyrstears/TagExtract/releases)
[![License](https://img.shields.io/github/license/Kyrstears/TagExtract?cacheSeconds=3600)](LICENSE)
[![Manifest](https://img.shields.io/badge/manifest-V3-green)](#)
[![Browser](https://img.shields.io/badge/browser-Chrome%20%7C%20Chromium-orange)](#)
[![Dependencies](https://img.shields.io/badge/dependencies-none-success)](#)
[![Sites](https://img.shields.io/badge/sites-16-blue)](#supported-sites)

## Supported Sites

| Family | Hosts |
|--------|-------|
| Danbooru | `danbooru.donmai.us`, `aibooru.online` |
| Gelbooru | `gelbooru.com`, `safebooru.org`, `rule34.xxx`, `rule34.us`, `rule34hentai.net`, `xbooru.com`, `hypnohub.net`, `tbib.org` |
| e621 | `e621.net`, `e926.org` |
| Moebooru | `yande.re`, `konachan.com`, `konachan.net`, `lolibooru.moe` |

This extension matches 32 URL patterns, covering both http and https on www and apex domains.

## Features

- **One-click copy:** Injects Copy Tags and Copy All below the tag list; falls back to a floating panel that does not cover the image.
- **5 formats:** space, comma, SD prompt, JSON, and custom template with placeholders `{tags}`, `{copyright}`, `{artist}`, `{character}`, `{meta}`.
- **SD weights:** Per-category wrapping as `(tag:1.10)`, clamped to 0.1–2.0, with parentheses escaped as `\( \)` for A1111 and ComfyUI.
- **Prefix presets:** SD 1.5, Pony, Illustrious, NoobAI (`masterpiece, best quality, newest, absurdres, highres, safe`), and Anima (`masterpiece, best quality, score_7, safe`), plus custom presets.
- **Anima mode:** Converts tags to lowercase with spaces and optionally prefixes artists with `@`.
- **Blacklist:** Glob (`*`) patterns (for example, `*_(cosplay)`, `bad_*`), up to 200 entries; reports the number excluded.
- **Normalization:** Converts between spaces and underscores and can strip `character (series)` qualifiers.
- **Tag order:** Choose the output order of tag categories (character, copyright, artist, meta, general).
- **Replacement rules:** Up to 100 find → replace rules applied to tags before copying (for example, `1girl` → `1girl, solo`); an empty replacement deletes the tag.
- **Rating filter:** Flag or exclude posts by rating (safe / sensitive / questionable / explicit). Ratings are normalized across sites, including Danbooru's letter ratings.
- **Per-tag selection:** Collapsible checkbox panel on post pages for copying a subset of tags.
- **.txt download:** Save the current tag output as a `.txt` file, named after the site and post ID.
- **Multi-post merge:** On listing pages (all supported sites), select thumbnails with checkboxes. Then click Copy merged tags to copy a deduplicated set.
- **Tag count warning:** Listing pages warn when the merged tag set exceeds 75 tags, since many models degrade beyond that point.
- **Live counter:** Displays the tag count as a badge on the Copy Tags button (for example, `Copy Tags 23`).
- **Keyboard shortcuts:** `Ctrl+Shift+1` for Copy Tags and `Ctrl+Shift+2` for Copy All (remappable at `chrome://extensions/shortcuts`).
- **Auto-copy:** Copies automatically on post load, once per URL, with SPA navigation support.
- **History:** Last 10 copies in the popup; re-copy or clear entries.
- **Theme-aware:** Adapts to light and dark themes via luminance detection and `prefers-color-scheme`, without flash on load.
- **Per-site overrides:** Override format, prefix preset, and tag style per supported hostname.
- **Source append:** Optionally appends a `Source: <url>` line to the output.

## Installation

### Option A: Download release (recommended)

1. Download [`TagExtract-v1.0.0.zip`](https://github.com/Kyrstears/TagExtract/releases/download/v1.0.0/TagExtract-v1.0.0.zip) from [Releases](https://github.com/Kyrstears/TagExtract/releases/tag/v1.0.0) and unzip it.
2. Go to `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder.
4. Open any supported post; the buttons appear below the tag list.

### Option B: From source

1. Clone this repo and go to `chrome://extensions` and enable **Developer mode**.
2. Click **Load unpacked** and select the project folder.
3. Open **Options** to configure format, presets, blacklist, and weights.

Reload the extension after editing `manifest.json` or `background.js`.

## Usage

**Post page:** Click Copy Tags or Copy All. A confirmation message appears, for example, `Copied 23 tags (2 excluded)`.

**Listing page:** Select thumbnails, then click Copy merged tags. A confirmation message shows, for example, `Copied 132 tags from 5 posts`.

**Popup:** Shows the active format and history (collapsible, with re-copy). Hotkeys work on post and listing pages.

**Options:** Go to `chrome://extensions` > TagExtract > Options, or use the Options link in the popup.

## Format Details

| Format | Example |
|--------|---------|
| space | `1girl blue_hair smile` |
| comma | `1girl, blue_hair, smile` |
| sd | `masterpiece, best quality, (1girl:1.10), smile` |
| json | `{"tags":{"character":["..."]},"meta":{...}}` |
| custom | your `template` with placeholders |

SD escaping example: `kotatsu_(pchu)` becomes `kotatsu_\(pchu\)` or `(kotatsu_\(pchu\):1.10)`.

## Settings

Stored in `chrome.storage.sync` (history in `chrome.storage.local`):

```js
{
  format: "space",
  prefixPreset: "sd15", // none | sd15 | pony | illustrious | noobai | anima | custom
  sdPrefix: "masterpiece, best quality",
  blacklist: ["commentary", "translated", ...], // glob *
  sdWeights: { character: 1.1, artist: 1.0, copyright: 1.0, general: 1.0 },
  tagStyle: "spaces", stripQualifiers: false,
  autoCopy: false, appendSource: false,
  prefixArtistsWithAt: false, // Anima @artist
  tagOrder: ["character", "copyright", "artist", "meta", "general"],
  replacements: [{ find: "1girl", replace: "1girl, solo" }],
  ratingFilter: { enabled: false, mode: "flag", allowed: ["safe", "sensitive", "questionable", "explicit"] },
  siteOverrides: { "danbooru.donmai.us": { format: "sd" } }
}
```

## Permissions

Requires `storage` (settings and history), `activeTab` (to message the active tab), and `clipboardWrite` (to copy). No network, login, or download permissions.

## Development

No build step required. Edit files and reload the unpacked extension.

```
shared.js     — Shared constants, limits, validation sets, and helpers (single source of truth)
content.js    — Handles extractors, blacklist, formatting, UI injection, and observer
background.js — Handles hotkeys via tabs.sendMessage
popup.html/js — Popup and history
options.html/js — Settings UI
style.css     — Buttons, merge bar, selection panel, and theme variables
manifest.json — MV3, 32 matches, commands
```

## License

MIT
