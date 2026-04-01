# UXP Supported Widgets & Components

Complete reference for all UI components available in Premiere Pro UXP plugins.

## Built-in Spectrum UXP Widgets (No Install Required)

These work immediately in any UXP panel HTML — no npm install, no import statements needed.

### Typography

| Tag | Description | Key Attributes |
|-----|-------------|----------------|
| `<sp-heading>` | Headings | `size` (XXXL, XXL, XL, L, M, S, XS, XXS) |
| `<sp-body>` | Body text | `size` (XXXL–XS) |
| `<sp-detail>` | Emphasized detail text | `size` |
| `<sp-label>` | Label text | `variant="overBackground"` |

### Form / Input

| Tag | Description | Key Attributes |
|-----|-------------|----------------|
| `<sp-textfield>` | Single-line text input | `type` (text, number, password, search), `quiet`, `valid`, `invalid`, `placeholder`, `disabled` |
| `<sp-textarea>` | Multi-line text input | `placeholder`, `quiet`, `valid`, `invalid` |
| `<sp-checkbox>` | Boolean toggle | `checked`, `indeterminate`, `disabled`, `invalid` |
| `<sp-radio-group>` | Radio container | `selected`, `name` |
| `<sp-radio>` | Radio option | `value`, `disabled` |
| `<sp-slider>` | Range slider | `min`, `max`, `value`, `variant="filled"` |
| `<sp-picker>` | Selection menu (replaces deprecated sp-dropdown) | `label`; requires `<sp-menu slot="options">` child |

### Buttons

| Tag | Description | Key Attributes |
|-----|-------------|----------------|
| `<sp-button>` | Standard button | `variant` (cta, primary, secondary, warning, negative), `quiet`, `disabled` |
| `<sp-action-button>` | Icon-capable action button | `selected`, `disabled` |

### Display / Utility

| Tag | Description | Key Attributes |
|-----|-------------|----------------|
| `<sp-divider>` | Visual separator | `size` (large, medium, small) |
| `<sp-icon>` | Spectrum icon | `name`, `size` — **only 36 icons available** |
| `<sp-link>` | Hyperlink | `href`, `quiet` |
| `<sp-menu>` | Menu container | — |
| `<sp-menu-item>` | Menu entry | `value`, `disabled`, `selected` |
| `<sp-menu-divider>` | Menu separator | — |
| `<sp-progressbar>` | Progress indicator | `value`, `max`, `indeterminate` |
| `<sp-tooltip>` | Tooltip | `placement` (top, bottom, left, right), `variant` (info, positive, negative), `open` |
| `<sp-icons-medium>` | Icon library loader | — |

### Built-in Widget Gotchas

- Only **36 UI icons** via `<sp-icon>` — use inline SVGs for anything else
- `sp-dropdown` is **DEPRECATED** — use `sp-picker` instead
- `sp-picker` onChange events unreliable — listen to `onClick` on individual `<sp-menu-item>` elements
- In React/Preact: use `selected={condition ? true : null}`, **never `false`**
- Spectrum CSS color tokens (`var(--spectrum-global-color-*)`) **do NOT work** in UXP
- Components take ~20% more space than CEP equivalents
- In React, use `class` not `className` on sp-* elements
- Always close tags explicitly: `<sp-slider></sp-slider>` (no self-closing)

---

## SWC Wrappers (@swc-uxp-wrappers)

Require npm install + explicit imports. **Must lock to SWC v0.37.0**. Set `enableSWCSupport: true` in manifest `featureFlags`.

```bash
npm install @swc-uxp-wrappers/button@0.37.0
```

```javascript
import '@swc-uxp-wrappers/button';
// Then use <sp-button> in JSX/HTML
```

### Fully Supported SWC

| Package | Component |
|---------|-----------|
| `action-button` | Action Button |
| `action-group` | Action Group |
| `avatar` | Avatar |
| `banner` | Banner |
| `button` | Button |
| `button-group` | Button Group |
| `dialog` | Dialog |
| `divider` | Divider |
| `field-group` | Field Group |
| `field-label` | Field Label |
| `help-text` | Help Text |
| `illustrated-message` | Illustrated Message |
| `picker-button` | Picker Button |
| `popover` | Popover |
| `quick-actions` | Quick Actions |
| `radio` | Radio |
| `swatch` | Swatch |
| `toast` | Toast |
| `tooltip` | Tooltip |

### SWC with Known Issues

| Package | Issue |
|---------|-------|
| `action-bar` | Rendering issues |
| `asset` | Rendering issues |
| `card` | Rendering issues |
| `checkbox` | Rendering issues |
| `link` | Rendering issues |
| `menu` | Rendering issues |
| `meter` | Rendering issues |
| `number-field` | Rendering issues |
| `overlay` | Rendering issues |
| `search` | Rendering issues |
| `sidenav` | Rendering issues |
| `switch` | Rendering issues |
| `table` | Rendering issues |
| `tags` | Rendering issues |
| `textfield` | Rendering issues |

### NOT Available in SWC (Must Build Custom)

| Component | Replacement |
|-----------|-------------|
| `sp-tabs` | Custom div tab bar with border-bottom indicator |
| `sp-accordion` | Custom div collapsible sections |
| `sp-color-area` | Not possible (no canvas) |
| `sp-progressbar` (SWC) | Use built-in `<sp-progressbar>` widget instead |

### SWC Design Note

Wrappers only override CSS styles — replacing `display: grid` with flexbox equivalents since UXP has **no CSS Grid** support.

### SWC Rendering Issues in Premiere (v25.6)

- `sp-textfield` may render but look distorted
- `sp-button` may show only text label, not button styling
- Elements exist in DOM but lack proper styling
- Vue 3 + Vite setups particularly affected
- Non-wrapper `@spectrum-web-components` (raw) fail with "appendChild is not a function"

---

## Supported HTML Elements

### Works

`<div>`, `<span>`, `<p>`, `<h1>`–`<h6>`, `<a>`, `<img>`, `<button>`, `<input>`, `<textarea>`, `<select>`, `<option>`, `<form>` (method="dialog" only), `<dialog>`, `<table>`, `<tr>`, `<td>`, `<th>`

### Unsupported / Degraded

| Element | Behavior |
|---------|----------|
| `<canvas>` | Not supported (no 2D/3D rendering context) |
| `<iframe>` | Not supported and likely never will be |
| `<video>` / `<audio>` | Not supported |
| `<ul>`, `<ol>`, `<li>` | Treated as simple `<div>` elements |
| `<input type="file">` | Not supported |
| `<input type="color">` | Not supported |
| `<label for="id">` | `for` attribute not supported |
| `<option disabled>` | `disabled` attribute not supported |

### HTML Gotchas

- `<select value="...">` does not show the value as selected
- `<option>` tags **MUST** have explicit `value` attribute or select returns undefined
- `<textarea>` size cannot be set with `rows`/`cols` — use CSS `width`/`height`
- HTML5 input validation is unsupported
- Failed images don't display broken image placeholder
- Input elements don't accept `defaultValue`
- Tab order cannot be specified
- Forms only support `method="dialog"`
- Unitless width/height values unsupported in UXP 3.1+
- `innerHTML` doesn't parse event handlers or `<script>` tags

---

## Quick Decision Guide

| Need | Use |
|------|-----|
| Button | `<sp-button>` (built-in) |
| Text input | `<sp-textfield>` (built-in) |
| Checkbox | `<sp-checkbox>` (built-in) |
| Progress bar | `<sp-progressbar>` (built-in) |
| Tabs | **Custom div tab bar** (sp-tabs unavailable) |
| Toast notification | **Custom div** or SWC `@swc-uxp-wrappers/toast` |
| Status indicator | **Custom colored span** (no sp-status-light) |
| Dropdown/Select | `<sp-picker>` with `<sp-menu>` child |
| Help text | **Custom inline div** with error styling |
| Dialog/Modal | `<dialog>` + `uxpShowModal()` |
| Icons beyond 36 | Inline SVG |
| Charts/Viz | SVG or div-based (no canvas) |
| Slider | `<sp-slider>` (built-in) or `<input type="range">` |
