import { h } from 'preact';

const WIDTH = 48;
const HEIGHT = 8;

function getColor(confidence) {
  if (confidence < 0.5) return '#E74C3C';
  if (confidence < 0.85) return '#F1C40F';
  return '#27AE60';
}

export function ConfidenceRibbon({ confidence }) {
  const pct = Math.round(confidence * 100);
  const fillWidth = (confidence * WIDTH);
  const color = getColor(confidence);

  return (
    <span class="flex-row gap-sm" style="align-items:center" title={`${pct}% confidence`}>
      <svg width={WIDTH} height={HEIGHT} role="img" aria-label={`${pct}% confidence`}>
        <rect x="0" y="0" width={WIDTH} height={HEIGHT} rx="2" fill="#333" />
        <rect x="0" y="0" width={fillWidth} height={HEIGHT} rx="2" fill={color} />
      </svg>
      <span style="font-size:10px;min-width:28px">{pct}%</span>
    </span>
  );
}
