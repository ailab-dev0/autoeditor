/**
 * ConfidenceRibbon — horizontal confidence bar with percentage.
 */
import { h } from 'preact';

function getColor(confidence) {
  if (confidence < 0.5) return '#E74C3C';
  if (confidence < 0.85) return '#F1C40F';
  return '#27AE60';
}

export function ConfidenceRibbon({ confidence }) {
  const pct = Math.round(confidence * 100);
  const color = getColor(confidence);

  return (
    <div style="display:flex;flex-direction:row;align-items:center;gap:6px;min-width:80px">
      <div style="flex:1;height:6px;border-radius:3px;background:#333;overflow:hidden">
        <div style={`width:${pct}%;height:100%;border-radius:3px;background:${color}`} />
      </div>
      <span style={`font-size:10px;color:${color};min-width:30px`}>{pct}%</span>
    </div>
  );
}
