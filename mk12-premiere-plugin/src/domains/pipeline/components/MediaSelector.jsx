import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { getProjectItems } from '../../../shared/premiere.js';

const TYPE_COLORS = { video: '#4caf50', audio: '#2196f3', image: '#9b59b6' };

function formatDuration(sec) {
  if (!sec || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function MediaSelector({ bus, transport, projectId }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await getProjectItems();
      if (res.ok && res.data) {
        const media = res.data.filter(
          (it) => it.type === 'video' || it.type === 'audio' || it.type === 'image'
        );
        setItems(media);
        // Auto-select videos
        const videoIdxs = new Set();
        media.forEach((it, i) => { if (it.type === 'video') videoIdxs.add(i); });
        setSelected(videoIdxs);
      }
      setLoading(false);
    })();
  }, []);

  const selectAll = () => {
    const all = new Set();
    items.forEach((_, i) => all.add(i));
    setSelected(all);
  };

  const selectNone = () => setSelected(new Set());

  const toggle = (idx) => {
    const next = new Set(selected);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setSelected(next);
  };

  const videoCount = [...selected].filter((i) => items[i]?.type === 'video').length;

  const handleAnalyze = async () => {
    if (selected.size === 0) return;
    setUploading(true);
    try {
      for (const idx of selected) {
        const item = items[idx];
        await transport.post(`/api/projects/${projectId}/upload`, {
          filename: item.name,
          filepath: item.path,
          type: item.type,
          duration: item.duration,
        });
      }
      bus.emit('pipeline:start', { projectId });
    } catch (err) {
      console.warn('[MediaSelector] upload error', err);
    }
    setUploading(false);
  };

  const handleBack = () => bus.emit('pipeline:cancelled', {});

  return (
    h('div', {
      style: `
        display: flex;
        flex-direction: column;
        height: 100%;
        background: #1e1e1e;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #e0e0e0;
      `
    },
      // Header
      h('div', {
        style: `
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 10px 6px;
          border-bottom: 1px solid #333;
        `
      },
        h('span', {
          style: `font-size: 13px; font-weight: 600;`
        }, 'Select Media'),
        h('div', { style: `display: flex; gap: 8px;` },
          h('span', {
            style: `font-size: 10px; color: #4dabf7; cursor: pointer;`,
            onClick: selectAll,
          }, 'All'),
          h('span', {
            style: `font-size: 10px; color: #999; cursor: pointer;`,
            onClick: selectNone,
          }, 'None')
        )
      ),

      // List
      h('div', {
        ref: listRef,
        style: `
          flex: 1;
          overflow-y: auto;
          padding: 4px 6px;
        `
      },
        loading
          ? h('div', {
              style: `text-align: center; padding: 20px; font-size: 11px; color: #999;`
            }, 'Loading project items...')
          : items.length === 0
            ? h('div', {
                style: `text-align: center; padding: 20px; font-size: 11px; color: #999;`
              }, 'No media found in project')
            : items.map((item, idx) => {
                const isSelected = selected.has(idx);
                const typeColor = TYPE_COLORS[item.type] || '#999';
                return h('div', {
                  key: idx,
                  onClick: () => toggle(idx),
                  style: `
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 5px 6px;
                    margin-bottom: 2px;
                    border-radius: 4px;
                    cursor: pointer;
                    border: 1px solid ${isSelected ? '#4dabf7' : 'transparent'};
                    background: ${isSelected ? 'rgba(77, 171, 247, 0.05)' : 'transparent'};
                  `
                },
                  // Checkbox
                  h('div', {
                    style: `
                      width: 14px;
                      height: 14px;
                      border-radius: 3px;
                      border: 1.5px solid ${isSelected ? '#4dabf7' : '#555'};
                      background: ${isSelected ? '#4dabf7' : 'transparent'};
                      flex-shrink: 0;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-size: 9px;
                      color: #fff;
                    `
                  }, isSelected ? '\u2713' : ''),

                  // Filename
                  h('span', {
                    style: `
                      flex: 1;
                      font-size: 11px;
                      font-weight: 500;
                      overflow: hidden;
                      text-overflow: ellipsis;
                      white-space: nowrap;
                    `
                  }, item.name),

                  // Duration
                  h('span', {
                    style: `font-size: 9px; color: #999; flex-shrink: 0;`
                  }, formatDuration(item.duration)),

                  // Type badge
                  h('span', {
                    style: `
                      font-size: 9px;
                      font-weight: 600;
                      padding: 1px 5px;
                      border-radius: 3px;
                      background: ${typeColor}1f;
                      color: ${typeColor};
                      flex-shrink: 0;
                      text-transform: uppercase;
                    `
                  }, item.type)
                );
              })
      ),

      // Footer
      h('div', {
        style: `
          display: flex;
          gap: 8px;
          padding: 8px 10px;
          border-top: 1px solid #333;
        `
      },
        h('button', {
          onClick: handleBack,
          style: `
            flex: 1;
            font-size: 11px;
            padding: 6px 0;
            background: transparent;
            color: #999;
            border: 1px solid #555;
            border-radius: 4px;
            cursor: pointer;
          `
        }, 'Back'),
        h('button', {
          onClick: handleAnalyze,
          disabled: selected.size === 0 || uploading,
          style: `
            flex: 2;
            font-size: 11px;
            font-weight: 600;
            padding: 6px 0;
            background: ${selected.size === 0 || uploading ? '#333' : '#4dabf7'};
            color: #fff;
            border: none;
            border-radius: 4px;
            cursor: ${selected.size === 0 || uploading ? 'default' : 'pointer'};
            opacity: ${selected.size === 0 || uploading ? '0.5' : '1'};
          `
        }, uploading ? 'Uploading...' : `Analyze ${videoCount} Video${videoCount !== 1 ? 's' : ''}`)
      )
    )
  );
}
