# UXP External References & Links

## Official Adobe Documentation

- [Premiere Pro UXP Documentation](https://developer.adobe.com/premiere-pro/uxp/) — Main developer portal
- [Premiere Pro UXP API Reference](https://developer.adobe.com/premiere-pro/uxp/ppro_reference/) — Full class/method reference
- [UXP Premiere Pro Docs Repo](https://github.com/AdobeDocs/uxp-premiere-pro) — Source markdown for all docs
- [TypeScript Definitions (types.d.ts)](https://github.com/AdobeDocs/uxp-premiere-pro/blob/main/src/pages/ppro_reference/types.d.ts) — Official authoritative type reference
- [UXP Premiere Pro Samples](https://github.com/AdobeDocs/uxp-premiere-pro-samples) — Official sample plugins (Premiere API, Metadata Handler, OAuth)
- [Adobe Creative Cloud Developer Forums](https://forums.creativeclouddeveloper.com/) — Bug reports, feature requests, community support

## Adobe Blog & Announcements

- [UXP Arrives in Premiere — Adobe Tech Blog (Dec 2025)](https://blog.developer.adobe.com/en/publish/2025/12/uxp-arrives-in-premiere-a-new-era-for-plugin-development) — Official launch announcement, graduated from beta in v25.6

## Community & Third-Party Tools

- [Bolt UXP (Hyper Brew)](https://github.com/hyperbrew/bolt-uxp) — Vite + React/Svelte/Vue boilerplate with hot reload, TypeScript, CCX packaging
- [Premiere Pro UXP Beta Guide (Hyper Brew)](https://hyperbrew.co/blog/premiere-pro-uxp-beta/) — Migration strategy, gotchas, timeline assessment
- [Davide Barranca: UXP Things You Need to Know](https://www.davidebarranca.com/development/adobe-uxp-things-you-need-to-know) — Architecture deep-dive: V8 engine, DOM limitations, Spectrum, CEP comparison
- [Structuring a UXP Plugin (Brad Holmes)](https://www.brad-holmes.co.uk/uxp-plugin-engineering/structuring-a-uxp-plugin/) — Flat architecture, single-file patterns, state management
- [webpack-uxp-starter](https://github.com/emptykid/webpack-uxp-starter) — Webpack + React + TypeScript starter template
- [adobe/uxp-optimized](https://github.com/adobe/uxp-optimized) — Adobe's own optimized React/Spectrum setup
- [Adobe UXP Photoshop WebSocket Sample](https://github.com/AdobeDocs/uxp-photoshop-plugin-samples/tree/main/io-websocket-example) — WebSocket implementation reference (patterns apply to Premiere)

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
