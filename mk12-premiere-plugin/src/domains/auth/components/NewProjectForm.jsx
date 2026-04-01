import { h } from 'preact';
import { useState } from 'preact/hooks';

export function NewProjectForm({ bus, transport, onCancel }) {
  const [name, setName] = useState('');
  const [brief, setBrief] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [creating, setCreating] = useState(false);

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput('');
  };

  const removeTag = (idx) => {
    setTags(tags.filter((_, i) => i !== idx));
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    const res = await transport.post('/api/projects', { name: name.trim(), brief: brief.trim(), tags });
    if (res.ok) {
      const project = res.data.project || res.data;
      bus.emit('project:selected', { projectId: project.id, projectName: project.name });
    }
    setCreating(false);
  };

  return (
    h('div', {
      style: `
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px;
        background: #2a2a2a;
        border-radius: 4px;
        margin: 8px;
      `
    },
      // Name input
      h('input', {
        type: 'text',
        value: name,
        onInput: (e) => setName(e.target.value),
        placeholder: 'Project name',
        style: `
          font-size: 12px;
          padding: 6px 8px;
          background: #1e1e1e;
          border: 1px solid #444;
          border-radius: 4px;
          color: #e0e0e0;
          outline: none;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `
      }),

      // Brief textarea
      h('textarea', {
        value: brief,
        onInput: (e) => setBrief(e.target.value),
        placeholder: 'Brief description',
        style: `
          font-size: 12px;
          padding: 6px 8px;
          background: #1e1e1e;
          border: 1px solid #444;
          border-radius: 4px;
          color: #e0e0e0;
          outline: none;
          height: 50px;
          resize: none;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `
      }),

      // Tag pills + input
      h('div', {
        style: `
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          align-items: center;
          min-height: 28px;
          padding: 4px 6px;
          background: #1e1e1e;
          border: 1px solid #444;
          border-radius: 4px;
        `
      },
        ...tags.map((tag, i) =>
          h('span', {
            key: i,
            style: `
              font-size: 10px;
              padding: 2px 6px;
              background: rgba(77, 171, 247, 0.15);
              color: #4dabf7;
              border-radius: 3px;
              display: flex;
              align-items: center;
              gap: 3px;
              cursor: default;
            `
          },
            tag,
            h('span', {
              onClick: () => removeTag(i),
              style: `
                cursor: pointer;
                font-size: 12px;
                line-height: 1;
                opacity: 0.7;
              `
            }, '\u00d7')
          )
        ),
        h('input', {
          type: 'text',
          value: tagInput,
          onInput: (e) => setTagInput(e.target.value),
          onKeyDown: handleTagKeyDown,
          placeholder: tags.length === 0 ? 'Tags (enter to add)' : '',
          style: `
            font-size: 10px;
            padding: 2px 4px;
            background: transparent;
            border: none;
            color: #e0e0e0;
            outline: none;
            flex: 1;
            min-width: 60px;
          `
        })
      ),

      // Buttons
      h('div', {
        style: `
          display: flex;
          gap: 6px;
          margin-top: 4px;
        `
      },
        h('button', {
          onClick: onCancel,
          style: `
            flex: 1;
            font-size: 11px;
            font-weight: 500;
            padding: 5px 10px;
            background: transparent;
            color: #999;
            border: 1px solid #444;
            border-radius: 4px;
            cursor: pointer;
          `
        }, 'Cancel'),

        h('button', {
          onClick: handleCreate,
          disabled: !name.trim() || creating,
          style: `
            flex: 1;
            font-size: 11px;
            font-weight: 600;
            padding: 5px 10px;
            background: ${!name.trim() || creating ? '#333' : '#4dabf7'};
            color: ${!name.trim() || creating ? '#666' : '#fff'};
            border: none;
            border-radius: 4px;
            cursor: ${!name.trim() || creating ? 'default' : 'pointer'};
          `
        }, creating ? 'Creating...' : 'Create')
      )
    )
  );
}
