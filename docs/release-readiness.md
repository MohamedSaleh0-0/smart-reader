# Release readiness

This is the Phase 1 checklist for the current root deployment.

## Completed in this pass

- External book connectors are explicitly deferred from the first release.
- Obsidian is explicitly deferred to a later companion integration.
- Core workflows and feature status are documented.
- A dependency-free repository check is available through `npm run check`.
- GoatCounter page-view tracking is enabled for the public GitHub Pages hostname only; local and file-opened portable use does not load the counter.

## Must verify before a release

- [ ] The live GitHub Pages deployment serves the intended root files.
- [ ] Offline reload works after the service worker is installed.
- [ ] The service worker cache contains only existing files.
- [ ] Representative Arabic HTML, DOCX, Markdown, TXT, EPUB, ODT, and PDF fixtures import correctly.
- [ ] A book and annotation survive reload.
- [ ] Backup export and restore work in a clean browser profile.
- [ ] Quota or blocked-storage errors are visible and actionable.
- [ ] Deep links open the intended book/page/ordinal in a fresh session where the book exists.
- [ ] The printed-page versus internal-page behavior is documented.
- [ ] The current `smart-reader.mcpb` and `sr-mcp.js` versions are aligned with the live download links.
- [ ] Claude Desktop installation is tested on Windows; Mac remains a separate verification target.
- [ ] AI provider behavior is tested with real keys only in a controlled test account.
- [ ] Android and iPadOS smoke tests are completed.

## Release blockers

- A backup can be exported but cannot be restored safely.
- A service-worker cache references a missing file.
- A deep link opens the wrong passage without a clear fallback.
- A provider sends content without the user understanding that it leaves the device.
- The live site serves a different bridge version from the documented download.

