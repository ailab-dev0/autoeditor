import { h } from 'preact';
import { useEffect } from 'preact/hooks';
import { graphData, selectedConcept, knowledgeError } from '../signals.js';

function getRelationships(edges, nodeId) {
  if (!edges) return [];
  return edges.filter((e) => e.source === nodeId || e.target === nodeId);
}

function getNodeName(nodes, id) {
  const node = nodes.find((n) => n.id === id);
  return node ? (node.name || node.label || id) : id;
}

export function KnowledgeGraph({ bus, projectId }) {
  useEffect(() => {
    if (projectId) {
      bus.emit('knowledge:fetch', { projectId });
    }
  }, [projectId]);

  const data = graphData.value;
  const selected = selectedConcept.value;
  const error = knowledgeError.value;

  // Error state
  if (error) {
    return h('div', {
      style: `
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        background: #1e1e1e;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `
    },
      h('div', {
        style: `
          font-size: 11px;
          color: #ff4444;
          text-align: center;
          padding: 6px 10px;
          background: rgba(255, 68, 68, 0.1);
          border-radius: 4px;
        `
      }, error)
    );
  }

  // Loading state
  if (!data) {
    return h('div', {
      style: `
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        background: #1e1e1e;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #666;
        font-size: 11px;
      `
    }, 'Loading...');
  }

  const nodes = data.nodes || [];
  const edges = data.edges || [];

  // Empty state
  if (nodes.length === 0) {
    return h('div', {
      style: `
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        background: #1e1e1e;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #666;
        font-size: 11px;
      `
    }, 'No concepts found');
  }

  const selectedNode = selected ? nodes.find((n) => n.id === selected) : null;
  const selectedRels = selectedNode ? getRelationships(edges, selectedNode.id) : [];

  return (
    h('div', {
      style: `
        display: flex;
        height: 100%;
        background: #1e1e1e;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #e0e0e0;
      `
    },
      // LEFT: concept card list
      h('div', {
        style: `
          flex: 1;
          overflow-y: auto;
          border-right: 1px solid #333;
          padding: 6px;
        `
      },
        nodes.map((node) => {
          const isSelected = selected === node.id;
          const connCount = node.connections != null
            ? node.connections
            : getRelationships(edges, node.id).length;

          return h('div', {
            key: node.id,
            onClick: () => { selectedConcept.value = node.id; },
            style: `
              padding: 8px 10px;
              margin-bottom: 4px;
              background: ${isSelected ? '#1a3a5c' : '#2a2a2a'};
              border: 1px solid ${isSelected ? '#4dabf7' : 'transparent'};
              border-radius: 4px;
              cursor: pointer;
            `
          },
            // Name row with connection count badge
            h('div', {
              style: `
                display: flex;
                align-items: center;
                gap: 6px;
              `
            },
              h('span', {
                style: `
                  font-size: 11px;
                  font-weight: 600;
                  color: ${isSelected ? '#4dabf7' : '#e0e0e0'};
                  flex: 1;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                `
              }, node.name || node.label || node.id),

              h('span', {
                style: `
                  font-size: 9px;
                  color: #999;
                  background: #333;
                  padding: 1px 6px;
                  border-radius: 8px;
                  flex-shrink: 0;
                `
              }, connCount)
            ),

            // Description
            node.description && h('div', {
              style: `
                font-size: 9px;
                color: #666;
                margin-top: 3px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              `
            }, node.description)
          );
        })
      ),

      // RIGHT: selected concept detail
      h('div', {
        style: `
          flex: 1;
          overflow-y: auto;
          padding: 12px;
        `
      },
        !selectedNode
          ? h('div', {
              style: `
                font-size: 11px;
                color: #666;
                text-align: center;
                padding: 30px 0;
              `
            }, 'Select a concept')
          : h('div', null,
              // Name
              h('div', {
                style: `
                  font-size: 15px;
                  font-weight: bold;
                  color: #4dabf7;
                  margin-bottom: 4px;
                `
              }, selectedNode.name || selectedNode.label || selectedNode.id),

              // Type + importance
              h('div', {
                style: `
                  font-size: 9px;
                  color: #666;
                  margin-bottom: 10px;
                  display: flex;
                  gap: 8px;
                `
              },
                selectedNode.type && h('span', null, selectedNode.type),
                selectedNode.importance != null && h('span', null, `importance: ${selectedNode.importance}`)
              ),

              // Description
              selectedNode.description && h('div', {
                style: `
                  font-size: 11px;
                  color: #ccc;
                  line-height: 1.6;
                  margin-bottom: 12px;
                `
              }, selectedNode.description),

              // Divider
              h('div', { style: `border-top: 1px solid #333; margin-bottom: 10px;` }),

              // Relationships
              h('div', {
                style: `
                  font-size: 10px;
                  font-weight: 600;
                  color: #999;
                  margin-bottom: 6px;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                `
              }, 'Relationships'),

              selectedRels.length === 0
                ? h('div', {
                    style: `font-size: 10px; color: #666; margin-bottom: 12px;`
                  }, 'None')
                : h('div', {
                    style: `margin-bottom: 12px;`
                  },
                    selectedRels.map((edge, i) => {
                      const isSource = edge.source === selectedNode.id;
                      const otherName = getNodeName(nodes, isSource ? edge.target : edge.source);
                      const rel = edge.relationship || 'relates to';

                      return h('div', {
                        key: i,
                        style: `
                          font-size: 10px;
                          color: #ccc;
                          padding: 2px 0;
                        `
                      },
                        h('span', { style: `color: #999;` }, isSource ? `${rel} \u2192 ` : `\u2190 ${rel} `),
                        h('span', { style: `color: #4dabf7;` }, otherName)
                      );
                    })
                  ),

              // Divider
              h('div', { style: `border-top: 1px solid #333; margin-bottom: 10px;` }),

              // Segments section
              h('div', {
                style: `
                  font-size: 10px;
                  font-weight: 600;
                  color: #999;
                  margin-bottom: 6px;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                `
              }, 'Segments'),

              selectedNode.segments && selectedNode.segments.length > 0
                ? h('div', {
                    style: `display: flex; flex-wrap: wrap; gap: 4px;`
                  },
                    selectedNode.segments.map((seg, i) =>
                      h('span', {
                        key: i,
                        style: `
                          font-size: 9px;
                          color: #ccc;
                          background: #2a2a2a;
                          padding: 2px 8px;
                          border-radius: 3px;
                        `
                      }, typeof seg === 'string' ? seg : (seg.label || seg.id || `Seg ${i + 1}`))
                    )
                  )
                : h('div', {
                    style: `font-size: 10px; color: #666;`
                  }, 'No segments linked')
            )
      )
    )
  );
}
