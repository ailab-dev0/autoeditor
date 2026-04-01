# UXP CSS Support Reference

## Fully Supported Properties

### Layout
- display: none | flex | block | inline | inline-block | inline-flex
- flex-direction, flex-wrap (NO wrap-reverse), flex-basis, flex-grow, flex-shrink
- justify-content: flex-start | flex-end | center | space-between | space-around
- align-items: flex-start | flex-end | center | stretch (NO baseline)
- align-self, align-content, order

### Positioning
- position: static | absolute | relative (NO fixed — behavior unreliable)
- top, left, right, bottom

### Box Model
- width, height, min-width, min-height, max-width, max-height
- margin (all sides), padding (all sides)
- border (all sides) — ONLY solid style renders
- border-radius (all corners) — requires overflow:hidden for clipping
- border-color (single color only)

### Overflow
- overflow, overflow-x, overflow-y: visible | hidden | auto | scroll

### Typography
- font-family (no fallback support, no quotes around names)
- font-size, font-weight (100-900), font-style: normal | italic
- letter-spacing
- text-align: left | center | right (NO justify)
- text-overflow: clip | ellipsis
- white-space: normal | nowrap

### Visual
- opacity: 0-1
- visibility: visible | hidden
- background-color, background-image, background-size: auto | contain | cover
- color

### Units
- px (default), %
- calc() — only for length properties

## NOT Supported

### Layout
- display: grid — MAJOR GAP, no CSS Grid at all
- float — use flexbox

### Positioning
- position: fixed — behavior unreliable, will change in future

### Typography
- font (shorthand) — must use individual properties
- text-transform — none, uppercase, lowercase all broken

### Visual
- CSS transitions — no transition property
- CSS animations — no @keyframes, no animation property
- CSS transforms — no transform property
- :active pseudo-class

### Other
- baseline alignment in flexbox
- Multiple border colors on same container
- border-style other than solid (dotted, dashed don't render)
- vh/vw units for font sizes
- background-attachment: fixed | local
- background-repeat: repeat | repeat-x | repeat-y
- flex-wrap: wrap-reverse

## Rendering Bugs

1. **Border-radius clipping** requires overflow:hidden on the element
2. **Bottom border** may render with different width than other sides
3. **Descender clipping**: g, p, y clip with overflow:hidden on non-HiDPI — add padding-bottom
4. **Inline text wrapping**: borders/outlines/backgrounds only apply to first line
5. **Spaces between inline elements** may be ignored in host version 21+
6. **Solid outline** won't render without explicit color
7. **border-color: unset** may not reset to initial value
8. **Underlines** may render very thin
9. **Borders with object-fit** render incorrectly
10. **<label>** uses inline-flex with flex-wrap:wrap by default — set flex-wrap:nowrap explicitly

## Event System Limitations
- Pointer events not supported on interactive elements
- keypress / keyup unsupported on macOS (use keydown)
- Mouse clientX/Y and offsetX/Y return incorrect values
- Drag and drop: drag and dragexit not supported; no external file drops
- innerHTML: event handlers and script tags not parsed

## Platform Constraints Summary
- No Node.js (no require("fs"), require("path"))
- No CSS Grid
- No CSS transitions/animations
- No canvas
- No iframe/webview
- No Blob (use ArrayBuffer)
- Single V8 engine: UI and host API in same JS context
- All animation must use requestAnimationFrame or setInterval
