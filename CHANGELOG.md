# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
