# shrowser

sh + browser = shrowser. Composable browser scripting.

```sh
shrowser list                              # list all tabs
shrowser 'list | grep github | close'      # close github tabs
shrowser 'new claude.ai ; new chat.com'    # open two tabs
echo 'search "mount everest"' | shrowser   # search via stdin
```

Or use the in-browser REPL: press `Ctrl+`` on any page.

## Setup

### Prerequisites

- [Bun](https://bun.sh) (`curl -fsSL https://bun.sh/install | bash`)
- Firefox

### Install

```sh
git clone <repo> && cd shrowser
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

### In-browser REPL

Press **Ctrl+\`** on any page to open the command bar. Type commands and hit Enter. Dismiss with **Esc**, **Ctrl+D**, **Ctrl+\`**, or click away.

No daemon needed — commands go directly to the extension.

### CLI usage (optional)

The CLI requires the daemon as a bridge between your terminal and the extension.

```sh
# start the daemon
bun run daemon

# send commands
shrowser list
shrowser 'list | grep github'
shrowser 'new example.com'
echo 'list | head 5' | shrowser
```

## Commands

### Browser

| Command     | Usage                    | Description                              |
|-------------|--------------------------|------------------------------------------|
| `list`      | `list`                   | list all open tabs                       |
| `close`     | `close [idx]`            | close tab by index, pipe, or current     |
| `new`       | `new <url>`              | open a new tab (auto-prepends https://)  |
| `jump`      | `jump <idx \| string>`   | switch to tab by index or search         |
| `search`    | `search <query...>`      | search with DuckDuckGo                   |
| `reload`    | `reload`                 | reload current tab                       |
| `back`      | `back`                   | go back in history                       |
| `forward`   | `forward`                | go forward in history                    |
| `pin`       | `pin [idx]`              | toggle pin on tab                        |
| `mute`      | `mute [idx]`             | toggle mute on tab                       |

### Data

| Command  | Usage                | Description                          |
|----------|----------------------|--------------------------------------|
| `echo`   | `echo [args...]`     | echo args or pass through pipe       |
| `grep`   | `grep <pattern>`     | filter lines/rows by substring       |
| `head`   | `head [n=10]`        | take first N lines/rows              |
| `tail`   | `tail [n=10]`        | take last N lines/rows               |
| `count`  | `count`              | count lines/rows                     |
| `select` | `select <col...>`    | pick columns from a table            |
| `help`   | `help`               | list all commands with usage          |

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
shrowser     ──WS──▶   broker server     ◀──WS──     background.ts
                        routes commands                ├─ command registry
                        routes results                 ├─ browser API calls
                                                       └─ content script (REPL)

In-browser REPL: content script ──message──▶ background.ts (no daemon needed)
```

## Development

```sh
bun test          # run tests
bun run build:ext # build extension
bun run daemon    # start daemon
```
