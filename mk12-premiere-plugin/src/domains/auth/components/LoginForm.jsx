import { h } from 'preact';
import { useState } from 'preact/hooks';
import { loginError, serverUrl } from '../signals.js';

export function LoginForm({ bus }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    bus.emit('auth:login', { email, password });
  };

  return (
    h('div', {
      style: `
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        width: 100%;
        background: #1e1e1e;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `
    },
      h('form', {
        onSubmit: handleSubmit,
        style: `
          width: 100%;
          max-width: 280px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        `
      },
        h('div', {
          style: `
            font-size: 18px;
            font-weight: bold;
            color: #e0e0e0;
            text-align: center;
            margin-bottom: 6px;
          `
        }, 'EditorLens'),

        h('input', {
          type: 'text',
          value: serverUrl.value,
          onInput: (e) => { serverUrl.value = e.target.value; },
          placeholder: 'Server URL',
          style: `
            font-size: 11px;
            padding: 6px 8px;
            background: #2a2a2a;
            border: 1px solid #444;
            border-radius: 4px;
            color: #999;
            outline: none;
          `
        }),

        h('input', {
          type: 'email',
          value: email,
          onInput: (e) => setEmail(e.target.value),
          placeholder: 'Email',
          style: `
            font-size: 13px;
            padding: 8px;
            background: #2a2a2a;
            border: 1px solid #444;
            border-radius: 4px;
            color: #e0e0e0;
            outline: none;
          `
        }),

        h('input', {
          type: 'password',
          value: password,
          onInput: (e) => setPassword(e.target.value),
          placeholder: 'Password',
          style: `
            font-size: 13px;
            padding: 8px;
            background: #2a2a2a;
            border: 1px solid #444;
            border-radius: 4px;
            color: #e0e0e0;
            outline: none;
          `
        }),

        h('button', {
          type: 'submit',
          style: `
            font-size: 13px;
            font-weight: 600;
            padding: 8px;
            background: #4dabf7;
            color: #fff;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            width: 100%;
          `
        }, 'Log In'),

        loginError.value && h('div', {
          style: `
            font-size: 12px;
            color: #ff4444;
            text-align: center;
            margin-top: 2px;
          `
        }, loginError.value)
      )
    )
  );
}
