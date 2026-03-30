# UXP Component Recipes

Complete, copy-ready component patterns for Premiere Pro UXP panels.

## Form Patterns

### Login Form

```jsx
function LoginForm({ bus }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    bus.emit('auth:login', { email, password });
  }

  return (
    <form onSubmit={handleSubmit}
      style="padding:16px;display:flex;flex-direction:column;gap:12px;max-width:320px;margin:0 auto">
      <h2 style="color:#e0e0e0;text-align:center;font-size:18px">App Name</h2>
      <div>
        <label style="display:block;margin-bottom:4px;font-size:12px;color:#999">Email</label>
        <sp-textfield placeholder="you@example.com" type="email"
          value={email} onInput={e => setEmail(e.target.value)} style="width:100%" />
      </div>
      <div>
        <label style="display:block;margin-bottom:4px;font-size:12px;color:#999">Password</label>
        <sp-textfield placeholder="Enter password" type="password"
          value={password} onInput={e => setPassword(e.target.value)} style="width:100%" />
      </div>
      <sp-button variant="accent" type="submit" style="width:100%">Log In</sp-button>
      {error && <div style="color:#ff4444;font-size:12px;text-align:center">{error}</div>}
    </form>
  );
}
```

Key patterns:
- Labels as separate `<label>` elements (not sp-textfield label attribute — unreliable)
- Explicit `style="width:100%"` on sp-textfield (doesn't auto-expand)
- Error as inline div below form

### Search Bar

```jsx
<div style="display:flex;gap:6px">
  <sp-textfield placeholder="Search..." value={query}
    onInput={e => setQuery(e.target.value)}
    onKeyDown={e => { if (e.key === 'Enter') onSearch(); }}
    style="flex:1" />
  <sp-button variant="accent" onClick={onSearch}>Search</sp-button>
</div>
```

## List Patterns

### Scrollable List with Filter + Stats + Actions

```
┌─────────────────────────┐
│ Filter pills (sticky)    │  border-bottom: 1px solid #333
├─────────────────────────┤
│ Stats bar                │  font-size: 11px; color: #999
├─────────────────────────┤
│                          │
│  Scrollable items        │  flex: 1; overflow-y: auto
│                          │
├─────────────────────────┤
│ Action buttons (sticky)  │  border-top: 1px solid #333
└─────────────────────────┘
```

### List Item with Actions

```jsx
<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;
  background:#2a2a2a;border-bottom:1px solid #333;
  border-left:3px solid ${selected ? '#4dabf7' : 'transparent'};cursor:pointer">

  {/* Leading indicator */}
  <span style="width:12px;height:12px;border-radius:50%;background:${color};flex-shrink:0" />

  {/* Content */}
  <div style="flex:1;min-width:0">
    <div style="font-size:12px;font-weight:600;color:#e0e0e0;
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{title}</div>
    <div style="font-size:10px;color:#999">{subtitle}</div>
  </div>

  {/* Trailing actions */}
  <div style="display:flex;gap:4px;flex-shrink:0">
    <sp-button size="s" variant="accent" onClick={onApprove}>Approve</sp-button>
    <sp-button size="s" variant="negative" onClick={onReject}>Reject</sp-button>
  </div>
</div>
```

## Data Visualization (No Canvas)

### Heatmap Strip (proportional colored blocks)

```jsx
<div style="display:flex;height:24px;border-radius:3px;overflow:hidden">
  {segments.map(seg => {
    const widthPct = (seg.duration / totalDuration) * 100;
    return (
      <div key={seg.id} onClick={() => onSelect(seg.id)}
        style={`width:${widthPct}%;background:${colorMap[seg.type]};
          cursor:pointer;border-right:1px solid #1e1e1e;
          ${seg.lowConfidence ? 'border-top:2px dashed #999;' : ''}
          ${seg.selected ? 'box-shadow:inset 0 0 0 2px #4dabf7;' : ''}`} />
    );
  })}
</div>
```

### Progress Steps (stage dots)

```jsx
const stages = ['Transcription', 'Analysis', 'Scoring', 'Packaging', 'Complete'];
const currentIdx = stages.indexOf(currentStage);

<div style="display:flex;gap:8px;align-items:center;justify-content:center">
  {stages.map((s, i) => (
    <div key={s} style="display:flex;flex-direction:column;align-items:center;gap:4px">
      <span style={`width:10px;height:10px;border-radius:50%;
        background:${i < currentIdx ? '#4caf50' : i === currentIdx ? '#2196f3' : '#555'}`} />
      <span style={`font-size:9px;color:${i <= currentIdx ? '#ccc' : '#666'}`}>{s}</span>
    </div>
  ))}
</div>
```

### Confidence Bar (div-based, no SVG)

```jsx
function ConfidenceBar({ value }) {
  const pct = Math.round(value * 100);
  const color = value < 0.5 ? '#E74C3C' : value < 0.85 ? '#F1C40F' : '#27AE60';
  return (
    <div style="display:flex;align-items:center;gap:6px;min-width:80px">
      <div style="flex:1;height:6px;border-radius:3px;background:#333;overflow:hidden">
        <div style={`width:${pct}%;height:100%;border-radius:3px;background:${color}`} />
      </div>
      <span style={`font-size:10px;color:${color};min-width:30px`}>{pct}%</span>
    </div>
  );
}
```

## Navigation Patterns

### Status Bar (fixed footer)

```jsx
<div style="display:flex;align-items:center;justify-content:space-between;
  padding:4px 12px;border-top:1px solid #333;min-height:24px">
  <div style="display:flex;align-items:center;gap:6px">
    <span style={`width:8px;height:8px;border-radius:50%;background:${statusColor}`} />
    <span style="color:#999;font-size:11px">{statusLabel}</span>
  </div>
  {badgeCount > 0 && (
    <span style="background:#f44336;color:#fff;font-size:10px;
      padding:1px 6px;border-radius:8px">{badgeCount}</span>
  )}
</div>
```

### Connecting / Loading Screen

```jsx
<div style="padding:16px;display:flex;flex-direction:column;gap:16px;
  align-items:center;justify-content:center;min-height:200px">
  <div style="color:#e0e0e0;font-size:14px">Connecting...</div>
  <sp-progress-bar indeterminate style="width:100%;max-width:280px" />
  <div style="color:#999;font-size:12px">{serverUrl}</div>
  <sp-button variant="secondary" onClick={onCancel}>Cancel</sp-button>
</div>
```

## Spacing Constants

Use these consistently across all components:

| Token | Value | Use |
|-------|-------|-----|
| spacing-xs | 4px | Between inline elements |
| spacing-sm | 6-8px | Between related items in a group |
| spacing-md | 10-12px | Component internal padding |
| spacing-lg | 16px | Section padding, page margins |
| spacing-xl | 24px | Major section separation |
| border-radius-sm | 3px | Badges, pills |
| border-radius-md | 4px | Cards, inputs |
| border-radius-full | 50% | Circles, dots |
