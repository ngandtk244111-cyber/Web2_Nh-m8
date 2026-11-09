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
          50: '#FAF9F6',
          100: '#F2EFEA',
          200: '#DCD5CC',
          300: '#C6BDB4',
          400: '#A69B91',
          500: '#746A62',
          600: '#625A54',
          700: '#403A35',
          900: '#292522',
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
