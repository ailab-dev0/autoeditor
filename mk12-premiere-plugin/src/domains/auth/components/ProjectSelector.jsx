/**
 * ProjectSelector — project list for READY state.
 * UXP Spectrum: sp-button, no sp-help-text.
 */
import { h } from 'preact';
import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';

const projects = signal([]);
const loading = signal(false);
const error = signal(null);

export function ProjectSelector({ bus }) {
  useEffect(() => {
    loading.value = true;
    error.value = null;

    const onFetched = (data) => {
      projects.value = data?.projects || data || [];
      loading.value = false;
    };

    bus.on('projects:fetched', onFetched);
    bus.emit('projects:fetch', {});

    return () => {
      bus.off('projects:fetched', onFetched);
    };
  }, [bus]);

  if (loading.value) {
    return (
      <div style="padding:16px;display:flex;flex-direction:column;gap:12px;align-items:center">
        <sp-progress-bar indeterminate style="width:100%;max-width:280px" />
        <div style="color:#999;font-size:12px">Loading projects...</div>
      </div>
    );
  }

  if (error.value) {
    return (
      <div style="padding:16px">
        <div style="color:#ff4444;font-size:12px">{error.value}</div>
      </div>
    );
  }

  const list = projects.value;

  return (
    <div style="padding:16px;display:flex;flex-direction:column;gap:12px">
      <h3 style="color:#e0e0e0;margin:0;font-size:14px">Select Project</h3>

      {list.length === 0 && (
        <div style="color:#999;font-size:12px">No projects found</div>
      )}

      {list.map(proj => (
        <div
          key={proj.id}
          onClick={() => bus.emit('project:selected', { projectId: proj.id, projectName: proj.name })}
          onMouseOver={e => { e.currentTarget.style.borderColor = '#555'; }}
          onMouseOut={e => { e.currentTarget.style.borderColor = '#333'; }}
          style="padding:12px;border:1px solid #333;border-radius:4px;cursor:pointer"
        >
          <div style="color:#e0e0e0;font-weight:600;font-size:13px">{proj.name || proj.id}</div>
          {proj.created_at && (
            <div style="color:#999;font-size:11px;margin-top:4px">
              {new Date(proj.created_at).toLocaleDateString()}
            </div>
          )}
        </div>
      ))}

      <sp-divider style="margin:4px 0" />

      <sp-button variant="accent" style="width:100%" onClick={() => bus.emit('project:new', {})}>
        New Project
      </sp-button>

      <sp-button
        variant="secondary"
        style="width:100%"
        onClick={() => bus.emit('auth:logout', {})}
      >
        Log Out
      </sp-button>
    </div>
  );
}
