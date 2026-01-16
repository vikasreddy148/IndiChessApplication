/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Legacy chess colors (kept for compatibility)
        'chess-dark': '#15181f',
        'chess-panel': '#1b1d21',
        'chess-card': '#232428',
        'chess-text': '#e8ebf5',
        'chess-green-dark': '#6b8f55',
        'chess-green-light': '#e7ead5',
        // Semantic color tokens
        'bg-app': 'var(--bg-app)',
        'bg-panel': 'var(--bg-panel)',
        'bg-elevated': 'var(--bg-elevated)',
        'accent-primary': 'var(--accent-primary)',
        'accent-active': 'var(--accent-active)',
        'accent-warn': 'var(--accent-warn)',
        // Board colors via CSS variables
        'board-light': 'var(--board-light)',
        'board-dark': 'var(--board-dark)',
      },
      backgroundColor: {
        'app': 'var(--bg-app)',
        'panel': 'var(--bg-panel)',
        'elevated': 'var(--bg-elevated)',
      },
      borderColor: {
        'panel': 'var(--bg-panel)',
        'elevated': 'var(--bg-elevated)',
      },
      textColor: {
        'primary': 'var(--text-primary)',
        'muted': 'var(--text-muted)',
      },
      animation: {
        'fade-in': 'fadeIn 0.1s ease-out',
        'slide-up': 'slideUp 0.1s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      transitionDuration: {
        '100': '100ms',
      },
      transitionTimingFunction: {
        'out': 'ease-out',
      },
    },
  },
  plugins: [],
}

