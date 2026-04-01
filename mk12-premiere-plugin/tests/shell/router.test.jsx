import { describe, it, expect, beforeEach, vi } from 'vitest';
import { h } from 'preact';
import { render } from '@testing-library/preact';
import { Router } from '../../src/shell/router.jsx';
import { shellState, STATES } from '../../src/shell/fsm';
import { loginError } from '../../src/domains/auth/signals';

describe('Router', () => {
  const bus = { emit: vi.fn(), on: vi.fn(), off: vi.fn() };
  const transport = { get: vi.fn(async () => ({ ok: true, data: [] })), post: vi.fn(async () => ({ ok: true, data: {} })) };

  beforeEach(() => {
    shellState.value = STATES.UNAUTHENTICATED;
    loginError.value = null;
  });

  it('renders LoginForm for UNAUTHENTICATED', () => {
    const { container } = render(<Router bus={bus} transport={transport} />);
    expect(container.querySelector('form')).toBeTruthy();
    expect(container.querySelector('button')).toBeTruthy();
  });

  it('renders ServerConnect for CONNECTING', () => {
    shellState.value = STATES.CONNECTING;
    const { container } = render(<Router bus={bus} transport={transport} />);
    expect(container.textContent).toContain('Connecting');
  });

  it('renders ProjectSelector for READY', () => {
    shellState.value = STATES.READY;
    const { container } = render(<Router bus={bus} transport={transport} />);
    expect(container.textContent).toContain('Project');
  });

  it('renders ProgressPanel for WORKING', () => {
    shellState.value = STATES.WORKING;
    const { container } = render(<Router bus={bus} transport={transport} />);
    expect(container.textContent).toContain('Analyzing');
  });

  it('renders tabbed review view for REVIEWING', () => {
    shellState.value = STATES.REVIEWING;
    const { container } = render(<Router bus={bus} transport={transport} />);
    expect(container.textContent).toContain('Segments');
    expect(container.textContent).toContain('Stock');
    expect(container.textContent).toContain('Transcript');
    expect(container.textContent).toContain('Knowledge');
    // No standalone "Export" tab — only "Finalize & Export" in the segment footer
    const tabLabels = Array.from(container.querySelectorAll('div[style*="border-bottom:2px"]')).map(el => el.textContent);
    expect(tabLabels).not.toContain('Export');
  });

  it('renders ApplySummary for APPLYING', () => {
    shellState.value = STATES.APPLYING;
    const { container } = render(<Router bus={bus} transport={transport} />);
    expect(container.textContent).toContain('Timeline Updated');
  });
});
