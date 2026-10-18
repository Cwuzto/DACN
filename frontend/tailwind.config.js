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
          DEFAULT: '#0F766E',
          50: '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          300: '#5EEAD4',
          400: '#2DD4BF',
          500: '#14B8A6',
          600: '#0D9488',
          700: '#0F766E',
          800: '#115E59',
          900: '#134E4A',
        },
        nordic: {
          teal: '#0F766E',
          dark: '#115E59',
          light: '#F0FDFA',
          gray: '#F4F6F8',
          border: '#E2E8F0',
          red: '#BE123C',
          navy: '#0A2540',
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
