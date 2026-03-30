import { h } from 'preact';
import { exportFormat, exportProgress, exportError, exportOutput, isExporting } from '../signals';

const FORMATS = [
  { id: 'edit_package', label: 'Edit Package' },
  { id: 'premiere', label: 'Premiere' },
  { id: 'resolve', label: 'DaVinci Resolve' },
  { id: 'fcp', label: 'Final Cut Pro' },
  { id: 'srt', label: 'SRT' },
  { id: 'json', label: 'JSON' },
  { id: 'csv', label: 'CSV' },
];

export function ExportPanel({ bus, projectId }) {
  const onExport = (format) => {
    exportFormat.value = format;
    bus.emit('export:start', { projectId, format });
  };

  return (
    <div class="flex-col gap-md p-md">
      <h3 style="margin:0">Export</h3>

      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px">
        {FORMATS.map(f => (
          <sp-button
            key={f.id}
            variant={exportFormat.value === f.id ? 'cta' : 'secondary'}
            disabled={isExporting.value ? '' : undefined}
            onClick={() => onExport(f.id)}
          >
            {f.label}
          </sp-button>
        ))}
      </div>

      {isExporting.value && exportProgress.value && (
        <div class="flex-col gap-sm">
          <sp-progress-bar
            value={exportProgress.value.percent}
            label={exportProgress.value.label}
          />
          <span class="text-muted" style="font-size:11px">{exportProgress.value.label}</span>
        </div>
      )}

      {exportError.value && (
        <sp-help-text variant="negative">{exportError.value}</sp-help-text>
      )}

      {exportOutput.value && (
        <div class="flex-col gap-sm bordered p-sm" style="border-radius:4px">
          <span style="font-size:12px">Export complete</span>
          <span class="text-muted" style="font-size:11px;word-break:break-all">{exportOutput.value}</span>
        </div>
      )}
    </div>
  );
}
