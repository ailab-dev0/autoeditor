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

function TabBar() {
  const current = activeTab.value;

  return (
    <div style="display:flex;flex-direction:row;border-bottom:1px solid #333;padding:0 8px;gap:0">
      {REVIEW_TABS.map(t => {
        const active = current === t.id;
        return (
          <div
            key={t.id}
            onClick={() => { activeTab.value = t.id; }}
            style={`padding:8px 14px;cursor:pointer;font-size:12px;font-weight:500;border-bottom:2px solid ${active ? '#4dabf7' : 'transparent'};color:${active ? '#e0e0e0' : '#999'};user-select:none`}
          >
            {t.label}
          </div>
        );
      })}
    </div>
  );
}

function ReviewingView({ bus, projectId }) {
  const tab = activeTab.value;

  return (
    <div style="display:flex;flex-direction:column;height:100%">
      <TabBar />
      <div style="flex:1;overflow:hidden">
        {tab === 'segments' && <SegmentList bus={bus} />}
        {tab === 'stock' && <StockBrowser bus={bus} />}
        {tab === 'transcript' && <TranscriptView bus={bus} projectId={projectId} />}
        {tab === 'knowledge' && <KnowledgeGraph bus={bus} projectId={projectId} />}
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
