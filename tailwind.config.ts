import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef8ff',
          100: '#d8efff',
          200: '#b6e1ff',
          300: '#7cc7ff',
          400: '#3aa8ff',
          500: '#0e8cff',
          600: '#006fe0',
          700: '#0056b3',
          800: '#024a8f',
          900: '#063f74'
        }
      }
    }
  },
  plugins: []
};

export default config;
