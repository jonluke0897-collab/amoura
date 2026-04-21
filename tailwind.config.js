/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        plum: {
          50: '#F7EDF3',
          400: '#9E5A7F',
          500: '#8C3E63',
          600: '#6B2E4F',
          700: '#4F1D3A',
          800: '#3F1F2E',
          900: '#2C1520',
          950: '#1A0C14',
        },
        rose: {
          200: '#F7D4DC',
          500: '#E8859A',
          700: '#B84F67',
        },
        peach: {
          400: '#F4B789',
          500: '#E89B6A',
        },
        sage: {
          500: '#8BA888',
        },
        cream: {
          50: '#FBF6EE',
          100: '#F5EBDC',
        },
      },
      fontFamily: {
        heading: ['Fraunces'],
        body: ['Inter'],
        mono: ['JetBrainsMono'],
      },
      fontSize: {
        xs: '12px',
        sm: '14px',
        base: '16px',
        lg: '18px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '32px',
        '4xl': '40px',
        display: '48px',
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '24px',
        full: '9999px',
      },
      boxShadow: {
        card: '0 2px 8px rgba(107, 46, 79, 0.08)',
        modal: '0 8px 24px rgba(107, 46, 79, 0.12)',
      },
    },
  },
  plugins: [],
};
