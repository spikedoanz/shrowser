# spike-browser

Composable browser scripting from your terminal. Pipe commands into Firefox like a shell.

```sh
spike-browser list                              # list all tabs
spike-browser 'list | grep github | close'      # close github tabs
spike-browser 'new claude.ai ; new chat.com'    # open two tabs
echo 'search "mount everest"' | spike-browser   # search via stdin
```

## Setup

### Prerequisites

- [Bun](https://bun.sh) (`curl -fsSL https://bun.sh/install | bash`)
- Firefox

### Install

```sh
git clone <repo> && cd spike-browser
bun install
```

### Build the extension

```sh
bun run build:ext
```

This outputs `dist/extension/` with the bundled Firefox extension.

### Load the extension in Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Select `dist/extension/manifest.json`

### Start the daemon

The daemon is a WebSocket broker on `localhost:9231` that routes commands between the CLI and the extension.

```sh
bun run daemon
```

Keep this running in a terminal.

### Send commands

```sh
# as arguments
bun run src/cli/main.ts list
bun run src/cli/main.ts 'list | grep github'
bun run src/cli/main.ts 'new example.com'

# via stdin
echo 'list | head 5' | bun run src/cli/main.ts
```

## Commands

### Browser

| Command     | Description                        | Example                     |
|-------------|------------------------------------|-----------------------------|
| `list`      | list all tabs (table)              | `list`                      |
| `close`     | close tab by index or current      | `close 3`                   |
| `new`       | open a new tab                     | `new claude.ai`             |
| `jump`      | switch to tab by index             | `jump 0`                    |
| `search`    | search with DuckDuckGo             | `search mount everest`      |
| `reload`    | reload current tab                 | `reload`                    |
| `back`      | go back in history                 | `back`                      |
| `forward`   | go forward in history              | `forward`                   |
| `pin`       | toggle pin on tab                  | `pin 2`                     |
| `mute`      | toggle mute on tab                 | `mute`                      |

### Data

| Command  | Description                          | Example                          |
|----------|--------------------------------------|----------------------------------|
| `echo`   | echo args or pass through pipe       | `echo hello`                     |
| `grep`   | filter lines/rows by substring       | `list \| grep github`            |
| `head`   | take first N lines/rows              | `list \| head 5`                 |
| `tail`   | take last N lines/rows               | `list \| tail 3`                 |
| `count`  | count lines/rows                     | `list \| count`                  |
| `select` | pick columns from a table            | `list \| select title url`       |
| `help`   | list all commands                    | `help`                           |

## Language

Shell-like syntax designed for piping. Every command returns a value (text, table, or void).

```sh
# pipes — output of left feeds into right
list | grep github | close

# semicolons — sequential, independent commands
new a.com ; new b.com

# quoting
new "https://example.com/path with spaces"
search 'who is the first man on the moon'

# subshells
echo $(list | count) tabs open

# comments
list  # shows all tabs
```

## Architecture

```
Terminal (CLI)          Daemon (localhost:9231)        Firefox Extension
─────────────          ──────────────────────         ─────────────────
spike-browser ──WS──▶  broker server     ◀──WS──     background.ts
                        routes commands                ├─ command registry
                        routes results                 ├─ browser API calls
                                                       └─ content script
```

## Development

```sh
bun test          # run tests
bun run build:ext # build extension
bun run daemon    # start daemon
```
