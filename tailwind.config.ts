import type { Config } from 'tailwindcss';

// Partner colors are exposed as CSS custom properties by src/partner/apply-theme.ts.
// Tailwind utilities read through var() so every theme swap is automatic.
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        partner: {
          'bg-deep': 'var(--partner-bg-deep)',
          'bg-darker': 'var(--partner-bg-darker)',
          cyan: 'var(--partner-accent-cyan)',
          mid: 'var(--partner-accent-mid)',
          deep: 'var(--partner-accent-deep)',
          text: 'var(--partner-text-primary)',
          muted: 'var(--partner-text-muted)',
          'border-subtle': 'var(--partner-border-subtle)',
          'border-strong': 'var(--partner-border-strong)',
        },
      },
      fontFamily: {
        display: 'var(--partner-font-display)',
        body: 'var(--partner-font-body)',
        mono: 'var(--partner-font-mono)',
      },
    },
  },
  plugins: [],
};

export default config;
