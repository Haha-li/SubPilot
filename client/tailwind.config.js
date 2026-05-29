/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
        },
        success: { DEFAULT: '#10B981', soft: '#D1FAE5' },
        warning: { DEFAULT: '#F59E0B', soft: '#FEF3C7' },
        danger:  { DEFAULT: '#EF4444', soft: '#FEE2E2' },
        ink: {
          50:  '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
          950: '#020617',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'Poppins', 'Noto Sans SC', 'system-ui', 'sans-serif'],
        heading: ['Poppins', 'Inter', 'Noto Sans SC', 'system-ui', 'sans-serif'],
        mono:    ['Fira Code', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        'bento':    '24px',
        'bento-sm': '16px',
      },
      boxShadow: {
        'bento':       '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.06)',
        'bento-hover': '0 4px 8px rgba(15,23,42,0.06), 0 16px 40px rgba(99,102,241,0.12)',
        'glass':       '0 8px 32px rgba(15,23,42,0.08)',
      },
      backdropBlur: { xs: '2px' },
      transitionTimingFunction: { soft: 'cubic-bezier(0.4, 0, 0.2, 1)' },
    },
  },
  plugins: [],
};
