import type { Config } from 'tailwindcss';

// Design-system theming: neutral tokens resolve to CSS variables defined in
// globals.css and flip when `.dark` is set on <html>. Fixed brand colors
// (drawer, accents) stay constant across themes.
const v = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: v('--canvas'),
        surface: v('--surface'),
        sidebar: '#2B2D35',
        sidebarHover: '#3A3D47',
        accent: {
          DEFAULT: '#FFB81C', // Saffron — primary CTAs
          hover: '#E8A716',
          light: v('--accent-light'),
          ink: '#1E2024', // text on saffron
          deep: v('--accent-deep'), // readable saffron for text/icons
        },
        positive: '#6FCF97', // Mint — success/growth
        negative: '#FF4C46', // Sunset — alerts/errors
        neutral: '#94a3b8',
        slate: {
          50: v('--s50'),
          100: v('--s100'),
          200: v('--s200'),
          300: v('--s300'),
          400: v('--s400'),
          500: v('--s500'),
          600: v('--s600'),
          700: v('--s700'),
          800: v('--s800'),
          900: v('--s900'),
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      keyframes: {
        'pop-in': {
          '0%': { transform: 'scale(0.96)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        'pop-in': 'pop-in 150ms ease-out',
        shimmer: 'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
