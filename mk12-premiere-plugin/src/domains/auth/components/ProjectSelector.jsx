import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { NewProjectForm } from './NewProjectForm.jsx';

const STATUS_COLORS = {
  active: '#4caf50',
  draft: '#ff9800',
  archived: '#999',
  processing: '#2196f3',
  error: '#ff4444',
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch (_) {
    return '';
  }
}

export function ProjectSelector({ bus, transport }) {
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    transport.get('/api/projects').then((res) => {
      if (res.ok) {
        const list = res.data.projects || res.data || [];
        setProjects(Array.isArray(list) ? list : []);
      }
      setLoading(false);
    });
  }, []);

  const handleSelect = (p) => {
    setSelected(p.id);
    bus.emit('project:selected', { projectId: p.id, projectName: p.name });
  };

  return (
    h('div', {
      style: `
        display: flex;
        flex-direction: column;
        height: 100%;
        background: #1e1e1e;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `
    },
      // Header
      h('div', {
        style: `
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px 6px;
        `
      },
        h('div', {
          style: `
            font-size: 13px;
            font-weight: 600;
            color: #e0e0e0;
          `
        }, 'Projects'),

        h('button', {
          onClick: () => setShowNew(!showNew),
          style: `
            font-size: 11px;
            font-weight: 600;
            padding: 3px 10px;
            background: ${showNew ? 'transparent' : '#4dabf7'};
            color: ${showNew ? '#999' : '#fff'};
            border: ${showNew ? '1px solid #444' : 'none'};
            border-radius: 4px;
            cursor: pointer;
          `
        }, showNew ? 'Cancel' : '+ New')
      ),

      // New project form (inline)
      showNew && h(NewProjectForm, {
        bus,
        transport,
        onCancel: () => setShowNew(false),
      }),

      // Project list
      h('div', {
        style: `
          flex: 1;
          overflow-y: auto;
          padding: 4px 8px;
        `
      },
        loading && h('div', {
          style: `
            font-size: 11px;
            color: #999;
            text-align: center;
            padding: 20px;
          `
        }, 'Loading...'),

        !loading && projects.length === 0 && h('div', {
          style: `
            font-size: 11px;
            color: #666;
            text-align: center;
            padding: 20px;
          `
        }, 'No projects yet'),

        !loading && projects.map((p) => {
          const isSelected = selected === p.id;
          const status = p.status || 'draft';
          const statusColor = STATUS_COLORS[status] || '#999';

          return h('div', {
            key: p.id,
            onClick: () => handleSelect(p),
            style: `
              padding: 8px 10px;
              margin-bottom: 4px;
              background: ${isSelected ? '#1a3a5c' : '#2a2a2a'};
              border: 1px solid ${isSelected ? '#4dabf7' : 'transparent'};
              border-radius: 4px;
              cursor: pointer;
            `
          },
            // First line: name + status badge
            h('div', {
              style: `
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 6px;
              `
            },
              h('div', {
                style: `
                  font-size: 12px;
                  font-weight: 600;
                  color: #e0e0e0;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                  flex: 1;
                `
              }, p.name),

              h('span', {
                style: `
                  font-size: 9px;
                  padding: 1px 6px;
                  border-radius: 3px;
                  background: ${statusColor}26;
                  color: ${statusColor};
                  white-space: nowrap;
                  text-transform: capitalize;
                `
              }, status)
            ),

            // Second line: meta
            h('div', {
              style: `
                font-size: 9px;
                color: #999;
                margin-top: 3px;
                display: flex;
                gap: 8px;
              `
            },
              p.created_at && h('span', null, formatDate(p.created_at)),
              p.video_count != null && h('span', null, `${p.video_count} video${p.video_count !== 1 ? 's' : ''}`),
              p.segment_count != null && h('span', null, `${p.segment_count} seg`)
            )
          );
        })
      ),

      // Footer: Log Out
      h('div', {
        style: `
          padding: 8px;
          border-top: 1px solid #333;
        `
      },
        h('button', {
          onClick: () => bus.emit('auth:logout', {}),
          style: `
            width: 100%;
            font-size: 11px;
            font-weight: 500;
            padding: 5px 10px;
            background: transparent;
            color: #999;
            border: 1px solid #444;
            border-radius: 4px;
            cursor: pointer;
          `
        }, 'Log Out')
      )
    )
  );
}
