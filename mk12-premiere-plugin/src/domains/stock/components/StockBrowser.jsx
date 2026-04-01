import { h } from 'preact';
import { useState } from 'preact/hooks';
import { results, query, provider, stockError, isSearching, resultCount } from '../signals.js';

const THUMB_GRADIENTS = [
  'linear-gradient(135deg, #2a4a6b, #1a3a5c)',
  'linear-gradient(135deg, #4a2a6b, #3a1a5c)',
  'linear-gradient(135deg, #2a6b4a, #1a5c3a)',
  'linear-gradient(135deg, #6b4a2a, #5c3a1a)',
  'linear-gradient(135deg, #6b2a4a, #5c1a3a)',
  'linear-gradient(135deg, #2a6b6b, #1a5c5c)',
];

const THUMB_ICONS = ['\uD83C\uDFA5', '\uD83C\uDF05', '\uD83C\uDFAC', '\uD83D\uDCF7', '\uD83C\uDF1F', '\uD83D\uDD2E'];

export function StockBrowser({ bus }) {
  const [selectedId, setSelectedId] = useState(null);
  const [localQuery, setLocalQuery] = useState('');

  const handleSearch = () => {
    const q = localQuery.trim();
    if (!q) return;
    query.value = q;
    bus.emit('stock:search', { query: q, provider: provider.value });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleCardClick = (item) => {
    setSelectedId(item.id);
    bus.emit('stock:selected', { item });
  };

  const handleProvider = (p) => {
    provider.value = p;
  };

  const items = results.value;
  const searching = isSearching.value;
  const error = stockError.value;
  const count = resultCount.value;

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
      // Search bar
      h('div', {
        style: `
          display: flex;
          gap: 6px;
          padding: 8px 10px;
        `
      },
        h('input', {
          type: 'text',
          value: localQuery,
          onInput: (e) => setLocalQuery(e.target.value),
          onKeyDown: handleKeyDown,
          placeholder: 'Search stock footage...',
          style: `
            flex: 1;
            font-size: 11px;
            padding: 5px 8px;
            background: #2a2a2a;
            color: #e0e0e0;
            border: 1px solid #444;
            border-radius: 4px;
            outline: none;
          `
        }),
        h('button', {
          onClick: handleSearch,
          style: `
            font-size: 10px;
            font-weight: 600;
            padding: 4px 10px;
            background: #4dabf7;
            color: #fff;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            white-space: nowrap;
          `
        }, 'Search')
      ),

      // Provider toggle pills
      h('div', {
        style: `
          display: flex;
          gap: 4px;
          padding: 0 10px 8px;
        `
      },
        ['pexels', 'pixabay'].map((p) =>
          h('button', {
            key: p,
            onClick: () => handleProvider(p),
            style: `
              font-size: 9px;
              font-weight: 600;
              padding: 3px 10px;
              background: ${provider.value === p ? '#4dabf7' : '#2a2a2a'};
              color: ${provider.value === p ? '#fff' : '#999'};
              border: 1px solid ${provider.value === p ? '#4dabf7' : '#444'};
              border-radius: 10px;
              cursor: pointer;
              text-transform: capitalize;
            `
          }, p.charAt(0).toUpperCase() + p.slice(1))
        )
      ),

      // Error
      error && h('div', {
        style: `
          font-size: 10px;
          color: #ff4444;
          padding: 4px 10px;
          background: rgba(255, 68, 68, 0.1);
          margin: 0 10px 6px;
          border-radius: 4px;
        `
      }, error),

      // Content area
      h('div', {
        style: `
          flex: 1;
          overflow-y: auto;
          padding: 0 10px 10px;
        `
      },
        // Loading
        searching && h('div', {
          style: `
            font-size: 11px;
            color: #999;
            text-align: center;
            padding: 30px 0;
          `
        }, 'Searching...'),

        // Empty
        !searching && count === 0 && query.value && h('div', {
          style: `
            font-size: 11px;
            color: #666;
            text-align: center;
            padding: 30px 0;
          `
        }, 'No results'),

        // Grid
        !searching && count > 0 && h('div', {
          style: `
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 6px;
          `
        },
          items.map((item, i) => {
            const isSelected = selectedId === item.id;
            const gradient = THUMB_GRADIENTS[i % THUMB_GRADIENTS.length];
            const icon = THUMB_ICONS[i % THUMB_ICONS.length];

            return h('div', {
              key: item.id || i,
              onClick: () => handleCardClick(item),
              style: `
                background: #2a2a2a;
                border: 1px solid ${isSelected ? '#4dabf7' : 'transparent'};
                border-radius: 4px;
                cursor: pointer;
                overflow: hidden;
                ${isSelected ? 'box-shadow: 0 0 8px rgba(77, 171, 247, 0.3);' : ''}
              `
            },
              // Thumbnail
              h('div', {
                style: `
                  height: 70px;
                  background: ${gradient};
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 24px;
                  opacity: 0.3;
                `
              }, icon),

              // Info
              h('div', {
                style: `padding: 4px 6px;`
              },
                h('div', {
                  style: `
                    font-size: 9px;
                    font-weight: 500;
                    color: #e0e0e0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                  `
                }, item.title || 'Untitled'),
                h('div', {
                  style: `
                    font-size: 8px;
                    color: #666;
                    margin-top: 2px;
                    display: flex;
                    gap: 6px;
                  `
                },
                  item.duration && h('span', null, item.duration),
                  h('span', null, item.source || provider.value)
                )
              )
            );
          })
        )
      )
    )
  );
}
