/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        edge: { bg: '#0a0a0a', card: '#111111', border: '#1a1a1a', green: '#00c758', blue: '#3b82f6', purple: '#a855f7', orange: '#f97316', red: '#ef4444', yellow: '#eab308', muted: '#6b7280' }
      }
    }
  },
  plugins: []
}
