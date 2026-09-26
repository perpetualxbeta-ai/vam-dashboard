/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        navy: { 50: '#f1f5fb', 100: '#dde7f4', 600: '#1f4e8c', 700: '#173d70', 800: '#112e56', 900: '#0b1f3b' },
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 2px 8px rgba(15, 23, 42, 0.06)',
      },
    },
  },
  plugins: [],
};
