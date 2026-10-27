# action-hub for Pi

Pi adapter for the shared [`../core`](../core) core.

- `/ah` or `Alt+A` opens a native Pi TUI palette;
- Command Actions paste their rendered prompt into the Pi editor;
- Skill Actions insert `/skill:<name>`, so Pi loads the skill natively;
- `resources_discover` exposes only Skill-mode Actions available in the current project;
- `/ah import <path>` imports a standard skill folder or ZIP;
- `/ah reload` reloads Pi resources after out-of-band changes.

No server, browser window, port, or separate process is involved. The extension
runs inside Pi.

## Local development

```bash
cd ../..
npm install
npm test --workspace pi-action-hub
cd packages/pi
pi -e ./extensions/action-hub.js
```

`pi -e` loads the extension for one Pi invocation. To install the local package
persistently, run `pi install ./packages/pi` from the repository root after
`npm install`; Pi packages do not install a local package's dependency tree for
you. In a session:

```text
/ah
/ah import C:\path\to\skill-folder
```

The Pi package is still early; group/project-scope management is intentionally
left to the shared core and can be added as a TUI management screen.

## Data

The adapter uses the core default:

```text
$ACTION_HUB_HOME/   (defaults to ~/.action-hub)
  library/
  state.json
```

It shares this library with the DSH adapter, so both harnesses see the same
Actions and scopes.
