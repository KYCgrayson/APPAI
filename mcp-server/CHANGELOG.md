# Changelog

All notable changes to `@appai/mcp-server` will be documented here.

## 1.0.0

Initial release.

- Device Authorization flow (`start-auth`, `poll-auth`) — sign in with Google to get an API key
- Page management: `create-page`, `list-pages`, `get-page`, `update-page`, `delete-page`, `set-default-locale`
- Discovery: `list-presets` (6 templates), `list-sections` (24 section types with schemas, including `iframe-tool` for vibe-coded tool hosting)
- Guided prompts: `create-app-page`, `setup-privacy-policy`
- Resources: `appai://spec`, `appai://llms.txt`
