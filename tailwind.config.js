/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    // Les libs définissent des classes utilitaires (badges de rôle dans
    // permissions.ts, couleurs de composants dans ebios-data.ts) construites
    // par mapping dynamique : sans ce glob, Tailwind les purge (ex. bg-cyan-100,
    // bg-slate-800) et les badges s'affichent sans fond.
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ebios: {
          50:  '#f0f4ff',
          100: '#e0e9ff',
          200: '#c7d6fe',
          300: '#a5b8fc',
          400: '#8191f8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        risk: {
          critical: '#dc2626',
          high:     '#ea580c',
          medium:   '#ca8a04',
          low:      '#16a34a',
          negligible:'#6b7280',
        },
      },
    },
  },
  plugins: [],
}
