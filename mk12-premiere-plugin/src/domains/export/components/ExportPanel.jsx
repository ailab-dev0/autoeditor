/**
 * ExportPanel — 7 format cards, export button, progress/download.
 * UXP: sp-button, sp-progress-bar. Inline styles for dark theme.
 */
import { h } from 'preact';
import { exportFormat, exportProgress, exportError, exportOutput, isExporting } from '../signals';

const FORMATS = [
  { id: 'edit_package', label: 'Edit Package', desc: 'Full v3 analysis data' },
  { id: 'premiere', label: 'Premiere', desc: 'Premiere Pro project XML' },
  { id: 'resolve', label: 'DaVinci Resolve', desc: 'Resolve timeline XML' },
  { id: 'fcp', label: 'FCP', desc: 'Final Cut Pro FCPXML' },
  { id: 'srt', label: 'SRT', desc: 'Subtitle file' },
  { id: 'json', label: 'JSON', desc: 'Raw JSON export' },
  { id: 'csv', label: 'CSV', desc: 'Spreadsheet format' },
];

export function ExportPanel({ bus, projectId }) {
  const selected = exportFormat.value;
  const progress = exportProgress.value;
  const error = exportError.value;
  const output = exportOutput.value;
  const exporting = isExporting.value;

  return (
    <div style="display:flex;flex-direction:column;gap:12px;padding:10px;height:100%;overflow:auto">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        {FORMATS.map(fmt => {
          const active = selected === fmt.id;
          return (
            <div
              key={fmt.id}
              onClick={() => { exportFormat.value = fmt.id; }}
              style={`padding:10px;border:1px solid ${active ? '#4dabf7' : '#333'};border-radius:4px;cursor:pointer;background:${active ? '#1a3a5c' : '#2a2a2a'}`}
            >
              <div style={`font-size:12px;font-weight:600;color:${active ? '#4dabf7' : '#e0e0e0'}`}>{fmt.label}</div>
              <div style="font-size:10px;color:#999;margin-top:2px">{fmt.desc}</div>
            </div>
          );
        })}
      </div>

      {exporting && progress && (
        <div style="display:flex;flex-direction:column;gap:4px">
          <sp-progress-bar value={progress.percent} max={100} style="width:100%" />
          <div style="color:#999;font-size:11px;text-align:center">{progress.label}</div>
        </div>
      )}

      {error && <div style="color:#ff4444;font-size:12px">{error}</div>}

      {output && !exporting && (
        <div style="padding:8px;border:1px solid #333;border-radius:4px;background:#2a2a2a">
          <div style="color:#4caf50;font-size:12px;margin-bottom:4px">Export complete</div>
          <div style="color:#999;font-size:11px;word-break:break-all">{output}</div>
        </div>
      )}

      <sp-button
        variant="accent"
        style="width:100%"
        disabled={exporting ? '' : undefined}
        onClick={() => bus.emit('export:start', { projectId, format: selected })}
      >
        {exporting ? 'Exporting...' : `Export as ${FORMATS.find(f => f.id === selected)?.label || selected}`}
      </sp-button>
    </div>
  );
}
