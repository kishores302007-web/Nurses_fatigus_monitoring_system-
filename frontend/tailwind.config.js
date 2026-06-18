/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          55: '#f4f6f9',
          150: '#ebf0f5',
          205: '#dde3eb',
          250: '#d3dbe5',
          350: '#b2c0d0',
          450: '#7e91a7',
          550: '#556880',
          650: '#3d4e66',
          750: '#283548',
          850: '#162235',
        },
        hospital: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          teal: {
            50: '#f0fdfa',
            100: '#ccfbf1',
            200: '#99f6e4',
            500: '#14b8a6',
            600: '#0d9488',
            700: '#0f766e',
          }
        }
      }
    },
  },
  plugins: [],
}
