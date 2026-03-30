import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
    jsxInject: "import { h, Fragment } from 'preact';",
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{js,jsx}'],
  },
  resolve: {
    alias: {
      react: 'preact/compat',
      'react-dom': 'preact/compat',
      'react-dom/test-utils': 'preact/test-utils',
    },
  },
});
