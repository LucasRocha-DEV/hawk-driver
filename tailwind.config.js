/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Design tokens (CSS variables) ──
        // Os valores ficam em src/index.css como canais RGB ("R G B"), o que
        // permite que o Tailwind continue gerando as variantes de opacidade
        // (ex.: bg-hawk-green/10) via <alpha-value>. Trocar de tema é só trocar
        // o data-theme na raiz do documento — nenhum componente precisa mudar.
        // Backgrounds
        'hawk-bg':        'rgb(var(--hawk-bg) / <alpha-value>)',
        'hawk-bg2':       'rgb(var(--hawk-bg2) / <alpha-value>)',
        'hawk-card':      'rgb(var(--hawk-card) / <alpha-value>)',
        'hawk-input':     'rgb(var(--hawk-input) / <alpha-value>)',
        'hawk-hover':     'rgb(var(--hawk-hover) / <alpha-value>)',
        // Glass (rgba completo, sem variante de opacidade)
        'glass':          'var(--glass)',
        'glass-border':   'var(--glass-border)',
        'glass-hover':    'var(--glass-hover)',
        // Accent
        'hawk-green':     'rgb(var(--hawk-green) / <alpha-value>)',
        'hawk-purple':    'rgb(var(--hawk-purple) / <alpha-value>)',
        'hawk-red':       'rgb(var(--hawk-red) / <alpha-value>)',
        'hawk-yellow':    'rgb(var(--hawk-yellow) / <alpha-value>)',
        'hawk-blue':      'rgb(var(--hawk-blue) / <alpha-value>)',
        'hawk-pink':      'rgb(var(--hawk-pink) / <alpha-value>)',
        'hawk-orange':    'rgb(var(--hawk-orange) / <alpha-value>)',
        'hawk-violet':    'rgb(var(--hawk-violet) / <alpha-value>)',
        'hawk-teal':      'rgb(var(--hawk-teal) / <alpha-value>)',
        // Text
        'hawk-text':      'rgb(var(--hawk-text) / <alpha-value>)',
        'hawk-muted':     'rgb(var(--hawk-muted) / <alpha-value>)',
        'hawk-dim':       'rgb(var(--hawk-dim) / <alpha-value>)',
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
