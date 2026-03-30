import { describe, it, expect, beforeEach, vi } from 'vitest';
import { h } from 'preact';
import { render, screen, fireEvent } from '@testing-library/preact';
import { LoginForm } from '../../../../src/domains/auth/components/LoginForm.jsx';
import { loginError } from '../../../../src/domains/auth/signals';

describe('LoginForm', () => {
  let bus;

  beforeEach(() => {
    loginError.value = null;
    bus = { emit: vi.fn(), on: vi.fn(), off: vi.fn() };
  });

  it('renders email and password fields and submit button', () => {
    render(<LoginForm bus={bus} />);
    expect(document.querySelector('sp-textfield[type="email"]')).toBeTruthy();
    expect(document.querySelector('sp-textfield[type="password"]')).toBeTruthy();
    expect(document.querySelector('sp-button')).toBeTruthy();
  });

  it('emits auth:login on form submit', async () => {
    const { container } = render(<LoginForm bus={bus} />);
    const form = container.querySelector('form');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    // Preact needs a microtask to process
    await new Promise(r => setTimeout(r, 0));
    expect(bus.emit).toHaveBeenCalledWith('auth:login', { email: '', password: '' });
  });

  it('shows inline error when loginError is set', () => {
    loginError.value = 'Bad credentials';
    render(<LoginForm bus={bus} />);
    const helpText = document.querySelector('sp-help-text[variant="negative"]');
    expect(helpText).toBeTruthy();
    expect(helpText.textContent).toBe('Bad credentials');
  });

  it('does not show error when loginError is null', () => {
    render(<LoginForm bus={bus} />);
    expect(document.querySelector('sp-help-text')).toBeNull();
  });
});
