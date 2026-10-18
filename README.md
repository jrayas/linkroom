# Linkroom

Browse the notes linked to and from the active note on a calm, full-page grid.

Linkroom opens a page in a main tab that shows the notes connected to the note you are reading, in three groups:

- **Both ways**: notes it links to that also link back.
- **Outgoing**: notes it links to (one way).
- **Backlinks**: notes that link to it (one way).

Each note appears once. Names only, in a borderless grid, styled to your theme. Markdown notes only.

## Open it

- Click the link icon in the ribbon, or run **Open linked notes** from the command palette.
- Set a hotkey for it under Settings → Hotkeys if you like. There is no default.

The page follows the note you are working in.

## Use it

| Action | Result |
|---|---|
| Click (tap on mobile) | Open the note in your last note tab; the Linkroom page stays open |
| Cmd-click / Ctrl-click, or middle-click | Open in a new tab |
| Cmd+Option-click / Ctrl+Alt-click | Open in a split to the right |
| Hover with Cmd / Ctrl | Obsidian's page preview (if Page preview is on) |
| Right-click (long-press on mobile) | Open, Open in new tab, Open to the right, Reveal in file explorer |

## Search any note

The search field works like Obsidian's quick switcher (Cmd/Ctrl+O), over every note in your vault: type part of a name, an alias or a folder, then pick a result with the arrow keys and Enter, or click it. The note opens in your last note tab, behind Linkroom, and the page switches to **that** note's links. Cmd/Ctrl+Enter opens it in a new tab instead. With an empty field the list shows your recently opened notes.

Keyboard: `/` or Cmd/Ctrl+F focuses search; Esc closes the list, then clears the field. In the grid, arrow keys, Home and End move between notes; Enter opens (with Cmd/Ctrl for a new tab).

Notes that do not exist yet are shown dimmed with a dotted underline and cannot be opened. You can hide them in settings.

## Options

The **gear** in the top-right corner holds quick toggles: folders, headings, aliases, the three groups, sort order and columns (1 to 4 or Auto). With headings off, the groups run together in one grid.

**Settings → Community plugins → Linkroom** holds the rest: font, font size, **link style** (Hairline, Sky link or Soft tile), link colour, underline thickness (Hairline), row spacing, folder style, wrapping of long names, unresolved links, duplicate names, opening on startup, and the defaults used when Obsidian starts.

## Privacy and safety

- Read-only: Linkroom never creates, edits, renames, moves or deletes notes.
- No network access, no accounts, no payments, no telemetry.
- The only file it writes is its own settings file, `data.json`, in the plugin folder.
- One internal Obsidian feature is used: revealing a note in the File explorer, which has no public API. If it is not available, that menu item is hidden.

## Platforms

Desktop (macOS, Windows, Linux) and mobile (iOS, iPadOS, Android). The mobile layout and touch behaviour were checked in Obsidian's mobile emulation on macOS; they have not yet been tried on a real phone or tablet. Windows and Linux have not been tested.

## Development

```sh
npm install
npm run build        # type-check and production build
npm run lint         # eslint-plugin-obsidianmd, recommended rules
npm test             # unit tests for the pure logic in src/core
npm run vault:create # fixture vault in test-vault/template
npm run debug:launch # isolated Obsidian on a scratch copy, only the release files
npm run e2e          # end-to-end checks against that Obsidian
npm run debug -- stop
```

## Licence

MIT, © 2026 Anthirayas.
