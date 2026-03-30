import { describe, it, expect, beforeEach, vi } from 'vitest';
import { h } from 'preact';
import { render } from '@testing-library/preact';
import { Router } from '../../src/shell/router.jsx';
import { shellState, STATES } from '../../src/shell/fsm';
import { loginError } from '../../src/domains/auth/signals';

describe('Router', () => {
  const bus = { emit: vi.fn(), on: vi.fn(), off: vi.fn() };

  beforeEach(() => {
    shellState.value = STATES.UNAUTHENTICATED;
    loginError.value = null;
  });

  it('renders LoginForm for UNAUTHENTICATED', () => {
    const { container } = render(<Router bus={bus} />);
    expect(container.querySelector('form')).toBeTruthy();
    expect(container.querySelector('sp-button')).toBeTruthy();
  });

  it('renders ServerConnect for CONNECTING', () => {
    shellState.value = STATES.CONNECTING;
    const { container } = render(<Router bus={bus} />);
    expect(container.querySelector('sp-progress-bar')).toBeTruthy();
    expect(container.textContent).toContain('Connecting');
  });

  it('renders ProjectSelector for READY', () => {
    shellState.value = STATES.READY;
    const { container } = render(<Router bus={bus} />);
    expect(container.textContent).toContain('Select Project');
  });

  it('renders ProgressPanel for WORKING', () => {
    shellState.value = STATES.WORKING;
    const { container } = render(<Router bus={bus} />);
    expect(container.querySelector('[role="progressbar"]')).toBeTruthy();
  });

  it('renders SegmentList for REVIEWING', () => {
    shellState.value = STATES.REVIEWING;
    const { container } = render(<Router bus={bus} />);
    expect(container.textContent).toContain('Review Segments');
  });

  it('renders ApplySummary for APPLYING', () => {
    shellState.value = STATES.APPLYING;
    const { container } = render(<Router bus={bus} />);
    expect(container.textContent).toContain('Applying Edits');
  });
});
