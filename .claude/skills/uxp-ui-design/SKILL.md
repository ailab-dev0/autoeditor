---
name: uxp-ui-design
description: Use when building, styling, or reviewing UI components for Adobe Premiere Pro UXP plugins — covers supported Spectrum components, dark theme colors, UXP rendering constraints, panel layout, inline style patterns, and accessibility within Premiere's panel environment
metadata:
  tags: uxp, premiere-pro, ui, design, spectrum, dark-theme, panel, components, accessibility, styling
---

# UXP Plugin UI Design for Premiere Pro

Build polished, UXP-compatible UI for Premiere Pro panels. Combines UX best practices with UXP's specific rendering constraints and Premiere's dark theme environment.

## When to Use

- Building or modifying Preact/React components for a UXP Premiere plugin
- Choosing which Spectrum Web Components to use (vs HTML fallbacks)
- Styling components for Premiere's dark theme
- Reviewing plugin UI for UXP compatibility issues
- Fixing "component doesn't render" or "style doesn't apply" in UXP

## When NOT to Use

- General web UI (use `ui-ux-pro-max` instead)
- Premiere API / timeline manipulation (use `uxp-developer` instead)
- Mobile / React Native UI

## Reference Files

Load the relevant reference file for deep details:

| File | Contents |
|------|----------|
| `references/supported-widgets.md` | Complete widget catalog — built-in Spectrum UXP, SWC wrappers, supported/unsupported HTML elements |
| `references/css-support.md` | Full CSS property support matrix — what works, what doesn't, rendering bugs |
| `references/dialogs-panels.md` | Panel types, modal dialogs, multi-panel architecture, theming, context menus |
| `references/component-recipes.md` | Copy-ready component patterns — forms, lists, data viz, navigation, spacing |

## Core Constraint: UXP is Not a Browser

UXP renders in a stripped-down WebView. Many web APIs and Spectrum components are **missing or broken**. Design defensively.

## Supported Spectrum Web Components

These work in Premiere Pro UXP (v25.0+ with `enableSWCSupport: true`):

| Component | Use For | Notes |
|-----------|---------|-------|
| `sp-button` | Primary actions | `variant`: accent, secondary, negative |
| `sp-action-button` | Toolbar/toggle actions | Supports `selected` attribute |
| `sp-textfield` | Text input | `type`: text, email, password, number |
| `sp-progress-bar` | Progress/loading | `indeterminate` for unknown duration |
| `sp-divider` | Visual separator | Horizontal rule replacement |
| `sp-action-group` | Group action buttons | `compact` attribute for tight spacing |

### DO NOT USE — Unsupported or Broken

| Component | Replacement |
|-----------|-------------|
| `sp-tabs` | Styled div tab bar (see Tab Bar Pattern) |
| `sp-toast` | Div-based toast with auto-dismiss timer |
| `sp-help-text` | Inline `<div>` with error/helper styling |
| `sp-status-light` | Colored dot `<span>` (8-12px circle) |
| `sp-slider` | HTML `<input type="range">` with custom styling |
| `sp-menu` / `sp-picker` | Custom dropdown with positioned div |
| `sp-dialog` | Absolutely positioned overlay div |
| `<canvas>` | SVG or CSS-based visuals |

## Premiere Dark Theme Color System

Premiere uses a consistent dark palette. Use these values directly — do not rely on Spectrum CSS custom properties (they may not resolve in UXP).

### Core Palette

```
Background layers:
  --bg-app:        #1e1e1e   (panel background)
  --bg-surface:    #2a2a2a   (card/elevated surface)
  --bg-hover:      #333333   (hover state)
  --bg-active:     #1a3a5c   (selected/active item)

Text:
  --text-primary:  #e0e0e0   (main text — 4.5:1 on #1e1e1e)
  --text-secondary:#999999   (labels, captions — 3.6:1 on #1e1e1e)
  --text-disabled: #666666   (disabled text)

Borders:
  --border-default:#333333   (card borders, dividers)
  --border-subtle: #2a2a2a   (subtle separators)
  --border-hover:  #555555   (hover border)

Accent:
  --accent:        #4dabf7   (selection, active tab, focus)
  --accent-bg:     #1a3a5c   (selected item background)

Status:
  --positive:      #4caf50   (success, connected, approved)
  --negative:      #ff4444   (error, disconnected, rejected)
  --warning:       #ff9800   (warning, connecting, pending)
  --info:          #2196f3   (info, in-progress)
```

### Contrast Verification

| Pair | Ratio | WCAG |
|------|-------|------|
| #e0e0e0 on #1e1e1e | 10.5:1 | AAA |
| #999999 on #1e1e1e | 3.6:1 | AA (large text) |
| #e0e0e0 on #2a2a2a | 8.5:1 | AAA |
| #4dabf7 on #1e1e1e | 6.3:1 | AA |
| #ff4444 on #1e1e1e | 4.6:1 | AA |

## Styling Rules

### Inline Styles Only

UXP's CSS support is limited. Use inline styles for reliability:

```jsx
// ✅ Inline — always works
<div style="padding:12px;background:#2a2a2a;border:1px solid #333;border-radius:4px">

// ❌ Utility classes — may not resolve
<div class="p-md surface bordered rounded">
```

**Exception:** A small utilities.css with basic flex/gap classes is acceptable if bundled via webpack and tested in Premiere.

### No Inline Style Expressions

```jsx
// ✅ Template literal
style={`color:${active ? '#e0e0e0' : '#999'};background:${active ? '#1a3a5c' : '#2a2a2a'}`}

// ❌ Style object (inconsistent in UXP)
style={{ color: active ? '#e0e0e0' : '#999' }}
```

### Font Stack

```
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
```

UXP does not load Google Fonts. Use the system font stack.

## Component Patterns

### Tab Bar (replaces sp-tabs)

```jsx
function TabBar({ tabs, active, onChange }) {
  return (
    <div style="display:flex;border-bottom:1px solid #333;padding:0 8px">
      {tabs.map(t => (
        <div
          key={t.id}
          onClick={() => onChange(t.id)}
          style={`padding:8px 14px;cursor:pointer;font-size:12px;font-weight:500;
            border-bottom:2px solid ${active === t.id ? '#4dabf7' : 'transparent'};
            color:${active === t.id ? '#e0e0e0' : '#999'};user-select:none`}
        >
          {t.label}
        </div>
      ))}
    </div>
  );
}
```

### Status Dot (replaces sp-status-light)

```jsx
<span style={`display:inline-block;width:8px;height:8px;border-radius:50%;
  background:${connected ? '#4caf50' : '#f44336'}`} />
```

### Error Message (replaces sp-help-text)

```jsx
{error && <div style="color:#ff4444;font-size:12px">{error}</div>}
```

### Toast Notification

```jsx
function Toast({ message, onDismiss }) {
  return (
    <div style="position:fixed;bottom:40px;left:12px;right:12px;
      background:#333;color:#e0e0e0;padding:10px 14px;border-radius:4px;
      font-size:12px;display:flex;justify-content:space-between;align-items:center;
      border-left:3px solid #ff4444;z-index:100">
      <span>{message}</span>
      <span onClick={onDismiss} style="cursor:pointer;color:#999;padding:0 4px">✕</span>
    </div>
  );
}
```

### Card / Surface

```jsx
<div style="padding:10px;border:1px solid #333;border-radius:4px;
  background:#2a2a2a;cursor:pointer"
  onMouseOver={e => { e.currentTarget.style.borderColor = '#555'; }}
  onMouseOut={e => { e.currentTarget.style.borderColor = '#333'; }}>
  <div style="font-size:12px;font-weight:600;color:#e0e0e0">Title</div>
  <div style="font-size:10px;color:#999;margin-top:2px">Description</div>
</div>
```

### Selected Card

```jsx
const active = selected === item.id;
<div style={`padding:10px;border:1px solid ${active ? '#4dabf7' : '#333'};
  border-radius:4px;background:${active ? '#1a3a5c' : '#2a2a2a'};cursor:pointer`}>
```

### Filter Pill Bar

```jsx
{filters.map(f => (
  <div
    key={f}
    onClick={() => setFilter(f)}
    style={`padding:4px 10px;border-radius:3px;font-size:11px;cursor:pointer;
      background:${current === f ? '#4dabf7' : '#333'};
      color:${current === f ? '#fff' : '#999'};user-select:none`}
  >
    {f} ({count})
  </div>
))}
```

### Confidence / Progress Bar (div-based)

```jsx
<div style="flex:1;height:6px;border-radius:3px;background:#333;overflow:hidden">
  <div style={`width:${pct}%;height:100%;border-radius:3px;
    background:${pct < 50 ? '#E74C3C' : pct < 85 ? '#F1C40F' : '#27AE60'}`} />
</div>
```

### Loading State

```jsx
<div style="padding:16px;display:flex;flex-direction:column;gap:12px;align-items:center">
  <sp-progress-bar indeterminate style="width:100%;max-width:280px" />
  <div style="color:#999;font-size:12px">Loading...</div>
</div>
```

## Layout Patterns

### Full-Height Panel

```jsx
<div style="display:flex;flex-direction:column;min-height:100vh;
  background:#1e1e1e;color:#e0e0e0;font-family:-apple-system,...;font-size:13px">
  <div style="flex:1;overflow:auto">
    {/* Content */}
  </div>
  <StatusBar />
</div>
```

### Scrollable List with Fixed Header/Footer

```jsx
<div style="display:flex;flex-direction:column;height:100%">
  <div style="padding:8px;border-bottom:1px solid #333">{/* Header */}</div>
  <div style="flex:1;overflow-y:auto">{/* Scrollable content */}</div>
  <div style="padding:8px;border-top:1px solid #333">{/* Footer actions */}</div>
</div>
```

### Two-Column Grid

```jsx
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
```

## Typography Scale

| Use | Size | Weight | Color |
|-----|------|--------|-------|
| Page heading | 14-18px | 600 | #e0e0e0 |
| Section heading | 13-14px | 600 | #e0e0e0 |
| Body text | 12-13px | 400 | #e0e0e0 |
| Labels / captions | 11px | 400-500 | #999 |
| Monospace (timecodes) | 11px | 400 | #666 |
| Badge / count | 10px | 400 | #999 on #333 bg |

## Interaction Guidelines

### Touch Targets

UXP panels can be used with pen tablets. Minimum interactive area: 32px height for buttons/controls. Premiere panels are compact — 44px is ideal but 32px is acceptable for dense UI.

### Hover States

UXP supports hover. Use for:
- Border color change (#333 → #555)
- Background lightening (#2a2a2a → #333)
- Do NOT rely on hover for critical functionality (tablet users)

### Button Variants

| Context | sp-button variant | Alternative |
|---------|-------------------|-------------|
| Primary action | `accent` | N/A |
| Secondary action | `secondary` | N/A |
| Destructive action | `negative` | Red-styled div |
| Active/selected toggle | `accent` | Blue-styled div |
| Disabled | Add `disabled` attribute | opacity: 0.5 |

### Keyboard Navigation

UXP supports Tab focus. Ensure:
- Interactive elements are focusable
- Focus order matches visual order
- sp-button/sp-textfield handle this automatically
- Custom div buttons need `tabindex="0"` and `onKeyDown` for Enter/Space

## Accessibility in UXP

### Minimum Requirements

- Text contrast: 4.5:1 (primary text passes on all dark surfaces)
- Interactive elements: `role="button"` on clickable divs
- Labels: `aria-label` on icon-only buttons
- Progress: `role="progressbar"` with `aria-label` on custom progress indicators
- Images: `aria-label` on decorative icon containers, `role="img"` on visual displays

### Color Not Sole Indicator

Always pair color with text or shape:
- Status: colored dot + text label ("Connected" / "Disconnected")
- Approval: colored badge + text ("Approved" / "Rejected")
- Confidence: colored bar + percentage text

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Using sp-tabs | Build custom div tab bar |
| Using sp-help-text | Inline div with color:#ff4444 |
| Relying on Spectrum CSS vars | Hardcode hex values from dark theme palette |
| Using style objects `{{}}` | Use template literal strings |
| Canvas for charts/viz | Use SVG or div-based visuals |
| Full Spectrum theming | Inline styles + consistent color palette |
| Google Fonts | System font stack |
| Hover-only interactions | Always provide click/tap fallback |
| Missing error states | Every async operation needs loading + error + empty UI |
| No empty state | Show helpful message when list is empty |
| Text smaller than 10px | Minimum 10px, prefer 11-12px for readability |

## Pre-Delivery Checklist

- [ ] No unsupported Spectrum components (sp-tabs, sp-toast, sp-help-text, sp-status-light)
- [ ] All colors from dark theme palette (no bright whites, no light backgrounds)
- [ ] Inline styles or tested utility classes (no unverified CSS)
- [ ] Primary text readable on all surfaces (4.5:1 contrast)
- [ ] Every interactive element provides visual feedback
- [ ] Loading, error, and empty states for all async content
- [ ] No canvas elements
- [ ] Builds successfully with webpack (0 warnings)
- [ ] System font stack (no Google Fonts)
- [ ] Status indicators pair color with text
