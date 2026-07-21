import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'night': {
          indigo: '#161B2E',
          indigoDeep: '#0E1322',
          indigoSoft: '#1E2438'
        },
        'window': { amber: '#E8A33D' },
        'fiber': { cyan: '#5FD4E0' },
        'stone': {
          DEFAULT: '#9C9484',
          soft: '#6E6759'
        },
        'dropout': { red: '#C24E42' }
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace']
      },
      animation: {
        'sankey-flow': 'sankeyFlow 4s linear infinite',
        'arrival-pulse': 'arrivalPulse 150ms ease-out',
        'drawer-in': 'drawerIn 280ms cubic-bezier(0.22, 1, 0.36, 1)'
      },
      keyframes: {
        sankeyFlow: {
          '0%': { strokeDashoffset: '24' },
          '100%': { strokeDashoffset: '0' }
        },
        arrivalPulse: {
          '0%': { transform: 'scale(1)', opacity: '0.9' },
          '70%': { transform: 'scale(1.8)', opacity: '0' },
          '100%': { transform: 'scale(1.8)', opacity: '0' }
        },
        drawerIn: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' }
        }
      }
    }
  },
  plugins: []
};
export default config;
