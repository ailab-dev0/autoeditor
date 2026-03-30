import { h } from 'preact';
import { useState } from 'preact/hooks';
import { results, query, provider, stockError, isSearching } from '../signals';
import { approvals } from '../../segments/signals';

export function StockBrowser({ bus }) {
  const [searchInput, setSearchInput] = useState('');

  const onSearch = () => {
    if (!searchInput.trim()) return;
    bus.emit('stock:search', { query: searchInput, provider: provider.value });
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') onSearch();
  };

  return (
    <div class="flex-col gap-md p-md">
      <div class="flex-row gap-sm">
        <sp-textfield
          placeholder="Search stock footage..."
          value={searchInput}
          onInput={(e) => setSearchInput(e.target.value)}
          onKeyDown={onKeyDown}
          style="flex:1"
        />
        <sp-button variant="cta" onClick={onSearch}>Search</sp-button>
      </div>

      <sp-action-group compact>
        <sp-action-button
          selected={provider.value === 'pexels' ? '' : undefined}
          onClick={() => { provider.value = 'pexels'; }}
        >
          Pexels
        </sp-action-button>
        <sp-action-button
          selected={provider.value === 'pixabay' ? '' : undefined}
          onClick={() => { provider.value = 'pixabay'; }}
        >
          Pixabay
        </sp-action-button>
      </sp-action-group>

      {isSearching.value && <sp-progress-bar indeterminate label="Searching..." />}

      {stockError.value && (
        <sp-help-text variant="negative">{stockError.value}</sp-help-text>
      )}

      <div class="stock-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">
        {results.value.map((item) => (
          <div
            key={item.id}
            class="stock-card bordered p-sm"
            style="cursor:pointer;border-radius:4px;overflow:hidden"
            onClick={() => bus.emit('stock:results', { selected: item })}
          >
            {item.thumbnail && (
              <img
                src={item.thumbnail}
                alt={item.title || ''}
                style="width:100%;height:80px;object-fit:cover;border-radius:2px"
              />
            )}
            <div class="flex-col gap-sm" style="padding-top:4px">
              <span style="font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                {item.title || 'Untitled'}
              </span>
              <div class="flex-row gap-sm">
                {item.duration && (
                  <span class="text-muted" style="font-size:10px">{item.duration}s</span>
                )}
                <span class="text-muted" style="font-size:10px">{item.source || provider.value}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
