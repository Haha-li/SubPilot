/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          // 主色 #409eff (Element Plus 经典蓝) 为 500；#79bbff 落在 400
          50: '#ecf5ff',
          100: '#d9ecff',
          200: '#c6e2ff',
          300: '#a0cfff',
          400: '#79bbff',
          500: '#409eff',
          600: '#337ecc',
          700: '#2c6fb5',
          800: '#1f4f80',
          900: '#143860',
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
        'bento-hover': '0 4px 8px rgba(15,23,42,0.06), 0 16px 40px rgba(64,158,255,0.16)',
        'glass':       '0 8px 32px rgba(15,23,42,0.08)',
      },
      backdropBlur: { xs: '2px' },
      transitionTimingFunction: { soft: 'cubic-bezier(0.4, 0, 0.2, 1)' },
    },
  },
  plugins: [],
};
