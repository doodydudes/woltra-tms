/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        amber: {
          50:  '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          400: '#FBBF24',
          500: '#F5B800',
          600: '#D97706',
          700: '#B45309',
        },
        char: {
          50:  '#FAFAF7',
          100: '#F5F4F2',
          200: '#E7E5E4',
          300: '#A8A29E',
          400: '#78716C',
          500: '#57534E',
          600: '#44403C',
          700: '#292524',
          800: '#1C1917',
          900: '#0E0C0A',
        },
      },
      fontFamily: {
        sans:    ['Satoshi', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"Cabinet Grotesk"', 'Satoshi', 'sans-serif'],
        mono:    ['"JetBrains Mono"', '"Geist Mono"', 'monospace'],
      },
      borderRadius: {
        xs:   '4px',
        sm:   '8px',
        md:   '12px',
        lg:   '16px',
        xl:   '20px',
        '2xl':'24px',
        pill: '999px',
      },
      screens: {
        xs:  '360px',
        sm:  '480px',
        md:  '768px',
        lg:  '1024px',
        xl:  '1440px',
      },
      spacing: {
        safe: 'env(safe-area-inset-bottom)',
      },
    },
  },
  plugins: [],
};
