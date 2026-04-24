/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bark: {
          50: '#faf7f2',
          100: '#f2ebe0',
          200: '#e4d5bf',
          300: '#d1b896',
          400: '#bc9568',
          500: '#aa7d4d',
          600: '#9c6b42',
          700: '#825638',
          800: '#6a4631',
          900: '#573b2b',
          950: '#2e1e15',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
