/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        'hawk-bg':        '#0a0a0f',
        'hawk-bg2':       '#12121a',
        'hawk-card':      '#1a1a2e',
        'hawk-input':     '#16162a',
        'hawk-hover':     '#22223a',
        // Glass
        'glass':          'rgba(255,255,255,0.03)',
        'glass-border':   'rgba(255,255,255,0.06)',
        'glass-hover':    'rgba(255,255,255,0.06)',
        // Accent
        'hawk-green':     '#00d4aa',
        'hawk-purple':    '#6c5ce7',
        'hawk-red':       '#ff6b6b',
        'hawk-yellow':    '#ffd93d',
        'hawk-blue':      '#0984e3',
        'hawk-pink':      '#fd79a8',
        'hawk-orange':    '#e17055',
        'hawk-violet':    '#a29bfe',
        'hawk-teal':      '#00b894',
        // Text
        'hawk-text':      '#f0f0f5',
        'hawk-muted':     '#8888a8',
        'hawk-dim':       '#55556a',
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'xl2':  '16px',
        'xl3':  '24px',
      },
      backdropBlur: {
        xs: '4px',
      },
      boxShadow: {
        'green-glow':  '0 0 20px rgba(0,212,170,0.25)',
        'purple-glow': '0 0 20px rgba(108,92,231,0.25)',
        'red-glow':    '0 0 20px rgba(255,107,107,0.25)',
        'card':        '0 4px 24px rgba(0,0,0,0.4)',
        'card-hover':  '0 8px 40px rgba(0,0,0,0.6)',
        'inner-glow':  'inset 0 1px 0 rgba(255,255,255,0.06)',
      },
      animation: {
        'fade-in':    'fadeIn 0.3s ease',
        'fade-up':    'fadeInUp 0.5s ease',
        'float':      'float 3s ease-in-out infinite',
        'spin-slow':  'spin 2s linear infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%':   { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
