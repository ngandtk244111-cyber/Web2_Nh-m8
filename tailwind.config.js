const path = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    path.join(__dirname, 'projects/my-client/src/**/*.{html,ts}'),
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        amber: {
          50: '#F9F1F2',
          100: '#F2DEE2',
          200: '#E2B4BC',
          300: '#CD818E',
          400: '#B7485B',
          500: '#A3152D',
          600: '#891226',
          700: '#6C0E1E',
          800: '#4E0A16',
          900: '#31060E',
          950: '#180307',
        },
        neutral: {
          50: '#F7F2E7',
          100: '#EFE6D3',
          200: '#E3D5BA',
          300: '#93877E',
          400: '#93877E',
          500: '#93877E',
          600: '#93877E',
          700: '#3C332D',
          900: '#1F1712',
        },
      },
      borderColor: {
        neutral: {
          100: 'rgba(0,0,0,0.08)',
          200: 'rgba(0,0,0,0.1)',
          300: 'rgba(0,0,0,0.14)',
          400: 'rgba(0,0,0,0.2)',
        },
      },
      gradientColorStops: {
        amber: {
          300: '#CD818E',
          400: '#B7485B',
          500: '#A3152D',
          600: '#891226',
        },
      },
      accentColor: {
        amber: {
          500: '#A3152D',
        },
      },
      boxShadow: {
        soft: '0 4px 20px -2px rgba(0, 0, 0, 0.4)',
        float: '0 12px 35px -4px rgba(0, 0, 0, 0.6)',
      },
    },
  },
  plugins: [],
};
