/**
 * Router — maps shell FSM state to domain components.
 * Reads shellState signal and renders the appropriate view.
 */
import { h } from 'preact';
import { signal } from '@preact/signals';
import { shellState, STATES } from './fsm';
import { LoginForm } from '../domains/auth/components/LoginForm.jsx';
import { ServerConnect } from '../domains/auth/components/ServerConnect.jsx';
import { ProjectSelector } from '../domains/auth/components/ProjectSelector.jsx';
import { ProgressPanel } from '../domains/pipeline/components/ProgressPanel.jsx';
import { SegmentList } from '../domains/segments/components/SegmentList.jsx';
import { ApplySummary } from '../domains/timeline/components/ApplySummary.jsx';
import { StockBrowser } from '../domains/stock/components/StockBrowser.jsx';
import { TranscriptView } from '../domains/transcript/components/TranscriptView.jsx';
import { KnowledgeGraph } from '../domains/knowledge/components/KnowledgeGraph.jsx';
import { ExportPanel } from '../domains/export/components/ExportPanel.jsx';

/** Active tab in REVIEWING state */
export const activeTab = signal('segments');

const REVIEW_TABS = [
  { id: 'segments', label: 'Segments' },
  { id: 'stock', label: 'Stock' },
  { id: 'transcript', label: 'Transcript' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'export', label: 'Export' },
];

function ReviewingView({ bus, projectId }) {
  const tab = activeTab.value;

  return (
    <div class="flex-col" style="height:100%">
      <sp-action-group compact style="padding:4px 8px;border-bottom:1px solid var(--spectrum-global-color-gray-300,#444)">
        {REVIEW_TABS.map(t => (
          <sp-action-button
            key={t.id}
            selected={tab === t.id ? '' : undefined}
            onClick={() => { activeTab.value = t.id; }}
          >
            {t.label}
          </sp-action-button>
        ))}
      </sp-action-group>

      <div style="flex:1;overflow:hidden">
        {tab === 'segments' && <SegmentList bus={bus} />}
        {tab === 'stock' && <StockBrowser bus={bus} />}
        {tab === 'transcript' && <TranscriptView bus={bus} />}
        {tab === 'knowledge' && <KnowledgeGraph bus={bus} />}
        {tab === 'export' && <ExportPanel bus={bus} projectId={projectId} />}
      </div>
    </div>
  );
}

const STATE_VIEWS = {
  [STATES.UNAUTHENTICATED]: LoginForm,
  [STATES.CONNECTING]: ServerConnect,
  [STATES.READY]: ProjectSelector,
  [STATES.WORKING]: ProgressPanel,
  [STATES.REVIEWING]: ReviewingView,
  [STATES.APPLYING]: ApplySummary,
};

export function Router({ bus, projectId }) {
  const View = STATE_VIEWS[shellState.value];
  return View ? <View bus={bus} projectId={projectId} /> : null;
}
