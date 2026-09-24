const path = require('path');

/**
 * Tailwind config riêng cho my-admin (được nạp qua `@config` trong src/styles.css).
 * Tách khỏi tailwind.config.js ở root vì config đó chỉ quét my-client và
 * ghi đè bảng màu amber/neutral theo theme của client.
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: [path.join(__dirname, 'src/**/*.{html,ts}')],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        serif: ['Cormorant Garamond', 'Georgia', 'serif'],
      },
      colors: {
        // Palette Castlery: rust (CTA/topbar), espresso (sidebar), kem (nền), cam đất (điểm nhấn)
        rust: { DEFAULT: '#7E3F27', dark: '#693320' },
        espresso: '#2B1D16',
        ink: { DEFAULT: '#33241C', muted: '#7D6B5D' },
        canvas: '#F7F3EA',
        clay: { DEFAULT: '#C8672F', tint: '#FBEEE4' },
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgba(43, 29, 22, 0.04)',
        card: '0 1px 2px rgba(43, 29, 22, 0.04), 0 4px 16px -6px rgba(43, 29, 22, 0.06)',
        lift: '0 2px 4px rgba(43, 29, 22, 0.04), 0 12px 32px -8px rgba(43, 29, 22, 0.12)',
      },
      backdropBlur: { xs: '2px' },
    },
  },
  plugins: [],
};
