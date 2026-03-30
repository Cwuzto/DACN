/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#003366',
          50: '#e6f0fa',
          100: '#cce1f5',
          200: '#99c2eb',
          300: '#66a3e0',
          400: '#3385d6',
          500: '#0066cc',
          600: '#0052a3',
          700: '#003366',
          800: '#002952',
          900: '#001f3d',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'sans-serif'],
        display: ['Lexend', 'Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
