# AppAI MCP Server

MCP (Model Context Protocol) server for [AppAI](https://appai.info) - create and manage hosted landing pages, privacy policies, and terms of service directly from AI coding agents.

## Quick Setup

### Claude Code

```bash
claude mcp add appai -- npx -y @appai/mcp-server
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "appai": {
      "command": "npx",
      "args": ["-y", "@appai/mcp-server"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "appai": {
      "command": "npx",
      "args": ["-y", "@appai/mcp-server"]
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `start-auth` | Start device authorization flow to get an API key |
| `poll-auth` | Poll for auth completion after start-auth |
| `list-presets` | List available page templates (app landing, SaaS, profile, etc.) |
| `list-sections` | List available section types with data schemas |
| `create-page` | Create a new hosted page with landing page, privacy policy, and ToS |
| `list-pages` | List all your pages |
| `get-page` | Get details of a specific page |
| `update-page` | Update an existing page (partial or full) |
| `delete-page` | Delete a page |
| `set-default-locale` | Change the default locale for a page |

## Available Prompts

| Prompt | Description |
|--------|-------------|
| `create-app-page` | Guided flow to create a landing page for your app |
| `setup-privacy-policy` | Fastest way to get a privacy policy URL for App Store / Google Play |

## Usage Example

Once installed, just tell your AI agent:

> "Create a landing page for my app on AppAI"

or

> "I need a privacy policy URL for my app to submit to the App Store"

The agent will use the MCP tools to authenticate, create the page, and give you the live URLs.

## Resources

The server also exposes these resources:
- `appai://spec` - Full API specification
- `appai://llms.txt` - LLM-friendly service overview

## License

MIT
