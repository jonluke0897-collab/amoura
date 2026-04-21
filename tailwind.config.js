/** @type {import('tailwindcss').Config} */
// Palette derived from the Amoura logo (violet → magenta → coral-pink gradient).
// Class names kept from the vision-doc design tokens (plum/cream/rose/peach)
// to avoid churn across components; hex values updated to match the logo.
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
          50: '#F5F3FF',
          400: '#A78BFA',
          500: '#7C3AED',
          600: '#6D28D9',
          700: '#5B21B6',
          800: '#4C1D95',
          900: '#2E1065',
          950: '#1E0838',
        },
        rose: {
          200: '#FBCFE8',
          500: '#EC4899',
          700: '#BE185D',
        },
        peach: {
          400: '#FB7185',
          500: '#F43F5E',
        },
        sage: {
          500: '#8BA888',
        },
        cream: {
          50: '#FAFAFF',
          100: '#F0EBF7',
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
        card: '0 2px 8px rgba(109, 40, 217, 0.10)',
        modal: '0 8px 24px rgba(109, 40, 217, 0.14)',
      },
    },
  },
  plugins: [],
};
