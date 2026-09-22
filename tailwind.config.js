const path = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    path.join(__dirname, 'projects/my-client/src/**/*.{html,ts}'),
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'system-ui', 'sans-serif'],
        serif: ['Cormorant Garamond', 'serif'],
      },
      colors: {
        amber: {
          50: '#0A1B33',
          200: '#1B3F73',
          300: '#A9C6EA',
          400: '#5B9BD5',
          500: '#2E63B8',
          600: '#2055AF',
          700: '#163E7A',
          800: '#0F2C57',
          900: '#FFFFFF',
          950: '#081527',
        },
        neutral: {
          50: '#FAFAF9',
          100: '#F5F3EE',
          200: '#E9E6DE',
          300: '#888888',
          400: '#888888',
          500: '#888888',
          600: '#888888',
          700: '#373737',
          900: '#111111',
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
          300: '#D6E4F5',
          400: '#A9C6EA',
          500: '#5B9BD5',
          600: '#2E63B8',
        },
      },
      accentColor: {
        amber: {
          500: '#5B9BD5',
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
