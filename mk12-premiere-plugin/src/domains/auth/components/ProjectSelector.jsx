/**
 * ProjectSelector — shows project list, emits project:selected on click.
 * Displayed in READY shell state.
 */
import { h } from 'preact';
import { useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';

const projects = signal([]);
const loading = signal(false);
const error = signal(null);

export function ProjectSelector({ bus }) {
  useEffect(() => {
    loading.value = true;
    error.value = null;

    const onFetched = (data) => {
      projects.value = data?.projects || data || [];
      loading.value = false;
    };
    const onError = () => {
      error.value = 'Failed to load projects';
      loading.value = false;
    };

    bus.on('projects:fetched', onFetched);
    bus.emit('projects:fetch', {});

    return () => {
      bus.off('projects:fetched', onFetched);
    };
  }, [bus]);

  if (loading.value) {
    return (
      <div class="flex-col gap-md p-md">
        <sp-progress-bar indeterminate label="Loading projects..." />
        <span class="text-muted">Loading projects...</span>
      </div>
    );
  }

  if (error.value) {
    return (
      <div class="p-md">
        <sp-help-text variant="negative">{error.value}</sp-help-text>
      </div>
    );
  }

  const list = projects.value;

  if (list.length === 0) {
    return <div class="p-md text-muted">No projects found</div>;
  }

  return (
    <div class="flex-col gap-sm p-md">
      <h3 class="text-md">Select Project</h3>
      {list.map(proj => (
        <sp-action-button
          key={proj.id}
          onClick={() => bus.emit('project:selected', { projectId: proj.id, projectName: proj.name })}
        >
          {proj.name || proj.id}
        </sp-action-button>
      ))}
    </div>
  );
}
