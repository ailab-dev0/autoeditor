import { h } from 'preact';
import { useEffect } from 'preact/hooks';
import { serverUrl } from '../signals.js';

const SPIN_KEYFRAMES = `
@keyframes el-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes el-slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}
`;

export function ServerConnect({ bus }) {
  useEffect(() => {
    bus.emit('health:check', {});
  }, []);

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
      h('style', null, SPIN_KEYFRAMES),

      h('div', {
        style: `
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
        `
      },
        // Spinner
        h('div', {
          style: `
            width: 36px;
            height: 36px;
            border: 3px solid #4dabf7;
            border-top-color: transparent;
            border-radius: 50%;
            animation: el-spin 0.8s linear infinite;
          `
        }),

        // Label
        h('div', {
          style: `
            font-size: 13px;
            font-weight: 500;
            color: #e0e0e0;
          `
        }, 'Connecting...'),

        // Indeterminate progress bar
        h('div', {
          style: `
            width: 200px;
            height: 3px;
            background: #2a2a2a;
            border-radius: 2px;
            overflow: hidden;
            position: relative;
          `
        },
          h('div', {
            style: `
              position: absolute;
              top: 0;
              left: 0;
              width: 50%;
              height: 100%;
              background: #4dabf7;
              border-radius: 2px;
              animation: el-slide 1.2s ease-in-out infinite;
            `
          })
        ),

        // Server URL
        h('div', {
          style: `
            font-size: 10px;
            color: #999;
          `
        }, serverUrl.value),

        // Cancel button
        h('button', {
          onClick: () => bus.emit('auth:logout', {}),
          style: `
            font-size: 11px;
            font-weight: 500;
            padding: 4px 12px;
            background: transparent;
            color: #999;
            border: 1px solid #444;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 4px;
          `
        }, 'Cancel')
      )
    )
  );
}
