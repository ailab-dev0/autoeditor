/**
 * StockBrowser — stock footage search with provider toggle and result grid.
 * UXP: sp-textfield, sp-button. Inline styles for dark theme.
 */
import { h } from 'preact';
import { useState } from 'preact/hooks';
import { results, provider, stockError, isSearching } from '../signals';

const PLACEHOLDER_COLORS = ['#2c3e50', '#34495e', '#1a252f', '#2d3436', '#2c2c54'];

export function StockBrowser({ bus }) {
  const [searchInput, setSearchInput] = useState('');

  const onSearch = () => {
    if (!searchInput.trim()) return;
    bus.emit('stock:search', { query: searchInput, provider: provider.value });
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') onSearch();
  };

  const items = results.value;

  return (
    <div style="display:flex;flex-direction:column;gap:10px;padding:10px;height:100%;overflow:hidden">
      <div style="display:flex;flex-direction:row;gap:6px">
        <sp-textfield
          placeholder="Search stock footage..."
          value={searchInput}
          onInput={(e) => setSearchInput(e.target.value)}
          onKeyDown={onKeyDown}
          style="flex:1"
        />
        <sp-button variant="accent" onClick={onSearch}>Search</sp-button>
      </div>

      <div style="display:flex;flex-direction:row;gap:4px">
        {['pexels', 'pixabay'].map(p => {
          const active = provider.value === p;
          return (
            <div
              key={p}
              onClick={() => { provider.value = p; }}
              style={`padding:4px 12px;border-radius:3px;font-size:11px;cursor:pointer;user-select:none;background:${active ? '#4dabf7' : '#333'};color:${active ? '#fff' : '#999'};text-transform:capitalize`}
            >
              {p}
            </div>
          );
        })}
      </div>

      {isSearching.value && (
        <div style="color:#999;font-size:12px;text-align:center;padding:16px">Searching...</div>
      )}

      {stockError.value && (
        <div style="color:#ff4444;font-size:12px">{stockError.value}</div>
      )}

      {!isSearching.value && items.length === 0 && searchInput && (
        <div style="color:#666;font-size:12px;text-align:center;padding:16px">No results</div>
      )}

      <div style="flex:1;overflow-y:auto;display:grid;grid-template-columns:1fr 1fr;gap:8px;align-content:start">
        {items.map((item, i) => (
          <div
            key={item.id || i}
            onClick={() => bus.emit('stock:selected', { item })}
            style="border:1px solid #333;border-radius:4px;overflow:hidden;cursor:pointer"
          >
            {item.thumbnail ? (
              <img src={item.thumbnail} alt={item.title || ''} style="width:100%;height:80px;object-fit:cover;display:block" />
            ) : (
              <div style={`width:100%;height:80px;background:${PLACEHOLDER_COLORS[i % 5]};display:flex;align-items:center;justify-content:center;color:#999;font-size:10px`}>
                No preview
              </div>
            )}
            <div style="padding:6px;display:flex;flex-direction:column;gap:2px">
              <span style="font-size:11px;color:#e0e0e0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                {item.title || 'Untitled'}
              </span>
              <div style="display:flex;gap:8px">
                {item.duration && <span style="font-size:10px;color:#999">{item.duration}s</span>}
                <span style="font-size:10px;color:#666">{item.provider || provider.value}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
