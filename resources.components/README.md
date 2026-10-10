# G4 webview components

The webview pages of the extension (Test Wright, the run report, the bot report, and the
component gallery) are built from reusable components. Each component is a complete unit in its
own folder: its markup, styles, icons, and behavior. The standard is the same as in the
[G4 Engine extension](https://github.com/g4-api/g4-vscode-extension), and the shared components
(`g4-modal`, `g4-toggle`, `g4-select`, `g4-page-header`, `g4-section`) are copies of its files.

## Folder layout

| Folder | What it is |
| --- | --- |
| `test-wright/` | The Test Wright page: header, bots tree, testing plan, repositories, console. Its scripts live in `test-wright/modules/`. |
| `run-report/` | The run report tab: one run (`run.json`) shown with `g4-run-summary`. |
| `automation-report/` | The G4 automation report of one bot (a `.g4rpt` file). |
| `component-gallery/` | Every component on one page, for development (F5 only). |
| `g4-*/` | Reusable components, used by the pages and by each other. |

Every component folder holds six files named after the component:

| File | Holds |
| --- | --- |
| `g4-name.html` | One or more `<template>` elements with the markup and the embedded SVG icons. |
| `g4-name.js` | The custom element `<g4-name>`, in an IIFE so nothing leaks into the page. |
| `g4-name.css` | Imports the three files below, in this order. |
| `g4-name.parameters.css` | `--g4-name-*` custom properties, mapped to VS Code theme variables. |
| `g4-name.layout.css` | Display, box model, sizing, spacing, and border width and style. |
| `g4-name.visual.css` | Colors, fonts, border colors, radius, shadows, and visual states. |

Pages follow the same split: `page.html`, `page.js`, `page.css`, and the three CSS files.

## Components

| Component | Purpose | Used by |
| --- | --- | --- |
| `g4-accordion` | Stacks child sections under collapsible headers; open sections share the height. | Test Wright (repositories) |
| `g4-console-drawer` | Timestamped output log with Copy and Clear; lines colored by kind. | Test Wright (console) |
| `g4-date-picker` | `YYYY-MM-DD HH:MM` box with a calendar popup; past dates optional. | Test Wright (schedule, reports filter) |
| `g4-empty-state` | Icon, heading, and a supporting line for an empty list. | Test Wright |
| `g4-environment-picker` | Header trigger with the selected environment and a list of the workspace environments. | Test Wright (header) |
| `g4-tag-filter` | Searchable multi-select of tags with their bot counts. | Test Wright (filters) |
| `g4-run-summary` | One run record: status, tally, tools, and one row per bot. | Test Wright (viewer), run report |
| `g4-modal` | Centered dialog with a round Close button; Escape closes the top one. | Test Wright (dialogs, viewer) |
| `g4-toggle` | On/off switch with a label and hint. | Test Wright |
| `g4-select` | Themed dropdown, optionally followed by buttons. | Component gallery |
| `g4-page-header` | Page title, details line, and optional items on the right. | Automation report |
| `g4-section` | Foldable page section with a description, warning, and status line. | Automation report |

The header comment of every `g4-*.js` file lists the component's attributes, properties, methods,
and events.

## How a page uses components

A page lists the components it uses in a meta tag, lists its own scripts in a second meta tag,
and holds the placeholders:

```html
<head>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src {{$ csp.source }}; ...">
    <meta name="g4-components" content="g4-accordion g4-modal g4-toggle">
    <meta name="g4-page-modules" content="test-wright-client test-wright-utils">
    {{$ components.styles }}
    <link rel="stylesheet" href="{{$ component.style.uri }}">
</head>
<body>
    ...
    {{$ components.templates }}
    {{$ components.scripts }}
    {{$ page.modules }}
    <script src="{{$ component.script.uri }}"></script>
</body>
```

`WebviewPages.newPageHtml` (`src/extensions/webview-pages.ts`) builds the page:

- `WebviewComponents.setComponentHtml` (`src/extensions/webview-components.ts`) adds the listed
  components and every component they build on (from the `data-dependencies` attribute of the
  component's first template), each once, after the components it depends on.
- `{{$ page.modules }}` becomes one script tag per module under `<page>/modules/`, in the listed
  order. Modules share the page's global scope; the page script loads last and starts the page.
- `{{$ page.data }}` (optional) is HTML-escaped JSON the page reads on load. It is filled last, so
  the data is never searched for placeholders.

## Talking to the extension

Pages call the extension host with a request/response protocol over `postMessage`:

```js
// Page → host
{ kind: 'request', id: 7, type: 'bots:find', payload: { folderPath } }

// Host → page
{ kind: 'response', id: 7, result: { tests, warnings } }   // or { error: 'message' }
{ kind: 'event', type: 'run:event', payload: { runId, testId, status } }
```

`test-wright/modules/test-wright-client.js` wraps this as `g4Host.request(type, payload)` and
`g4Host.on(type, handler)`. The handler table is in
`src/providers/test-wright-panel-provider.ts`.

## Component rules

- **Behavior:** a component renders once, in `connectedCallback`, into the light DOM (no shadow DOM),
  so the page's font and VS Code theme variables apply and tests can find every part. A component
  that is moved in the page keeps what it rendered.
- **Data in:** attributes, the element's children or text content, and properties (`value`,
  `record`, `environments`, and so on).
- **Data out:** bubbling custom events, such as `g4-input` and `g4-change` with `{ value }`, and
  `g4-action` with `{ id }`. Pages listen once, on a container or the component.
- **Test ids:** every part's `data-test-id` is the component's `test-id` attribute followed by the
  part name, for example `environment-picker-trigger-button`.
- **Icons:** every component embeds the SVG icons it shows; icons are not shared between components.
- **Styles:** a component's layout and visual files read only its own `--g4-name-*` parameters.

## Adding a component

1. Create `resources.components/g4-name/` with the six files above.
2. List the components it builds on in `data-dependencies` on its first `<template>`.
3. Register the element with `customElements.define('g4-name', ...)`, guarded by
   `customElements.get`.
4. Document its contract in the header comment of `g4-name.js`.
5. Add `g4-name` to the `g4-components` meta tag of every page that uses it.
6. Add a card for it to the component gallery.
