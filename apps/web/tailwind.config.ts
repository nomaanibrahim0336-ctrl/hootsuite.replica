import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        sidebar: '#1a1a2e',
        sidebarHover: '#25254a',
        accent: {
          DEFAULT: '#6c63ff',
          hover: '#5a52e0',
          light: '#eeecff',
        },
        canvas: '#f8fafc',
        positive: '#10b981',
        negative: '#ef4444',
        neutral: '#94a3b8',
      },
    },
  },
  plugins: [],
};

export default config;
