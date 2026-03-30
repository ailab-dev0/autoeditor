import { results, query, provider, stockError, isSearching } from './signals';

export function setupStockAdapter(bus, transport) {
  bus.on('stock:search', async ({ query: q, provider: p }) => {
    query.value = q || '';
    if (p) provider.value = p;
    isSearching.value = true;
    stockError.value = null;

    const result = await transport.get(
      `/api/stock/search?q=${encodeURIComponent(q)}&provider=${p || provider.value}`
    );

    isSearching.value = false;

    if (result.ok) {
      results.value = Array.isArray(result.data) ? result.data : (result.data?.results || []);
      bus.emit('stock:results', { count: results.value.length });
      transport.broadcastSync('stock:results', { count: results.value.length });
    } else {
      stockError.value = result.error;
      bus.emit('stock:error', { error: result.error });
    }
  });
}
