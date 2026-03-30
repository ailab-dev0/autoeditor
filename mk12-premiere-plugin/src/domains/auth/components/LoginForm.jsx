/**
 * LoginForm — email/password login with server URL config.
 * UXP Spectrum: sp-textfield, sp-button, no sp-help-text.
 */
import { h } from 'preact';
import { useState } from 'preact/hooks';
import { loginError, serverUrl } from '../signals.js';

export function LoginForm({ bus }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    bus.emit('auth:login', { email, password });
  }

  const error = loginError.value;

  return (
    <form onSubmit={handleSubmit} style="padding:16px;display:flex;flex-direction:column;gap:12px;max-width:320px;margin:0 auto">
      <h2 style="color:#e0e0e0;text-align:center;margin:16px 0 8px;font-size:18px">EditorLens</h2>

      <div>
        <label style="display:block;margin-bottom:4px;font-size:12px;color:#999">Server URL</label>
        <sp-textfield
          placeholder="http://localhost:8000"
          value={serverUrl.value}
          onInput={e => { serverUrl.value = e.target.value; }}
          style="width:100%"
        />
      </div>

      <div>
        <label style="display:block;margin-bottom:4px;font-size:12px;color:#999">Email</label>
        <sp-textfield
          placeholder="you@example.com"
          type="email"
          value={email}
          onInput={e => setEmail(e.target.value)}
          style="width:100%"
        />
      </div>

      <div>
        <label style="display:block;margin-bottom:4px;font-size:12px;color:#999">Password</label>
        <sp-textfield
          placeholder="Enter password"
          type="password"
          value={password}
          onInput={e => setPassword(e.target.value)}
          style="width:100%"
        />
      </div>

      <sp-button variant="accent" type="submit" style="width:100%;margin-top:4px">Log In</sp-button>

      {error && (
        <div style="color:#ff4444;font-size:12px;text-align:center">{error}</div>
      )}

      <div style="text-align:center;color:#666;font-size:11px;margin-top:8px">v2.0.0</div>
    </form>
  );
}
