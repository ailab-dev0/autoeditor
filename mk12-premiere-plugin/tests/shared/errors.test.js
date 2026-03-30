import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toasts, addToast, dismissToast, clearToasts, categorizeError, toastCount } from '../../src/shared/errors';

describe('Errors', () => {
  beforeEach(() => {
    clearToasts();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('toast queue', () => {
    it('adds a toast', () => {
      addToast('Something failed', 'backend');
      expect(toasts.value).toHaveLength(1);
      expect(toasts.value[0].message).toBe('Something failed');
      expect(toasts.value[0].category).toBe('backend');
    });

    it('caps at 3 toasts', () => {
      addToast('one');
      addToast('two');
      addToast('three');
      addToast('four');
      expect(toasts.value).toHaveLength(3);
      expect(toasts.value[0].message).toBe('two');
      expect(toasts.value[2].message).toBe('four');
    });

    it('auto-dismisses after 5s', () => {
      addToast('ephemeral');
      expect(toasts.value).toHaveLength(1);
      vi.advanceTimersByTime(5000);
      expect(toasts.value).toHaveLength(0);
    });

    it('dismissToast removes by id', () => {
      const id = addToast('remove me');
      expect(toasts.value).toHaveLength(1);
      dismissToast(id);
      expect(toasts.value).toHaveLength(0);
    });

    it('clearToasts removes all', () => {
      addToast('a');
      addToast('b');
      clearToasts();
      expect(toasts.value).toHaveLength(0);
    });

    it('toastCount is computed', () => {
      expect(toastCount.value).toBe(0);
      addToast('x');
      expect(toastCount.value).toBe(1);
    });
  });

  describe('categorizeError', () => {
    it('returns validation for field errors', () => {
      expect(categorizeError('Project name required')).toBe('validation');
      expect(categorizeError({ message: 'must be a number' })).toBe('validation');
    });

    it('returns transport for network errors', () => {
      expect(categorizeError('fetch failed')).toBe('transport');
      expect(categorizeError({ message: 'WebSocket disconnected' })).toBe('transport');
    });

    it('returns premiere for UXP errors', () => {
      expect(categorizeError('No active sequence')).toBe('premiere');
      expect(categorizeError({ message: 'Track 5 not found' })).toBe('premiere');
    });

    it('returns backend by default', () => {
      expect(categorizeError('Something unknown')).toBe('backend');
      expect(categorizeError(null)).toBe('backend');
    });

    it('respects explicit type hint', () => {
      expect(categorizeError({ type: 'validation', message: 'whatever' })).toBe('validation');
      expect(categorizeError({ type: 'transport', message: 'whatever' })).toBe('transport');
      expect(categorizeError({ type: 'premiere', message: 'whatever' })).toBe('premiere');
    });

    it('uses HTTP status codes', () => {
      expect(categorizeError({ status: 422 })).toBe('validation');
      expect(categorizeError({ status: 500 })).toBe('backend');
    });
  });
});
