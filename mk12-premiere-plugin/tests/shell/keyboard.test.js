import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleKeyDown, onKey, clearKeys, keyboardEnabled } from '../../src/shared/keyboard';

describe('Keyboard Handler', () => {
  beforeEach(() => { clearKeys(); keyboardEnabled.value = true; });

  it('calls registered handler on keypress', () => {
    const fn = vi.fn();
    onKey('j', fn);
    handleKeyDown({ key: 'j', preventDefault: vi.fn(), target: { tagName: 'DIV' } });
    expect(fn).toHaveBeenCalled();
  });

  it('ignores when focused on input', () => {
    const fn = vi.fn();
    onKey('j', fn);
    handleKeyDown({ key: 'j', preventDefault: vi.fn(), target: { tagName: 'INPUT' } });
    expect(fn).not.toHaveBeenCalled();
  });

  it('ignores when disabled', () => {
    const fn = vi.fn();
    onKey('j', fn);
    keyboardEnabled.value = false;
    handleKeyDown({ key: 'j', preventDefault: vi.fn(), target: { tagName: 'DIV' } });
    expect(fn).not.toHaveBeenCalled();
  });

  it('unsubscribes via returned function', () => {
    const fn = vi.fn();
    const unsub = onKey('j', fn);
    unsub();
    handleKeyDown({ key: 'j', preventDefault: vi.fn(), target: { tagName: 'DIV' } });
    expect(fn).not.toHaveBeenCalled();
  });
});
