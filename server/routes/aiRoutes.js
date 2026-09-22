const express = require('express');
const axios = require('axios');
const Product = require('../models/Product');

const router = express.Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

// ── Cache catalog READY_STOCK để nhét vào system prompt, tham khảo pattern AruBot của
// AuraPC-main (catalog cache 10 phút) — giúp AI chỉ gợi ý đúng sản phẩm có thật, không bịa.
let catalogCache = null;
let catalogCacheTime = 0;
const CATALOG_TTL = 10 * 60 * 1000;

async function getCatalog() {
  const now = Date.now();
  if (catalogCache && now - catalogCacheTime < CATALOG_TTL) return catalogCache;

  catalogCache = await Product.find({ productionType: 'READY_STOCK' })
    .select('id name slug basePrice categoryName style color images')
    .limit(150)
    .lean();
  catalogCacheTime = now;
  return catalogCache;
}

function buildSystemPrompt(catalog) {
  const catalogText = catalog
    .map(p => `- "${p.name}" | slug: ${p.slug} | ${p.basePrice.toLocaleString('vi-VN')}đ | ${p.categoryName}${p.style ? ' | phong cách: ' + p.style : ''}${p.color ? ' | màu: ' + p.color : ''}`)
    .join('\n');

  return `Bạn là "AI Idea Assistant" của Luméa — shop đồ decor & nội thất in 3D theo yêu cầu.
Nhiệm vụ có 2 phần:
1) Trò chuyện để giúp khách chốt một "Design Brief" cho món đồ decor in 3D theo Ý TƯỞNG RIÊNG của họ, gồm các trường: productType, theme, style, color, size, usage, customText, notes.
2) Nếu khách hỏi hoặc mô tả thứ có thể đã CÓ SẴN trong shop, gợi ý tối đa 4 sản phẩm phù hợp nhất TỪ DANH SÁCH DƯỚI ĐÂY — chỉ dùng đúng slug có trong danh sách, tuyệt đối không bịa sản phẩm không tồn tại. Nếu không có sản phẩm phù hợp, để mảng rỗng.

DANH SÁCH SẢN PHẨM CÓ SẴN (READY_STOCK):
${catalogText || '(hiện chưa có sản phẩm nào)'}

LUÔN trả lời bằng đúng 1 object JSON theo schema sau, không thêm bất kỳ text nào khác ngoài JSON:
{
  "reply": "câu trả lời tự nhiên, thân thiện, bằng tiếng Việt, tối đa khoảng 4 câu",
  "quickReplies": ["gợi ý trả lời nhanh 1", "gợi ý 2"],
  "brief": { "productType": "...", "theme": "...", "style": "...", "color": "...", "size": "...", "usage": "...", "customText": "...", "notes": "..." } hoặc null nếu chưa đủ thông tin để cập nhật,
  "suggestedProductSlugs": ["slug-1", "slug-2"]
}
Chỉ điền vào "brief" những trường bạn thực sự suy luận được hoặc muốn cập nhật từ tin nhắn MỚI NHẤT của khách; bỏ trống (không ghi đè bằng chuỗi rỗng) các trường còn lại chưa chắc chắn.`;
}

// ── Trích JSON từ output AI, phòng trường hợp model bọc thêm markdown fence ──
function extractJSON(raw) {
  let text = String(raw || '').trim();
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

router.post('/assistant', async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(503).json({ success: false, error: 'GEMINI_API_KEY chưa được cấu hình trên server (xem server/.env.example).' });
    }

    const { userText, history = [], currentBrief = null } = req.body;
    if (!userText || !userText.trim()) {
      return res.status(400).json({ success: false, error: 'userText is required' });
    }

    const catalog = await getCatalog();
    const systemPrompt = buildSystemPrompt(catalog);

    const conversationText = [
      ...history.slice(-10).map(m => `${m.sender === 'USER' ? 'Khách' : 'AI'}: ${m.text}`),
      currentBrief ? `[Design Brief hiện tại]: ${JSON.stringify(currentBrief)}` : null,
      `Khách: ${userText}`,
    ].filter(Boolean).join('\n');

    const geminiRes = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: conversationText }] }],
        generationConfig: { temperature: 0.7, responseMimeType: 'application/json' },
      },
      { timeout: 20000 }
    );

    const rawText = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = extractJSON(rawText);

    if (!parsed || !parsed.reply) {
      return res.json({
        success: true,
        reply: 'Xin lỗi, mình chưa hiểu rõ ý bạn lắm. Bạn có thể mô tả cụ thể hơn về món đồ decor bạn muốn không?',
        quickReplies: [],
        brief: null,
        suggestedProducts: [],
      });
    }

    let suggestedProducts = [];
    if (Array.isArray(parsed.suggestedProductSlugs) && parsed.suggestedProductSlugs.length) {
      const slugSet = new Set(parsed.suggestedProductSlugs);
      suggestedProducts = catalog
        .filter(p => slugSet.has(p.slug))
        .slice(0, 4)
        .map(p => ({ id: p.id, name: p.name, slug: p.slug, basePrice: p.basePrice, images: p.images }));
    }

    res.json({
      success: true,
      reply: parsed.reply,
      quickReplies: Array.isArray(parsed.quickReplies) ? parsed.quickReplies.slice(0, 4) : [],
      brief: parsed.brief && typeof parsed.brief === 'object' ? parsed.brief : null,
      suggestedProducts,
    });
  } catch (err) {
    console.error('AI assistant error:', err.response?.data || err.message);
    res.status(500).json({ success: false, error: 'Không thể kết nối AI. Vui lòng thử lại sau.' });
  }
});

module.exports = router;
