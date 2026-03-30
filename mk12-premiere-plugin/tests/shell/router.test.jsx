import { describe, it, expect, beforeEach } from 'vitest';
import { h } from 'preact';
import { render, screen } from '@testing-library/preact';
import { Router } from '../../src/shell/router.jsx';
import { shellState, STATES } from '../../src/shell/fsm';

describe('Router', () => {
  beforeEach(() => {
    shellState.value = STATES.UNAUTHENTICATED;
  });

  it('renders LoginForm for UNAUTHENTICATED', () => {
    render(<Router />);
    expect(screen.getByText('Login')).toBeTruthy();
  });

  it('renders ServerConnect for CONNECTING', () => {
    shellState.value = STATES.CONNECTING;
    render(<Router />);
    expect(screen.getByText(/Connecting/)).toBeTruthy();
  });

  it('renders ProjectSelector for READY', () => {
    shellState.value = STATES.READY;
    render(<Router />);
    expect(screen.getByText('Select Project')).toBeTruthy();
  });

  it('renders ProgressPanel for WORKING', () => {
    shellState.value = STATES.WORKING;
    render(<Router />);
    expect(screen.getByText('Pipeline Running')).toBeTruthy();
  });

  it('renders SegmentList for REVIEWING', () => {
    shellState.value = STATES.REVIEWING;
    render(<Router />);
    expect(screen.getByText('Review Segments')).toBeTruthy();
  });

  it('renders ApplySummary for APPLYING', () => {
    shellState.value = STATES.APPLYING;
    render(<Router />);
    expect(screen.getByText('Applying Edits')).toBeTruthy();
  });
});
