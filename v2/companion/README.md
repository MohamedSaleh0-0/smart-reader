# Smart Reader local companion

The optional local companion connects the v2 reader to Claude Desktop and Codex over MCP. It listens only on `127.0.0.1`, exposes read-only tools, and keeps shared book text in memory. It does not make the reader depend on Node or a network connection.

## Start it

Install Node.js 20 or newer. From the project’s `v2` directory:

```powershell
npm run companion:serve
```

Keep that process running while using the local bridge. The first run creates a pairing token in the current user’s `.smart-reader-v2/companion.json` configuration directory. Display it with:

```powershell
npm run companion:token
```

Open the reader, choose **ربط المساعد**, paste the token, test the connection, choose the active book or the whole library, then explicitly share it. To use only the MCP client process to start the companion, configure that client to launch `smart-reader-companion.mjs` directly instead of starting `--serve` separately.

## Claude Desktop

Add a local stdio server under `mcpServers` in Claude Desktop’s configuration:

```json
{
  "mcpServers": {
    "smart-reader-v2": {
      "command": "node",
      "args": ["D:\\projects\\smart-reader\\v2\\companion\\smart-reader-companion.mjs"]
    }
  }
}
```

Use the absolute path to this file on your computer. Restart Claude Desktop after saving the configuration.

## Codex

Add the following to `~/.codex/config.toml`, changing the script path to the absolute path on your computer:

```toml
[mcp_servers.smart_reader_v2]
command = "node"
args = ["D:\\projects\\smart-reader\\v2\\companion\\smart-reader-companion.mjs"]
```

Restart Codex and confirm that `smart_reader_v2` appears in its MCP server list.

## Available tools

- `shared_library` lists books explicitly shared from the reader.
- `current_book` describes the active shared book and any shared text selection.
- `search_library` searches shared passages with Arabic normalization.
- `get_passage` retrieves an exact passage and its local deep link.
- `get_page` retrieves the passages on a page or reader position.
- `get_selection` returns the selected text and its passage context.

The browser sends text-only book data to the local companion after the user selects a scope and presses the share button. HTML and source files are not sent. The companion does not save the shared book text to disk. MCP clients receive only the tool results they request; those results then follow the selected client's account and data policies. **إنهاء المشاركة** clears the in-memory session. The pairing token is a local credential; do not share it.

The current version supports read-only MCP sharing and an in-app, retrieval-grounded cloud Q&A panel. The panel can list current models from Gemini, OpenAI, Claude API, OpenRouter, and Groq. It requires an API key from the chosen provider; the key is held in the page's memory and sent in the request to the local companion, then used for the provider request. It is not saved in browser storage, the companion config, or the portable HTML. The provider receives the question and up to eight matching passage excerpts, plus short conversation history. Review the provider's account, cost, and data policies before use.

The **مقارنة الأصوات** tab can list Arabic voices from Google Cloud TTS and Azure Speech, and voices/models available to an OpenAI key. It synthesizes the same sample text with each selected voice, measures request latency, allows ratings for pronunciation, naturalness, and pacing, and lets you download samples. It applies a shared limit of 4,096 characters and 5,000 UTF-8 bytes so one passage can be compared across providers. Listening and rating still require the user's provider keys; no quality ranking is implied by the app. Audio samples live only in page memory and are revoked when cleared or when the panel is closed.
