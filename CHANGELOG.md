# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-09-09

### Added

- **Rating filter:** Flag or exclude posts by rating (safe / sensitive / questionable / explicit), with cross-site normalization. Danbooru's letter ratings are disambiguated (`g`/`s` map to safe and sensitive on Danbooru; `s` maps to safe everywhere else). Flag mode shows an inline warning on post pages; exclude mode drops tags from disallowed posts and listings. Gelbooru listings do not expose ratings, so posts on those listings are never excluded.
- **NoobAI prefix preset:** `masterpiece, best quality, newest, absurdres, highres, safe`, verified against the official Laxhar Lab model cards. Also available as a per-site override.
- **Tag category order:** User-defined output order of the five tag categories (character, copyright, artist, meta, general), configurable on the options page.
- **.txt download:** Save the current tag output as a `.txt` file via the selection panel's toolbar. File names are derived from the site and post ID.
- **Replacement rules:** Up to 100 literal find → replace rules applied to tags before copying (for example, `1girl` → `1girl, solo`), with a total size cap.
- **Per-tag selection:** Collapsible checkbox panel on post pages for copying a subset of tags, with select all / none, copy selected, and .txt buttons.
- **Listing multiselect for Gelbooru and Moebooru:** The merged copy now works on all supported listing pages, not just Danbooru and e621. Moebooru tags and ratings are read from the preview image title; Gelbooru tags are read from `span.thumb` previews.
- **Tag count cap warning:** Listing pages warn when the merged tag set exceeds 75 tags, since many models degrade beyond that point.

### Changed

- The options page gains sections for the new settings: a tag order picker (positions swap automatically to stay a valid permutation), a replacement rule editor with a live count, and a rating filter with mode and allowed-rating checkboxes.
- The content script is rebuilt around `sanitizeSettings`, which fully validates the new setting shapes, including prototype-pollution guards. Family-aware rating normalization now lives in `shared.js`.

## [1.1.2] - 2026-09-08

### Changed

- Extracted shared constants and helpers (`DEFAULTS`, `ALLOWED_HOSTS`, `LIMITS`, prefix presets, validation sets, `clampWeight`) into a new `shared.js` module loaded by both the content script and the options page. The duplicates had already drifted (`LIMITS.pattern` was missing in options.js); there is now a single source of truth. No user-facing behavior change.

## [1.1.1] - 2026-09-08

### Added

- **MIT license:** A `LICENSE` file now backs the license badge and repo topics.

### Changed

- README badges now use dynamic shields: the release version follows GitHub releases and the license badge tracks the repository license. Added badges for dependencies (none) and supported sites (16).

## [1.1.0] - 2026-09-08

### Added

- **Five new sites:** `aibooru.online`, `xbooru.com`, `hypnohub.net`, `tbib.org`, and `lolibooru.moe`, bringing the extension to 32 URL patterns.
- The new sites require additional host permissions and appear in the per-site overrides dropdown on the options page.

## [1.0.0] - 2026-09-08

### Added

- **One-click copy:** Copy Tags and Copy All buttons on post pages, with a floating panel fallback that does not cover the image.
- **Supported sites:** Danbooru, Gelbooru (`gelbooru.com`, `safebooru.org`, `rule34.xxx`, `rule34.us`, `rule34hentai.net`), e621 (`e621.net`, `e926.org`), and Moebooru (`yande.re`, `konachan.com`, `konachan.net`) across 22 URL patterns.
- **Output formats:** Space-separated, comma-separated, SD prompt, JSON, and custom templates with `{tags}`, `{copyright}`, `{artist}`, `{character}`, and `{meta}` placeholders.
- **SD weights:** Per-category wrapping as `(tag:1.10)`, clamped to 0.1–2.0, with parentheses escaped as `\( \)` for A1111 and ComfyUI.
- **Prefix presets:** SD 1.5, Pony, Illustrious, and Anima, plus custom presets.
- **Anima mode:** Converts tags to lowercase with spaces and optionally prefixes artists with `@`.
- **Tag blacklist:** Glob (`*`) patterns, up to 200 entries; the excluded count is reported on copy.
- **Tag normalization:** Converts between spaces and underscores, with optional stripping of `character (series)` qualifiers.
- **Multi-post merge:** Select thumbnails on listing pages and copy a deduplicated tag set.
- **Live tag count:** Displayed as a badge on the Copy Tags button.
- **Keyboard shortcuts:** `Ctrl+Shift+1` for Copy Tags and `Ctrl+Shift+2` for Copy All, remappable at `chrome://extensions/shortcuts`.
- **Auto-copy:** Copies on post load, once per URL, with SPA navigation support.
- **Copy history:** Shows the last 10 entries in the popup, with re-copy and clear actions.
- **Per-site overrides:** Set format, prefix preset, and tag style for any supported hostname.
- **Source line:** Optionally appends a `Source: <url>` line to the output.
- **Theme-aware UI:** Adapts to light and dark themes via luminance detection and `prefers-color-scheme`, without flash on load.
