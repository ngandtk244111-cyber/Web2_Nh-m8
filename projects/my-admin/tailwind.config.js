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
        // Client dùng Inter cho mọi chữ; giữ key `serif` để các class font-serif cũ vẫn chạy
        serif: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        // Đồng bộ palette my-client (giữ tên token cũ): rust = đỏ MUJI, espresso = nâu đen, canvas = be kraft, clay = hồng đỏ nhấn
        rust: { DEFAULT: '#A3152D', dark: '#891226' },
        espresso: '#1F1712',
        ink: { DEFAULT: '#1F1712', muted: '#7A6F67' },
        canvas: '#F7F2E7',
        clay: { DEFAULT: '#B7485B', tint: '#F9F1F2' },
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgba(31, 23, 18, 0.04)',
        card: '0 1px 2px rgba(31, 23, 18, 0.04), 0 4px 16px -6px rgba(31, 23, 18, 0.06)',
        lift: '0 2px 4px rgba(31, 23, 18, 0.04), 0 12px 32px -8px rgba(31, 23, 18, 0.12)',
      },
      backdropBlur: { xs: '2px' },
    },
  },
  plugins: [],
};
