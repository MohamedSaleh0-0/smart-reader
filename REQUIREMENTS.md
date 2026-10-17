# REQUIREMENTS — Smart Reader (القارئ الذكي)

Source: the user's requests during development. Nothing here is invented; "Not available from the conversation history" marks gaps.

## Confirmed requirements

**Product / platform**
- Arabic-first reader for Islamic texts; presented under منصة مدارج التفقه (للفقه الحنبلي).
- Installable PWA, offline, on Android, iPad (incl. 12.9"), desktop; hosted on GitHub Pages (`ayasseen11/smart-reader`); a zip of the full project must be producible.
- User data stays on the device; no mandatory server.

**Library / shelf:** add books (HTML, docx, md, txt, epub, odt, PDF, pasted text, drag-drop); folders, tags, categories, colours; heritage-bookcase look; close button placed *below* the library icon; conflict badge; backup/restore.

**Reading:** TOC, search (normalised Arabic, scopes), root search (optional toggle), results with context (short/medium/paragraph), reading modes/themes, split-screen (white-screen bug fixed), line/paragraph/margin spacing next to font size, TTS with current-sentence highlight, voice/speed/pitch options, male voice by default, sunnah.one search link.

**Study tools:** highlights with categories, notes (incl. audio comments and formatted paste), favourites, clipboard, copy with citation, pen/text boxes, Word export, linked Word notebook via folder, cross-reference links (multi-position and cross-book), per-reader stats (time, streak, highlights per chapter) and teacher report.

**Data safety:** conflict alert instead of overwrite, merge, dated automatic snapshots/backups, clear save/sync indicator, Drive-link prompt on opening a book, safe restore.

**Guide/onboarding:** guide book opens automatically on first use and documents every feature; tour balloons for shelf, book, PDF.

**PDF:** open inside the app with as many reader features as feasible.

**AI ("✦ اسأل")**
- Ask about the open book with citations to pages; provider chosen by user with own key: Claude, ChatGPT, and free options Gemini, OpenRouter, Groq.
- Scope toggle "هذا الكتاب / مكتبتي كلها"; cross-book comparison with per-book attribution; clickable citations that open the other book.
- "Copy question with context" button for pasting into Claude/ChatGPT using the user's subscription; context must include selected text + its page + current page.
- Free-tier privacy warning; robust to model-name changes, rate limits and overload.

**Claude Desktop integration**
- Easy install (`.mcpb`, no Node/JSON editing), Windows + Mac, desktop only.
- Tools: open book, list books, search library, search a book, get pages, selection. Library sharing opt-in (off by default), local-only.
- Claude's citations must be links that open the reader at the exact page **fragment**.

**Reports/communication (PDF, with platform logo, formal tone):** release report (additions/fixes, split by type), full feature catalogue (old vs new with "🆕 تحديث [N]" badges and date), "strongest features" one-pager, short and long release posts.

## Planned / pending (discussed, not finished)
- Upload `smart-reader.mcpb` 1.4.0 and updated `sr-mcp.js` to the repo root (site still serves 1.3). v31 itself is live.
- Resolve the user's reported mismatch between cited page number and what they see (needs the number they see).
- Real-device verification (Android, iPad, Mac extension, real API keys).
- Release name for the posts: Not available from the conversation history.

## Ideas / suggestions (not agreed as requirements)
- "Ask my library" reachable from the shelf without opening a book.
- Remote MCP server so iPad/Android Claude apps can use the library (assistant listed drawbacks: hosting, uploading books, auth; not recommended).
- Persisting the bridge's library on disk (rejected for privacy so far).
- Semantic/embedding search; ranking improvements for noisy results.
- Updating the earlier [٢] reports/guide further as features change.
