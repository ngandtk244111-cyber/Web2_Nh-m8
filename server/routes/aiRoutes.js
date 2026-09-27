const express = require('express');
const axios = require('axios');
const Product = require('../models/Product');

const router = express.Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

// Cơ chế theo AruBot của AuraPC-main (server/routes/chatRoutes.js):
//   1) Nạp TOÀN BỘ catalog (nhóm theo danh mục, lấy mẫu đều, cache 10 phút) vào system prompt
//      để AI chỉ gợi ý sản phẩm có thật.
//   2) AI trả JSON { reply, products: [{ name, slug }] } -> server tự dò lại sản phẩm thật trong DB:
//      slug -> tên chính xác -> tên gần đúng -> từ khoá trong tên.
//   3) Nếu AI không gợi ý được nhưng câu hỏi rõ ràng là hỏi sản phẩm (có từ khoá loại sản phẩm / mức giá)
//      -> lọc DB theo từ khoá + khoảng giá; vẫn trống -> lấy sản phẩm nổi bật.
//   4) Có sản phẩm thì chuẩn hoá lại câu trả lời thành danh sách đánh số khớp với thẻ sản phẩm trên UI.
// Khác AruBot: dùng Gemini (đã cấu hình sẵn) thay Replicate, và giữ phần Design Brief riêng của Luméa.

const PRODUCT_FIELDS = 'id name slug images basePrice originalPrice';

// ── Catalog cache cho system prompt ──
let catalogCache = null;
let catalogCacheTime = 0;
const CATALOG_TTL = 10 * 60 * 1000;
const CATALOG_MAX = 300;

async function getCatalogText() {
  const now = Date.now();
  if (catalogCache && now - catalogCacheTime < CATALOG_TTL) return catalogCache;

  try {
    const products = await Product.find({})
      .select('name slug basePrice originalPrice categoryName productionType customizable style color')
      .sort({ reviewCount: -1, rating: -1 })
      .lean();

    // Nhóm theo danh mục rồi chia đều hạn mức, để loại sản phẩm nào cũng có mặt trong prompt.
    const grouped = new Map();
    for (const p of products) {
      const key = p.categoryName || 'Khác';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(p);
    }
    const perCategory = Math.max(3, Math.floor(CATALOG_MAX / Math.max(grouped.size, 1)));

    const lines = ['DANH MỤC SẢN PHẨM CỬA HÀNG LUMÉA (chỉ gợi ý từ danh sách này):'];
    let total = 0;
    for (const [catName, prods] of grouped) {
      if (total >= CATALOG_MAX) break;
      lines.push(`\n[${catName}]`);
      const limit = Math.min(perCategory, prods.length, CATALOG_MAX - total);
      for (let i = 0; i < limit; i++) {
        const p = prods[i];
        const price = `${p.basePrice.toLocaleString('vi-VN')}đ`;
        const old = p.originalPrice && p.originalPrice > p.basePrice
          ? ` (gốc ${p.originalPrice.toLocaleString('vi-VN')}đ)`
          : '';
        const tags = [
          p.productionType === 'PRINT_ON_DEMAND' ? 'in 3D theo yêu cầu' : 'có sẵn',
          p.customizable ? 'tuỳ biến được' : null,
          p.style ? `phong cách ${p.style}` : null,
          p.color ? `màu ${p.color}` : null,
        ].filter(Boolean).join(', ');
        lines.push(`- ${p.name} | slug: ${p.slug} | ${price}${old} | ${tags}`);
        total++;
      }
    }

    catalogCache = lines.join('\n');
    catalogCacheTime = now;
    return catalogCache;
  } catch (err) {
    console.error('[aiRoutes] Catalog load error:', err.message);
    return 'DANH MỤC SẢN PHẨM: Không tải được. Hãy tư vấn chung, không nêu tên sản phẩm cụ thể.';
  }
}

function buildSystemPrompt(catalog) {
  return 'QUAN TRỌNG: Bạn CHỈ ĐƯỢC trả về DUY NHẤT một JSON object. KHÔNG markdown, KHÔNG giải thích, KHÔNG ``` fences.\n\n' +
    'Bạn là Goh — "AI Idea Assistant" của Luméa, shop nội thất, đồ decor và sản phẩm in 3D theo yêu cầu.\n' +
    'Bạn luôn trả lời ngắn gọn, rõ ràng, thân thiện bằng tiếng Việt.\n' +
    'Nhiệm vụ: (a) tư vấn và gợi ý sản phẩm có trong shop; (b) giúp khách chốt "Design Brief" cho món đồ in 3D theo ý tưởng riêng.\n\n' +
    'QUY TẮC ƯU TIÊN CAO NHẤT:\n' +
    '1. TÔN TRỌNG Ý MUỐN KHÁCH: nếu khách nói không muốn gợi ý sản phẩm, yêu cầu dừng gợi ý, hoặc chỉ hỏi thông tin/tư vấn chung ' +
    '→ trả "products": [] và chỉ trả lời bằng chữ. Quy tắc này ưu tiên hơn mọi quy tắc bên dưới.\n' +
    '2. LINH HOẠT THEO NGỮ CẢNH: đọc kỹ lịch sử hội thoại. Nếu trước đó khách đã từ chối gợi ý → không gợi ý nữa trừ khi khách HỎI LẠI về sản phẩm.\n\n' +
    'QUY TẮC GỢI Ý SẢN PHẨM (chỉ khi khách MUỐN xem sản phẩm):\n' +
    '- BẮT BUỘC chỉ gợi ý sản phẩm CÓ TRONG danh mục bên dưới, dùng đúng "name" và "slug". KHÔNG bịa sản phẩm.\n' +
    '- Kiểm tra kỹ danh mục trước khi nói "shop không có". Không có đúng loại nhưng có món tương tự → gợi ý và giải thích vì sao phù hợp.\n' +
    '- Ưu tiên đúng tầm giá khách yêu cầu. Không bịa thông số; không chắc thì nói không chắc.\n\n' +
    'QUY TẮC DESIGN BRIEF (khi khách mô tả ý tưởng riêng muốn in 3D):\n' +
    '- Điền vào "brief" những trường suy luận được từ tin nhắn MỚI NHẤT: productType, theme, style, color, size, usage, customText, notes.\n' +
    '- Trường chưa chắc thì bỏ trống (không ghi đè bằng chuỗi rỗng). Không liên quan ý tưởng riêng → "brief": null.\n\n' +
    catalog + '\n\n' +
    'ĐẦU RA BẮT BUỘC — DUY NHẤT một JSON object hợp lệ:\n' +
    '{\n' +
    '  "reply": "câu trả lời (xem quy tắc format bên dưới)",\n' +
    '  "products": [ { "name": "TÊN CHÍNH XÁC từ danh mục", "slug": "SLUG CHÍNH XÁC từ danh mục" } ],\n' +
    '  "quickReplies": ["gợi ý trả lời nhanh 1", "gợi ý 2"],\n' +
    '  "brief": { "productType": "...", "theme": "...", "style": "...", "color": "...", "size": "...", "usage": "...", "customText": "...", "notes": "..." } hoặc null\n' +
    '}\n' +
    '- "reply" luôn phải có. Trong chuỗi JSON dùng \\n để xuống dòng, dùng **tên sản phẩm** để in đậm.\n' +
    '- "products" tối đa 4 phần tử. Để [] khi: (1) câu hỏi không liên quan sản phẩm (2) khách không muốn gợi ý (3) chỉ tư vấn kiến thức (4) khách đã từ chối gợi ý trước đó.\n' +
    '- "quickReplies" tối đa 4 câu ngắn khách có thể bấm để trả lời tiếp.\n\n' +
    'FORMAT "reply" KHI GỢI Ý SẢN PHẨM: 1 câu mở đầu ngắn; liệt kê "1. **Tên sản phẩm**: mô tả ngắn, tầm giá."; kết bằng MỘT câu hỏi để thu hẹp nhu cầu. Xuống dòng giữa các phần.\n' +
    'FORMAT "reply" KHI KHÔNG GỢI Ý: trả lời bình thường, ngắn gọn (tối đa khoảng 4 câu), không cần danh sách đánh số.\n' +
    '- KHÔNG trả thêm chữ nào ngoài JSON.';
}

// ── Trích JSON từ output AI (bỏ khối <think>, markdown fence, tìm cặp {} đầu tiên) ──
function extractJSON(raw) {
  let text = String(raw || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) text = fenceMatch[1].trim();

  try {
    return JSON.parse(text);
  } catch (_) {
    // ignore, fallback dưới đây
  }

  const start = text.indexOf('{');
  if (start !== -1) {
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.substring(start, i + 1));
        } catch (_) {
          break;
        }
      }
    }
  }
  return null;
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Từ khoá loại sản phẩm trong câu hỏi -> regex tìm theo tên/danh mục (bước fallback 2).
const KEYWORD_MAP = [
  { keywords: ['đèn', 'lamp'], regex: /đèn|lamp/i },
  { keywords: ['bình hoa', 'binh hoa', 'lọ hoa', 'vase'], regex: /bình|vase/i },
  { keywords: ['chậu', 'chau cay', 'cây', 'pot'], regex: /chậu|pot|bonsai/i },
  { keywords: ['kệ', 'ke sach', 'shelf', 'giá sách'], regex: /kệ|shelf|giá đỡ sách|bookend/i },
  { keywords: ['sofa', 'ghế sofa'], regex: /sofa/i },
  { keywords: ['giường', 'giuong', 'bed'], regex: /giường|bed/i },
  { keywords: ['tủ', 'tu quan ao', 'cabinet', 'wardrobe'], regex: /tủ|cabinet|wardrobe/i },
  { keywords: ['ghế', 'chair', 'đôn', 'stool'], regex: /ghế|chair|đôn|stool/i },
  { keywords: ['bàn', 'table', 'desk'], regex: /bàn|table/i },
  { keywords: ['đồng hồ', 'dong ho', 'clock'], regex: /đồng hồ|clock/i },
  { keywords: ['khay', 'organizer', 'tray'], regex: /khay|organizer|tray/i },
  { keywords: ['tượng', 'tuong', 'sculpture', 'mô hình'], regex: /tượng|sculpture|mô hình/i },
  { keywords: ['khung tranh', 'tranh', 'frame'], regex: /khung|frame|tranh/i },
  { keywords: ['nến', 'candle'], regex: /nến|candle/i },
];

// "300k", "300 nghìn", "1 triệu", "2tr"... -> số VND. "dưới/không quá/tối đa" -> chỉ chặn trên.
function parsePriceFilter(text) {
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*(k|nghìn|ngàn|triệu|tr)\b/);
  if (!m) return null;
  const num = parseFloat(m[1].replace(',', '.'));
  if (!(num > 0)) return null;
  const target = /triệu|tr/.test(m[2]) ? num * 1_000_000 : num * 1_000;
  const before = text.slice(0, m.index);
  if (/(dưới|không quá|tối đa|max|<)\s*$/.test(before)) {
    return { basePrice: { $lte: target } };
  }
  return { basePrice: { $gte: target * 0.7, $lte: target * 1.3 } };
}

async function findProductBySpec(spec) {
  const name = spec.name.trim();
  let doc = null;
  if (spec.slug) doc = await Product.findOne({ slug: spec.slug }).select(PRODUCT_FIELDS).lean();
  if (!doc) doc = await Product.findOne({ name }).select(PRODUCT_FIELDS).lean();
  if (!doc) {
    const baseName = name.split('(')[0].trim();
    if (baseName) doc = await Product.findOne({ name: new RegExp(escapeRegex(baseName), 'i') }).select(PRODUCT_FIELDS).lean();
  }
  if (!doc) {
    const keywords = name
      .replace(/[()[\]/\\,.-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 2)
      .slice(0, 3);
    if (keywords.length) {
      doc = await Product.findOne({ $and: keywords.map((w) => ({ name: new RegExp(escapeRegex(w), 'i') })) })
        .select(PRODUCT_FIELDS)
        .lean();
    }
  }
  return doc;
}

async function resolveProducts(modelProducts, message) {
  let found = [];

  // 1) Map sản phẩm AI gợi ý sang bản ghi thật.
  const seen = new Set();
  for (const spec of modelProducts) {
    const doc = await findProductBySpec(spec);
    if (doc && !seen.has(doc.id)) {
      seen.add(doc.id);
      found.push(doc);
    }
    if (found.length >= 4) break;
  }

  // 2) Nhận diện ý định hỏi sản phẩm từ câu hỏi (từ khoá loại sản phẩm / mức giá).
  const text = (message || '').toLowerCase();
  const entry = KEYWORD_MAP.find((e) => e.keywords.some((kw) => text.includes(kw)));
  const nameRegex = entry ? entry.regex : null;
  const priceFilter = parsePriceFilter(text);
  const intendsProducts = modelProducts.length > 0 || !!nameRegex;

  if (!found.length && intendsProducts && (nameRegex || priceFilter)) {
    const byName = nameRegex ? { $or: [{ name: nameRegex }, { categoryName: nameRegex }] } : {};
    found = await Product.find({ ...byName, ...(priceFilter || {}) })
      .sort({ reviewCount: -1, rating: -1 })
      .limit(4)
      .select(PRODUCT_FIELDS)
      .lean();
    if (!found.length && nameRegex && priceFilter) {
      found = await Product.find(byName).sort({ reviewCount: -1, rating: -1 }).limit(4).select(PRODUCT_FIELDS).lean();
    }
  }

  // 3) Có ý định hỏi sản phẩm nhưng vẫn không tìm được -> sản phẩm nổi bật.
  if (!found.length && intendsProducts) {
    found = await Product.find({}).sort({ reviewCount: -1, rating: -1 }).limit(4).select(PRODUCT_FIELDS).lean();
  }

  return found.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    image: Array.isArray(p.images) && p.images.length ? p.images[0] : '',
    price: p.basePrice,
    originalPrice: p.originalPrice || null,
  }));
}

// Có danh sách sản phẩm thật -> viết lại câu trả lời cho khớp đúng các thẻ hiển thị bên dưới.
function buildProductReply(products) {
  const lines = products.map((p, i) => {
    const price = p.price > 0 ? ` (khoảng ${p.price.toLocaleString('vi-VN')}đ)` : '';
    const discount = p.originalPrice && p.originalPrice > p.price
      ? ` – đang giảm khoảng ${Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)}%`
      : '';
    return `${i + 1}. **${p.name}**${price}${discount}.`;
  });
  return 'Dưới đây là một số lựa chọn phù hợp từ cửa hàng Luméa mà bạn có thể tham khảo:\n\n' +
    lines.join('\n') +
    '\n\nBạn muốn mình tư vấn kỹ hơn về món nào, hay cần gợi ý thêm trong tầm giá khác không?';
}

/**
 * POST /api/ai/assistant
 * Body: { userText: string, history?: { sender: 'USER'|'AI', text: string }[], currentBrief?: object, sessionId?: string }
 */
router.post('/assistant', async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(503).json({ success: false, error: 'GEMINI_API_KEY chưa được cấu hình trên server (xem server/.env.example).' });
    }

    const { userText, history = [], currentBrief = null } = req.body || {};
    if (!userText || typeof userText !== 'string' || !userText.trim()) {
      return res.status(400).json({ success: false, error: 'userText is required' });
    }

    const catalog = await getCatalogText();
    const systemPrompt = buildSystemPrompt(catalog);

    const conversationText = [
      ...(Array.isArray(history) ? history : [])
        .filter((m) => m && m.text)
        .slice(-20)
        .map((m) => `${m.sender === 'USER' ? 'Khách' : 'Goh'}: ${String(m.text)}`),
      currentBrief ? `[Design Brief hiện tại]: ${JSON.stringify(currentBrief)}` : null,
      `Khách: ${userText}\nGoh (trả JSON, không markdown):`,
    ].filter(Boolean).join('\n');

    const geminiRes = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: conversationText }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024, responseMimeType: 'application/json' },
      },
      { timeout: 60000 }
    );

    const rawText = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = extractJSON(rawText);

    // AI có thể đặt tên key khác nhau — chấp nhận các biến thể phổ biến như AruBot.
    let reply = '';
    let modelProducts = [];
    if (parsed && typeof parsed === 'object') {
      const replyField = parsed.reply || parsed.assistant_reply || parsed.response || parsed.message || parsed.answer || parsed.text || '';
      if (typeof replyField === 'string') reply = replyField.trim();
      if (Array.isArray(parsed.products)) {
        modelProducts = parsed.products
          .filter((p) => p && typeof p.name === 'string' && p.name.trim())
          .map((p) => ({ name: p.name.trim(), slug: typeof p.slug === 'string' ? p.slug.trim() : '' }));
      } else if (Array.isArray(parsed.suggestedProductSlugs)) {
        modelProducts = parsed.suggestedProductSlugs
          .filter((s) => typeof s === 'string' && s.trim())
          .map((s) => ({ name: s.trim(), slug: s.trim() }));
      }
    } else if (rawText && !rawText.trim().startsWith('{')) {
      reply = rawText.trim();
    }

    if (!reply) {
      reply = 'Xin lỗi, mình chưa hiểu rõ ý bạn lắm. Bạn có thể mô tả cụ thể hơn món đồ bạn đang tìm không?';
    }

    let products = [];
    try {
      products = await resolveProducts(modelProducts, userText);
    } catch (e) {
      console.error('[aiRoutes] product suggestion error:', e.message || e);
    }
    if (products.length) reply = buildProductReply(products);

    res.json({
      success: true,
      reply,
      quickReplies: Array.isArray(parsed?.quickReplies)
        ? parsed.quickReplies.filter((q) => typeof q === 'string' && q.trim()).slice(0, 4)
        : [],
      brief: parsed?.brief && typeof parsed.brief === 'object' ? parsed.brief : null,
      products,
    });
  } catch (err) {
    console.error('AI assistant error:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: 'Không thể kết nối AI. Vui lòng thử lại sau.' });
  }
});

module.exports = router;
