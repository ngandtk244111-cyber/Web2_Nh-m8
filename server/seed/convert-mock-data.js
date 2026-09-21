// Chuyển mock-data.ts (Angular, my-client) sang module CommonJS thuần để seed script dùng được.
// Object literal trong file .ts này vốn đã là JS hợp lệ (type chỉ nằm ở phần khai báo biến),
// nên chỉ cần bỏ dòng import và phần chú thích kiểu (": Type[]") ở mỗi export.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../../projects/my-client/src/app/core/data/mock-data.ts');
const OUT = path.join(__dirname, 'mock-data.generated.js');

let src = fs.readFileSync(SRC, 'utf8');

// Bỏ toàn bộ dòng import.
src = src.replace(/^import .*;\s*$/gm, '');

// "export const NAME: Type[] = " -> "const NAME = exports.NAME = " (giữ biến cục bộ để các
// mock khác tham chiếu chéo, ví dụ MOCK_ORDERS dùng lại MOCK_PRODUCTS[0]).
src = src.replace(/export const (\w+): [^=]+=/g, 'const $1 = exports.$1 =');

fs.writeFileSync(OUT, src, 'utf8');
console.log('Wrote', OUT);
