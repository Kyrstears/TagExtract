# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.2] - 2026-09-08

### Changed

- Extracted shared constants and helpers (`DEFAULTS`, `ALLOWED_HOSTS`, `LIMITS`, prefix presets, validation sets, `clampWeight`) into a new `shared.js` module loaded by both the content script and the options page. The duplicated copies had already drifted (`LIMITS.pattern` was missing in options.js); this is now a single source of truth. No user-facing behavior change.

## [1.1.1] - 2026-09-08

### Added

- MIT `LICENSE` file, so the license badge and topics are backed by an actual license grant.

### Changed

- README badges now use dynamic shields: release version follows GitHub releases, license reads the repo license. Added dependencies (none) and supported sites (16) badges.

## [1.1.0] - 2026-09-08

### Added

- Support for five additional image boards: `aibooru.online`, `xbooru.com`, `hypnohub.net`, `tbib.org`, and `lolibooru.moe`, bringing the extension to 32 URL patterns.
- The new sites require additional host permissions and also appear in the per-site overrides dropdown on the options page.

## [1.0.0] - 2026-09-08

### Added

- One-click Copy Tags and Copy All buttons on post pages, with a floating panel fallback that does not cover the image.
- Support for Danbooru, Gelbooru (`gelbooru.com`, `safebooru.org`, `rule34.xxx`, `rule34.us`, `rule34hentai.net`), e621 (`e621.net`, `e926.org`), and Moebooru (`yande.re`, `konachan.com`, `konachan.net`) across 22 URL patterns.
- Five output formats: space-separated, comma-separated, SD prompt, JSON, and custom templates with `{tags}`, `{copyright}`, `{artist}`, `{character}`, and `{meta}` placeholders.
- SD weights: per-category wrapping as `(tag:1.10)`, clamped to 0.1–2.0, with parentheses escaped as `\( \)` for A1111 and ComfyUI.
- Prefix presets for SD 1.5, Pony, Illustrious, and Anima, plus custom presets.
- Anima mode that converts tags to lowercase with spaces and optionally prefixes artists with `@`.
- Tag blacklist with glob (`*`) patterns, up to 200 entries, with the excluded count reported on copy.
- Tag normalization between spaces and underscores, with optional stripping of `character (series)` qualifiers.
- Multi-post merge on listing pages: select thumbnails with checkboxes and copy a deduplicated tag set.
- Live tag count badge on the Copy Tags button.
- Keyboard shortcuts: `Ctrl+Shift+1` for Copy Tags and `Ctrl+Shift+2` for Copy All, remappable at `chrome://extensions/shortcuts`.
- Auto-copy on post load, once per URL, with SPA navigation support.
- Copy history of the last 10 entries in the popup, with re-copy and clear actions.
- Per-site overrides for format, prefix preset, and tag style per supported hostname.
- Optional `Source: <url>` line appended to the output.
- Theme-aware UI that adapts to light and dark themes via luminance detection and `prefers-color-scheme`, without flash on load.
