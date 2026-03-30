/**
 * LoginForm — email/password login with inline error display.
 */
import { h } from 'preact';
import { useState } from 'preact/hooks';
import { loginError } from '../signals.js';

export function LoginForm({ bus }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    bus.emit('auth:login', { email, password });
  }

  const error = loginError.value;

  return (
    <form class="flex-col gap-md p-md" onSubmit={handleSubmit}>
      <sp-textfield
        label="Email"
        type="email"
        value={email}
        onInput={e => setEmail(e.target.value)}
      />
      <sp-textfield
        label="Password"
        type="password"
        value={password}
        onInput={e => setPassword(e.target.value)}
      />
      {error && (
        <sp-help-text variant="negative">{error}</sp-help-text>
      )}
      <sp-button variant="accent" type="submit">Log In</sp-button>
    </form>
  );
}
