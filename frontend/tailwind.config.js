/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        healthy: '#22c55e',
        warning: '#f59e0b',
        critical: '#ef4444',
        'bg-dark': '#0f1117',
        'bg-card': '#1a1f2e',
        'bg-panel': '#151926',
        'border-dark': '#2a3040',
        'text-primary': '#e2e8f0',
        'text-secondary': '#94a3b8',
        'accent-blue': '#3b82f6',
      },
      animation: {
        'pulse-warning': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-critical': 'pulse 0.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
