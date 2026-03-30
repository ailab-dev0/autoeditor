/**
 * KnowledgeGraph — concept list with detail panel.
 * UXP: inline styles for dark theme.
 */
import { h } from 'preact';
import { useEffect } from 'preact/hooks';
import { graphData, selectedConcept, knowledgeError } from '../signals';

export function KnowledgeGraph({ bus, projectId }) {
  useEffect(() => {
    if (projectId) bus.emit('knowledge:fetch', { projectId });
  }, [projectId, bus]);

  const data = graphData.value;
  const selected = selectedConcept.value;
  const error = knowledgeError.value;

  const nodes = data?.nodes || data?.concepts || [];
  const edges = data?.edges || data?.relationships || [];
  const selectedNode = selected ? nodes.find(n => (n.id || n.name) === selected) : null;

  const connectionCount = {};
  for (const edge of edges) {
    connectionCount[edge.source] = (connectionCount[edge.source] || 0) + 1;
    connectionCount[edge.target] = (connectionCount[edge.target] || 0) + 1;
  }

  return (
    <div style="display:flex;flex-direction:column;height:100%;padding:10px;gap:10px">
      {error && <div style="color:#ff4444;font-size:12px">{error}</div>}

      {!data && !error && (
        <div style="color:#666;font-size:12px;text-align:center;padding:16px">
          {projectId ? 'Loading knowledge graph...' : 'No project selected'}
        </div>
      )}

      {nodes.length === 0 && data && (
        <div style="color:#666;font-size:12px;text-align:center;padding:16px">No concepts found</div>
      )}

      <div style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:6px">
        {nodes.map(node => {
          const nodeId = node.id || node.name;
          const isSelected = selected === nodeId;
          const connections = connectionCount[nodeId] || node.connections || 0;

          return (
            <div
              key={nodeId}
              onClick={() => { selectedConcept.value = isSelected ? null : nodeId; }}
              style={`padding:10px;border:1px solid ${isSelected ? '#4dabf7' : '#333'};border-radius:4px;cursor:pointer;background:${isSelected ? '#1a3a5c' : '#2a2a2a'}`}
            >
              <div style="display:flex;flex-direction:row;align-items:center;gap:8px">
                <span style={`font-size:12px;font-weight:600;color:${isSelected ? '#4dabf7' : '#e0e0e0'}`}>
                  {node.name || node.label || nodeId}
                </span>
                {connections > 0 && (
                  <span style="background:#333;color:#999;font-size:10px;padding:1px 6px;border-radius:8px">
                    {connections}
                  </span>
                )}
              </div>
              {node.description && (
                <div style={`font-size:11px;color:#999;margin-top:4px;${isSelected ? '' : 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap'}`}>
                  {node.description}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedNode && (
        <div style="padding:10px;border-top:1px solid #333">
          <div style="font-size:13px;font-weight:600;color:#e0e0e0;margin-bottom:6px">
            {selectedNode.name || selectedNode.label}
          </div>
          <div style="font-size:12px;color:#ccc;line-height:1.5">
            {selectedNode.description || selectedNode.summary || 'No description available.'}
          </div>
          {selectedNode.type && (
            <div style="font-size:11px;color:#666;margin-top:4px">Type: {selectedNode.type}</div>
          )}
        </div>
      )}
    </div>
  );
}
