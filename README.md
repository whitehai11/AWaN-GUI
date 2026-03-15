# AWaN-GUI

AWaN-GUI is the native desktop interface for AWaN Core.

It uses:

- backend: Go
- desktop framework: Wails
- frontend: HTML, CSS, and minimal JavaScript

The GUI talks to AWaN Core over the local API and keeps all agent logic inside the runtime.

The application also checks for updates asynchronously on startup using a shared `internal/updater` module.

## Layout

- left sidebar: agents
- center: chat interface
- right panel: memory and files

## Core Connection

Default runtime endpoint:

```text
http://localhost:7452
```

You can override it with:

```bash
set AWAN_CORE_URL=http://localhost:7452
```

## Startup Flow

When the desktop app starts it will:

1. check if AWaN Core is running
2. attempt to start AWaN Core if needed
3. connect to the runtime API

## Structure

```text
AWaN-GUI/
  main.go
  frontend/
    index.html
    app.js
    styles.css
  api/
    core_client.go
  ui/
    chat.go
    memory.go
    agents.go
```

## Development

This repo is intended to run as a Wails app:

```bash
wails dev
```

Or build it with:

```bash
wails build
```

## Auto Updates

AWaN-GUI defines a local version constant and checks the latest GitHub release for `awan/gui` in the background at startup.

To disable auto updates for AWaN apps:

```text
~/.awan/config/runtime.awan
```

```text
auto_update = false
```
