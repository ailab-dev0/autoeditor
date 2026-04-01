# UXP External References & Links

## Official Adobe Documentation

- [Premiere Pro UXP Documentation](https://developer.adobe.com/premiere-pro/uxp/) — Main developer portal
- [Premiere Pro UXP API Reference](https://developer.adobe.com/premiere-pro/uxp/ppro_reference/) — Full class/method reference
- [UXP Premiere Pro Docs Repo](https://github.com/AdobeDocs/uxp-premiere-pro) — Source markdown for all docs
- [TypeScript Definitions (types.d.ts)](https://github.com/AdobeDocs/uxp-premiere-pro/blob/main/src/pages/ppro_reference/types.d.ts) — Official authoritative type reference
- [UXP Premiere Pro Samples](https://github.com/AdobeDocs/uxp-premiere-pro-samples) — Official sample plugins (Premiere API, Metadata Handler, OAuth)
- [Adobe Creative Cloud Developer Forums](https://forums.creativeclouddeveloper.com/) — Bug reports, feature requests, community support

## Adobe Docs (Specific Pages)

- [Building First UXP Plugin](https://developer.adobe.com/premiere-pro/uxp/plugins/) — Getting started guide
- [Plugin Manifest](https://developer.adobe.com/premiere-pro/uxp/plugins/concepts/manifest/) — manifest.json configuration
- [Entrypoints](https://developer.adobe.com/premiere-pro/uxp/plugins/concepts/entrypoints/) — Panel and command entrypoints
- [Panels and Commands](https://developer.adobe.com/premiere-pro/uxp/plugins/concepts/panels-and-commands/) — UI panel vs headless command
- [Lifecycle Hooks](https://developer.adobe.com/premiere-pro/uxp/plugins/tutorials/add-lifecycle-hooks/) — create, show, hide, destroy
- [Add Multiple Panels](https://developer.adobe.com/premiere-pro/uxp/plugins/tutorials/add-panels/) — Multi-panel plugin setup
- [Modal Dialogs](https://developer.adobe.com/premiere-pro/uxp/plugins/tutorials/add-modal-dialogs/) — Dialog API usage
- [Inter-Plugin Communication](https://developer.adobe.com/premiere-pro/uxp/plugins/tutorials/inter-plugin-comm/) — Cross-plugin messaging
- [Package Plugin](https://developer.adobe.com/premiere-pro/uxp/plugins/distribution/package/) — CCX packaging guide
- [Install Plugin](https://developer.adobe.com/premiere-pro/uxp/plugins/distribution/install/) — Installation methods
- [Dev Tools](https://developer.adobe.com/premiere-pro/uxp/introduction/essentials/dev-tools/) — UDT overview
- [UDT Deep Dive](https://developer.adobe.com/premiere-pro/uxp/plugins/tutorials/udt-deep-dive/) — Advanced UDT usage
- [Starters & Samples](https://developer.adobe.com/premiere-pro/uxp/resources/starters-samples/) — Official starter templates
- [CSS Styling](https://developer.adobe.com/premiere-pro/uxp/resources/recipes/css-styling/) — Supported CSS properties
- [Filesystem Operations](https://developer.adobe.com/premiere-pro/uxp/resources/recipes/filesystem-operations/) — File I/O in UXP
- [User Interfaces](https://developer.adobe.com/premiere-pro/uxp/resources/fundamentals/user-interfaces/) — UI fundamentals
- [Spectrum UXP Widgets](https://developer.adobe.com/premiere-pro/uxp/uxp-api/reference-spectrum/Spectrum%20UXP%20Widgets/) — Widget reference
- [Spectrum to SWC Mapping](https://developer.adobe.com/premiere-pro/uxp/uxp-api/reference-spectrum/Spectrum%20to%20SWC%20Mapping/) — Migration from Spectrum UXP to SWC

## Adobe Blog & Announcements

- [UXP Arrives in Premiere — Adobe Tech Blog (Dec 2025)](https://blog.developer.adobe.com/en/publish/2025/12/uxp-arrives-in-premiere-a-new-era-for-plugin-development) — Official launch announcement, graduated from beta in v25.6

## Adobe Developer Forums (Key Threads)

- [WebSocket manifest v5 fix](https://forums.creativeclouddeveloper.com/t/websocket-connection-not-working-in-manifestversion-5/6322) — WebSocket broken in manifest v5, workaround
- [WebSocket empty error](https://forums.creativeclouddeveloper.com/t/web-socket-connection-returns-an-empty-error/1806) — Empty error on WebSocket connect
- [WebSocket connection issues](https://forums.creativeclouddeveloper.com/t/issues-connecting-to-a-websocket-server/7347) — General WS troubleshooting
- [fetch API discussion](https://forums.creativeclouddeveloper.com/t/the-fetch-api/688) — fetch behavior and limitations in UXP
- [CORS/SSL in UXP](https://forums.creativeclouddeveloper.com/t/photoshop-uxp-plugin-cors-ssl-problem/3414) — CORS and SSL certificate issues
- [Domain permission denied](https://forums.creativeclouddeveloper.com/t/uxp-manifest-network-permission-denied-for-fetch-despite-domains-all/10557) — domains:all still denied
- [Domain permission fetch error](https://forums.creativeclouddeveloper.com/t/issue-with-manifest-v-5-domain-permissions-fetch-error/4714) — Manifest v5 domain permissions broken
- [Image upload fix](https://forums.creativeclouddeveloper.com/t/solved-image-upload-axios-post-wont-work/4632) — Solved: axios POST for image upload
- [File upload via fetch/XHR](https://forums.creativeclouddeveloper.com/t/fetch-xhr-file-upload/2117) — File upload patterns
- [How to use actions](https://forums.creativeclouddeveloper.com/t/how-to-use-action-in-premierepro-uxp/8867) — Action API in Premiere UXP
- [Add clips to sequence](https://forums.creativeclouddeveloper.com/t/how-to-add-clips-to-a-sequence-using-premiere-pro-uxp-api/8977) — Clip insertion API
- [SWC rendering issues](https://forums.creativeclouddeveloper.com/t/spectrum-web-components-not-rendering-properly-in-uxp/11751) — SWC components not rendering
- [sp-picker status](https://forums.creativeclouddeveloper.com/t/is-sp-picker-now-official/4159) — sp-picker availability

## Community Deep-Dives

- [Davide Barranca: UXP Things You Need to Know](https://www.davidebarranca.com/development/adobe-uxp-things-you-need-to-know) — Architecture deep-dive: V8 engine, DOM limitations, Spectrum, CEP comparison
- [Davide Barranca: Manifest v5](https://www.davidebarranca.com/development/Adobe-UXP-things-you-need-to-know-manifest-5.html) — Manifest v5 breaking changes and migration
- [Davide Barranca: Spectrum UXP Components](https://www.davidebarranca.com/development/adobe-uxp-things-you-need-to-know-9-adobe-spectrum-uxp) — Spectrum UXP widget deep-dive
- [Davide Barranca: Modal Dialogs](https://www.davidebarranca.com/development/Adobe-UXP-things-you-need-to-know-10-Dialogs.html) — Dialog patterns and gotchas
- [Davide Barranca: Commands, Panels, Manifest](https://www.davidebarranca.com/development/adobe-uxp-things-you-need-to-know-4-commands-panels-manifest) — Entrypoint types explained
- [Francesco (minifloppy): UXP Panels & Commands](https://www.minifloppy.it/posts/2024/photoshop-plugins-with-uxp-panels-commands/) — Practical panel/command patterns
- [Structuring a UXP Plugin (Brad Holmes)](https://www.brad-holmes.co.uk/uxp-plugin-engineering/structuring-a-uxp-plugin/) — Flat architecture, single-file patterns, state management
- [Premiere Pro UXP Beta Guide (Hyper Brew)](https://hyperbrew.co/blog/premiere-pro-uxp-beta/) — Migration strategy, gotchas, timeline assessment

## Community & Third-Party Tools

- [Bolt UXP (Hyper Brew)](https://github.com/hyperbrew/bolt-uxp) — Vite + React/Svelte/Vue boilerplate with hot reload, TypeScript, CCX packaging
- [webpack-uxp-starter](https://github.com/emptykid/webpack-uxp-starter) — Webpack + React + TypeScript starter template
- [adobe/uxp-optimized](https://github.com/adobe/uxp-optimized) — Adobe's own optimized React/Spectrum setup
- [Adobe UXP Photoshop WebSocket Sample](https://github.com/AdobeDocs/uxp-photoshop-plugin-samples/tree/main/io-websocket-example) — WebSocket implementation reference (patterns apply to Premiere)

## GitHub Repos

- [SWC UXP Wrappers](https://github.com/adobe/swc-uxp-wrappers) — Spectrum Web Components adapted for UXP
- [UXP Photoshop Kitchen Sink](https://github.com/AdobeDocs/uxp-photoshop-plugin-samples/blob/main/ui-kitchen-sink/index.html) — UI component showcase

## Raw GitHub Doc URLs (When Adobe SPA Fails)

The Adobe docs site is a JS-rendered SPA that often fails to serve content. Use raw GitHub URLs for reliable access:

```
https://raw.githubusercontent.com/AdobeDocs/uxp-premiere-pro/main/src/pages/ppro_reference/classes/{className}.md
```

Available class docs: `project`, `sequence`, `videotrack`, `audiotrack`, `videocliptrackitem`, `audiocliptrackitem`, `clipprojectitem`, `folderitem`, `markers`, `marker`, `ticktime`, `compoundaction`, `sequenceeditor`, `transitionfactory`, `component`, `componentparam`, `videocomponentchain`, `audiocomponentchain`, `videofilterfactory`, `audiofilterfactory`, `exporter`, `encodermanager`, `sourcemonitor`, `eventmanager`, `properties`, `media`, `keyframe`, `application`, `metadata`, `footageinterpretation`, `framerate`, `guid`, `color`, `pointf`, `rectf`, `projectutils`, `sequenceutils`, `sequencesettings`, `projectsettings`, `scratchdisksettings`, `projectcolorsettings`, `apppreference`, `prproduction`, `transcript`, `textsegments`, `trackitemselection`, `projectitemselection`, `ingestsettings`, `openprojectoptions`, `closeprojectoptions`, `addtransitionoptions`, `timedisplay`, `captiontrack`

Plugin/tutorial docs:
```
https://raw.githubusercontent.com/AdobeDocs/uxp-premiere-pro/main/src/pages/plugins/concepts/manifest/index.md
https://raw.githubusercontent.com/AdobeDocs/uxp-premiere-pro/main/src/pages/plugins/concepts/entrypoints/index.md
https://raw.githubusercontent.com/AdobeDocs/uxp-premiere-pro/main/src/pages/plugins/tutorials/add-panels/index.md
https://raw.githubusercontent.com/AdobeDocs/uxp-premiere-pro/main/src/pages/plugins/tutorials/add-commands/index.md
https://raw.githubusercontent.com/AdobeDocs/uxp-premiere-pro/main/src/pages/plugins/tutorials/add-lifecycle-hooks/index.md
https://raw.githubusercontent.com/AdobeDocs/uxp-premiere-pro/main/src/pages/plugins/tutorials/add-modal-dialogs/index.md
https://raw.githubusercontent.com/AdobeDocs/uxp-premiere-pro/main/src/pages/plugins/tutorials/inter-plugin-comm/index.md
```
