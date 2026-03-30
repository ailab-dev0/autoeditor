import { h } from 'preact';
import { graphData, selectedConcept, knowledgeError } from '../signals';

export function KnowledgeGraph({ bus }) {
  const data = graphData.value;

  if (!data) {
    return (
      <div class="flex-col gap-md p-md">
        <p class="text-muted">No knowledge graph loaded.</p>
        {knowledgeError.value && (
          <sp-help-text variant="negative">{knowledgeError.value}</sp-help-text>
        )}
      </div>
    );
  }

  const nodes = data.nodes || [];
  const edges = data.edges || [];
  const selected = selectedConcept.value;
  const selectedNode = selected ? nodes.find(n => n.id === selected) : null;

  // Count connections per node
  const connectionCount = {};
  for (const edge of edges) {
    connectionCount[edge.source] = (connectionCount[edge.source] || 0) + 1;
    connectionCount[edge.target] = (connectionCount[edge.target] || 0) + 1;
  }

  return (
    <div class="flex-col gap-md p-md">
      <div class="flex-row gap-md" style="flex:1;min-height:0">
        <div style="flex:1;overflow-y:auto">
          {nodes.map(node => (
            <div
              key={node.id}
              class={`flex-row gap-sm p-sm ${selected === node.id ? 'bordered' : ''}`}
              style={`cursor:pointer;border-radius:4px;${selected === node.id ? 'background:var(--spectrum-global-color-gray-200,#333)' : ''}`}
              onClick={() => { selectedConcept.value = node.id; }}
            >
              <span style="flex:1">{node.label || node.id}</span>
              <span class="text-muted" style="font-size:11px">
                {connectionCount[node.id] || 0} links
              </span>
            </div>
          ))}
        </div>

        {selectedNode && (
          <div class="flex-col gap-sm bordered p-md" style="flex:1;border-radius:4px;overflow-y:auto">
            <h4 style="margin:0">{selectedNode.label || selectedNode.id}</h4>
            {selectedNode.description && (
              <p style="margin:0;font-size:12px">{selectedNode.description}</p>
            )}
            {selectedNode.type && (
              <span class="text-muted" style="font-size:11px">Type: {selectedNode.type}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
