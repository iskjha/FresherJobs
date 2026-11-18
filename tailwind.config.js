/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        canvas: '#f6f7fb',
        sidebar: '#ffffff',
        panel: '#ffffff',
        raised: '#f3f4f6',
        line: '#e5e7eb',
        accent: { DEFAULT: '#3662e3', hover: '#2a51c4' },
      },
    },
  },
  plugins: [],
};
