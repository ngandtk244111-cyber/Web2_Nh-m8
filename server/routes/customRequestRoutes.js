const crypto = require('crypto');
const express = require('express');
const { sendError } = require('../utils/http-error');
const { validatePrintRequest } = require('../utils/print-request-rules');
const CustomRequest = require('../models/CustomRequest');
const Quote = require('../models/Quote');
const Order = require('../models/Order');
const User = require('../models/User');
const Admin = require('../models/Admin');
const { requirePermission, requireUserId, attachUserId, adminIdFromRequest } = require('../middleware/auth');
const { adminHasPermission } = require('../utils/permissions');
const { writeAudit } = require('../utils/audit');
const {
  getDepositPolicy, resolveQuoteDeposit, priceQuoteItems, DEPOSIT_TERMS_VERSION,
} = require('../utils/deposit');
const { getReceivingBank } = require('../utils/payment-config');
const { paymentInstructions } = require('../utils/custom-order');
const { resolveShippingFee } = require('../utils/pricing');
const { generateOrderNumber } = require('../utils/order-number');

const router = express.Router();
const DAY = 86400 * 1000;
const HOUR = 3600 * 1000;

function nowLabel() {
  const now = new Date();
  return now.toLocaleDateString('vi-VN') + ' ' + now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

const REQUEST_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Mã yêu cầu ngẫu nhiên 6 ký tự từ crypto (mã cũ chỉ 900 khả năng nên dò được). */
function generateRequestCode() {
  const year = new Date().getFullYear();
  return `REQ-${year}-` + Array.from(crypto.randomBytes(6), b => REQUEST_CODE_CHARS[b % REQUEST_CODE_CHARS.length]).join('');
}

const findByIdOrCode = (idOrCode) => CustomRequest.findOne({ $or: [{ id: idOrCode }, { requestCode: idOrCode }] });

/**
 * Khách có phải chủ yêu cầu không: theo userId, hoặc với yêu cầu cũ chưa gắn tài khoản thì theo email
 * tài khoản (giống GET / danh sách). Khách vãng lai (không token) không bao giờ là chủ.
 */
async function isOwner(request, userId) {
  if (!userId || !request) return false;
  if (request.userId) return String(request.userId) === String(userId);
  const user = await User.findById(userId, { email: 1 }).lean();
  return !!user?.email && String(user.email).toLowerCase() === String(request.customerEmail || '').toLowerCase();
}

async function adminName(adminId) {
  const admin = await Admin.findById(adminId, { fullName: 1, username: 1 }).lean();
  return admin ? admin.fullName || admin.username : '';
}

/** Báo giá SENT đã quá hạn theo giờ server -> ghi EXPIRED (lazy, mọi lần đọc/ thao tác đều gọi). */
async function expireStaleQuotes(customRequestId, now = new Date()) {
  await Quote.updateMany(
    { customRequestId, status: 'SENT', validUntil: { $lte: now } },
    { $set: { status: 'EXPIRED', expiredAt: now } }
  );
}

function pushShopMessage(request, text) {
  request.messages.push({
    id: 'msg-' + Date.now() + '-' + crypto.randomBytes(2).toString('hex'),
    sender: 'SHOP_SPECIALIST',
    senderName: 'Luméa',
    avatar: '',
    text,
    timestamp: nowLabel(),
  });
}

// ---------------------------------------------------------------- Yêu cầu

// Yêu cầu chứa thông tin liên hệ + brief của khách: admin xem tất cả, khách chỉ xem của mình (theo
// userId, hoặc theo email với yêu cầu cũ gửi trước khi có userId), chưa đăng nhập thì danh sách rỗng.
router.get('/', attachUserId, async (req, res) => {
  try {
    let filter;
    const adminId = await adminIdFromRequest(req);
    if (adminId) {
      if (!(await adminHasPermission(adminId, 'custom3d.view'))) {
        return res.status(403).json({ success: false, error: 'Bạn không có quyền thực hiện thao tác này' });
      }
      filter = {};
    } else if (req.userId) {
      const user = await User.findById(req.userId, { email: 1 }).lean();
      filter = { $or: [{ userId: req.userId }, ...(user?.email ? [{ userId: null, customerEmail: user.email }] : [])] };
    } else {
      return res.json({ success: true, requests: [] });
    }
    const requests = await CustomRequest.find(filter).sort({ _id: -1 });
    res.json({ success: true, requests });
  } catch (err) {
    sendError(res, err);
  }
});

// Chi tiết 1 yêu cầu: nhân viên có quyền custom3d.view hoặc chủ yêu cầu. Không đủ quyền trả 404
// giống mã không tồn tại, để không dò được mã nào là thật.
router.get('/:id', attachUserId, async (req, res) => {
  try {
    const request = await findByIdOrCode(req.params.id);
    const adminId = await adminIdFromRequest(req);
    const allowed = request && (adminId
      ? await adminHasPermission(adminId, 'custom3d.view')
      : await isOwner(request, req.userId));
    if (!allowed) return res.status(404).json({ success: false, error: 'Không tìm thấy yêu cầu' });
    res.json({ success: true, request });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/', attachUserId, async (req, res) => {
  try {
    const ruleError = validatePrintRequest(req.body);
    if (ruleError) return res.status(400).json({ success: false, error: ruleError });

    const dateStr = nowLabel();
    // Không cho client tự đặt giá/trạng thái/ghi chú nội bộ/liên kết báo giá khi tạo yêu cầu.
    const {
      quotationPrice: _q, estimatedDays: _e, adminNote: _n, preview3dModelType: _p, adminId: _a,
      status: _s, userId: _u, currentQuoteVersion: _c, acceptedQuoteId: _aq, orderNumber: _o, messages: _m,
      id: _id, requestCode: _rc, ...body
    } = req.body;
    let request;
    for (let attempt = 0; attempt < 5 && !request; attempt++) {
      try {
        request = await CustomRequest.create({
          ...body,
          userId: req.userId || null,
          id: 'req-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex'),
          requestCode: generateRequestCode(),
          createdAt: dateStr,
          updatedAt: dateStr,
          status: 'PENDING_REVIEW',
          messages: [
            {
              id: 'msg-init',
              sender: 'AI_ASSISTANT',
              senderName: 'Luméa Bot',
              avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=DecoAI',
              text: 'Yêu cầu thiết kế riêng của bạn đã được chuyển tới kỹ thuật viên của shop. Shop sẽ xem xét tính khả thi và gửi báo giá kèm mức cọc. Đơn đặt làm cần thanh toán cọc trước khi sản xuất.',
              timestamp: dateStr,
            },
          ],
        });
      } catch (err) {
        if (err.code !== 11000) throw err;
      }
    }
    if (!request) throw new Error('Không tạo được mã yêu cầu, vui lòng thử lại');
    res.json({ success: true, request });
  } catch (err) {
    console.error('create custom request error', err);
    sendError(res, err);
  }
});

// Tin nhắn trong yêu cầu: chỉ nhân viên có quyền custom3d.edit hoặc chủ yêu cầu (đã đăng nhập).
router.post('/:id/messages', attachUserId, async (req, res) => {
  try {
    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ success: false, error: 'Nội dung tin nhắn trống' });
    if (text.length > 2000) return res.status(400).json({ success: false, error: 'Tin nhắn tối đa 2000 ký tự' });
    const request = await CustomRequest.findOne({ id: req.params.id });
    // Vai trò người gửi do server quyết định: chỉ token nhân viên hợp lệ mới gửi được với tư cách kỹ thuật viên.
    const adminId = await adminIdFromRequest(req);
    if (adminId) {
      if (!(await adminHasPermission(adminId, 'custom3d.edit'))) {
        return res.status(403).json({ success: false, error: 'Bạn không có quyền thực hiện thao tác này' });
      }
    } else if (!(await isOwner(request, req.userId))) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy yêu cầu' });
    }
    if (!request) return res.status(404).json({ success: false, error: 'Không tìm thấy yêu cầu' });

    const sender = adminId ? 'SHOP_SPECIALIST' : 'CUSTOMER';
    const timestamp = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const newMsg = {
      id: 'msg-' + Date.now(),
      sender,
      senderName: sender === 'CUSTOMER' ? 'Bạn (Khách hàng)' : (await adminName(adminId)) || 'Kỹ thuật viên Luméa',
      avatar: sender === 'CUSTOMER'
        ? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'
        : 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80',
      text,
      timestamp,
    };

    const updated = await CustomRequest.findOneAndUpdate(
      { id: req.params.id },
      { $push: { messages: newMsg }, $set: { updatedAt: timestamp } },
      { new: true }
    );
    res.json({ success: true, request: updated });
  } catch (err) {
    sendError(res, err);
  }
});

// Khách KHÔNG tự đổi trạng thái yêu cầu nữa: chấp nhận báo giá đi qua POST /:id/quotes/:version/accept,
// tạo đơn đi qua POST /:id/checkout (server tự chuyển trạng thái). Nhân viên đổi các trạng thái xử lý
// thông thường; các trạng thái gắn với báo giá / đơn hàng (QUOTED, APPROVED, CONVERTED_TO_ORDER) chỉ
// do luồng báo giá đặt.
const ADMIN_SETTABLE_STATUSES = ['PENDING_REVIEW', 'IN_DISCUSSION', 'PREVIEW_READY', 'REJECTED'];

router.patch('/:id/status', requirePermission('custom3d.edit'), async (req, res) => {
  try {
    const { status, preview3dModelType } = req.body;
    if (req.body.quotationPrice !== undefined || req.body.estimatedDays !== undefined) {
      return res.status(400).json({ success: false, error: 'Giá và thời gian làm được gửi qua chức năng Báo giá (có phiên bản)' });
    }
    if (status !== undefined && !ADMIN_SETTABLE_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, error: 'Trạng thái này do luồng báo giá / đặt hàng tự cập nhật' });
    }
    const request = await CustomRequest.findOne({ id: req.params.id });
    if (!request) return res.status(404).json({ success: false, error: 'Không tìm thấy yêu cầu' });
    if (request.status === 'CONVERTED_TO_ORDER' && status !== undefined) {
      return res.status(400).json({ success: false, error: 'Yêu cầu đã thành đơn hàng, không đổi trạng thái được nữa' });
    }
    // Đang có báo giá gửi khách / khách đã chấp nhận: cấp 3D preview chỉ cập nhật mẫu, giữ trạng thái
    // (đổi sang PREVIEW_READY sẽ làm khách mất quyền đặt hàng từ báo giá đã chấp nhận).
    const quoteActive = ['QUOTED', 'APPROVED'].includes(request.status);
    if (quoteActive && status === 'PREVIEW_READY') {
      // giữ nguyên request.status
    } else if (quoteActive && status !== undefined && status !== 'REJECTED') {
      return res.status(400).json({ success: false, error: 'Yêu cầu đang có báo giá hiệu lực — muốn đổi thì gửi phiên bản báo giá mới' });
    } else if (status !== undefined) {
      request.status = status;
    }
    if (preview3dModelType !== undefined) request.preview3dModelType = preview3dModelType;
    request.updatedAt = new Date().toLocaleDateString('vi-VN');
    await request.save();
    res.json({ success: true, request });
  } catch (err) {
    sendError(res, err);
  }
});

// ---------------------------------------------------------------- Báo giá (có phiên bản)

// Danh sách báo giá: nhân viên xem cả bản nháp; chủ yêu cầu chỉ thấy bản đã gửi trở đi.
router.get('/:id/quotes', attachUserId, async (req, res) => {
  try {
    const request = await CustomRequest.findOne({ id: req.params.id });
    const adminId = await adminIdFromRequest(req);
    const isStaff = !!adminId && await adminHasPermission(adminId, 'custom3d.view');
    if (!request || (!isStaff && !(await isOwner(request, req.userId)))) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy yêu cầu' });
    }
    await expireStaleQuotes(request.id);
    const filter = { customRequestId: request.id, ...(isStaff ? {} : { status: { $ne: 'DRAFT' } }) };
    const quotes = await Quote.find(filter).sort({ version: -1 });
    const policy = await getDepositPolicy();
    res.json({ success: true, quotes, termsVersion: DEPOSIT_TERMS_VERSION, policy });
  } catch (err) {
    sendError(res, err);
  }
});

function readQuoteInput(body) {
  const priced = priceQuoteItems(body.items, body.quoteDiscount);
  const estimatedDays = Number(body.estimatedDays);
  if (!Number.isInteger(estimatedDays) || estimatedDays < 1 || estimatedDays > 365) {
    throw new Error('Thời gian sản xuất dự kiến phải từ 1 đến 365 ngày');
  }
  const override = body.depositOverride && body.depositOverride.amount !== undefined && body.depositOverride.amount !== null && body.depositOverride.amount !== ''
    ? { amount: Number(body.depositOverride.amount), reason: String(body.depositOverride.reason || '').trim().slice(0, 300) }
    : null;
  return { ...priced, estimatedDays, note: String(body.note || '').trim().slice(0, 1000), depositOverride: override };
}

/** Yêu cầu còn nhận báo giá mới không (chưa từ chối, chưa có đơn đang hiệu lực). */
async function quoteBlockReason(request) {
  if (request.status === 'REJECTED') return 'Yêu cầu đã bị từ chối';
  if (request.orderNumber) {
    const order = await Order.findOne({ orderNumber: request.orderNumber }, { status: 1 }).lean();
    if (order && order.status !== 'CANCELLED') return `Yêu cầu đã có đơn ${request.orderNumber}, không gửi báo giá mới được`;
  }
  return null;
}

// Nhân viên tạo bản nháp báo giá (phiên bản kế tiếp). Mỗi yêu cầu chỉ có tối đa 1 bản nháp.
router.post('/:id/quotes', requirePermission('custom3d.edit'), async (req, res) => {
  try {
    const request = await CustomRequest.findOne({ id: req.params.id });
    if (!request) return res.status(404).json({ success: false, error: 'Không tìm thấy yêu cầu' });
    const blocked = await quoteBlockReason(request);
    if (blocked) return res.status(400).json({ success: false, error: blocked });
    if (await Quote.exists({ customRequestId: request.id, status: 'DRAFT' })) {
      return res.status(409).json({ success: false, error: 'Đã có bản nháp báo giá — sửa bản nháp đó thay vì tạo mới' });
    }
    let input;
    try {
      input = readQuoteInput(req.body);
      if (input.depositOverride) resolveQuoteDeposit(input.total, await getDepositPolicy(), input.depositOverride);
    } catch (e) {
      return res.status(400).json({ success: false, error: e.message });
    }
    const last = await Quote.findOne({ customRequestId: request.id }, { version: 1 }).sort({ version: -1 }).lean();
    const name = await adminName(req.adminId);
    let quote;
    try {
      quote = await Quote.create({
        ...input,
        customRequestId: request.id,
        requestCode: request.requestCode,
        version: (last?.version || 0) + 1,
        status: 'DRAFT',
        createdBy: req.adminId,
        createdByName: name,
      });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ success: false, error: 'Phiên bản báo giá vừa được tạo bởi thao tác khác, vui lòng tải lại' });
      throw err;
    }
    res.json({ success: true, quote });
  } catch (err) {
    sendError(res, err);
  }
});

// Nhân viên sửa bản nháp (chỉ DRAFT; báo giá đã gửi muốn đổi thì tạo phiên bản mới).
router.put('/:id/quotes/:version', requirePermission('custom3d.edit'), async (req, res) => {
  try {
    let input;
    try {
      input = readQuoteInput(req.body);
      if (input.depositOverride) resolveQuoteDeposit(input.total, await getDepositPolicy(), input.depositOverride);
    } catch (e) {
      return res.status(400).json({ success: false, error: e.message });
    }
    const quote = await Quote.findOneAndUpdate(
      { customRequestId: req.params.id, version: Number(req.params.version), status: 'DRAFT' },
      { $set: input },
      { new: true }
    );
    if (!quote) return res.status(400).json({ success: false, error: 'Chỉ sửa được bản nháp báo giá. Báo giá đã gửi muốn đổi thì tạo phiên bản mới.' });
    res.json({ success: true, quote });
  } catch (err) {
    sendError(res, err);
  }
});

// Nhân viên gửi báo giá cho khách: chốt tiền cọc theo chính sách hiện hành, đặt hạn hiệu lực,
// các báo giá đang gửi / đã chấp nhận (chưa thành đơn) của yêu cầu chuyển SUPERSEDED.
router.post('/:id/quotes/:version/send', requirePermission('custom3d.edit'), async (req, res) => {
  try {
    const request = await CustomRequest.findOne({ id: req.params.id });
    if (!request) return res.status(404).json({ success: false, error: 'Không tìm thấy yêu cầu' });
    const blocked = await quoteBlockReason(request);
    if (blocked) return res.status(400).json({ success: false, error: blocked });

    const draft = await Quote.findOne({ customRequestId: request.id, version: Number(req.params.version), status: 'DRAFT' });
    if (!draft) return res.status(400).json({ success: false, error: 'Không tìm thấy bản nháp báo giá này' });

    const policy = await getDepositPolicy();
    let deposit;
    try {
      deposit = resolveQuoteDeposit(draft.total, policy, draft.depositOverride);
    } catch (e) {
      return res.status(400).json({ success: false, error: e.message });
    }
    const now = new Date();
    const name = await adminName(req.adminId);
    const sent = await Quote.findOneAndUpdate(
      { _id: draft._id, status: 'DRAFT' },
      {
        $set: {
          status: 'SENT',
          deposit: { ...deposit, remaining: draft.total - deposit.amount },
          policySnapshot: { ...policy, termsVersion: DEPOSIT_TERMS_VERSION },
          issuedAt: now,
          validUntil: new Date(now.getTime() + policy.quoteValidityDays * DAY),
          sentBy: req.adminId,
          sentByName: name,
        },
      },
      { new: true }
    );
    if (!sent) return res.status(409).json({ success: false, error: 'Báo giá vừa được gửi bởi thao tác khác' });

    await Quote.updateMany(
      { customRequestId: request.id, _id: { $ne: sent._id }, status: { $in: ['SENT', 'ACCEPTED'] } },
      { $set: { status: 'SUPERSEDED', supersededAt: now } }
    );
    request.status = 'QUOTED';
    request.quotationPrice = sent.total;
    request.estimatedDays = sent.estimatedDays;
    request.currentQuoteVersion = sent.version;
    request.acceptedQuoteId = null;
    request.updatedAt = now.toLocaleDateString('vi-VN');
    pushShopMessage(request,
      `Luméa đã gửi báo giá phiên bản ${sent.version}: tổng ${sent.total.toLocaleString('vi-VN')}đ, cọc ${deposit.amount.toLocaleString('vi-VN')}đ, ` +
      `sản xuất khoảng ${sent.estimatedDays} ngày. Báo giá có hiệu lực tới ${sent.validUntil.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}.`);
    await request.save();

    const actor = await Admin.findById(req.adminId);
    await writeAudit(req, actor, {
      module: 'Đặt Làm', action: 'Gửi báo giá',
      detail: `${request.requestCode} v${sent.version}: ${sent.total}đ, cọc ${deposit.amount}đ${deposit.overridden ? ` (đổi mức cọc: ${deposit.overrideReason})` : ''}`,
      level: 'SUCCESS',
    });
    res.json({ success: true, quote: sent, request });
  } catch (err) {
    sendError(res, err);
  }
});

// Khách chấp nhận báo giá: phải đăng nhập, là chủ yêu cầu, đúng phiên bản đang hiệu lực, còn hạn
// (giờ server) và đồng ý chính sách cọc.
router.post('/:id/quotes/:version/accept', requireUserId, async (req, res) => {
  try {
    const request = await CustomRequest.findOne({ id: req.params.id });
    if (!request || !(await isOwner(request, req.userId))) return res.status(404).json({ success: false, error: 'Không tìm thấy yêu cầu' });
    if (req.body.agreeDepositTerms !== true) {
      return res.status(400).json({ success: false, error: 'Vui lòng đồng ý chính sách đặt cọc trước khi chấp nhận báo giá' });
    }
    const now = new Date();
    await expireStaleQuotes(request.id, now);
    const version = Number(req.params.version);
    if (version !== request.currentQuoteVersion) {
      return res.status(400).json({ success: false, error: 'Báo giá này không còn là phiên bản hiện hành, vui lòng xem phiên bản mới nhất' });
    }
    const quote = await Quote.findOneAndUpdate(
      { customRequestId: request.id, version, status: 'SENT', validUntil: { $gt: now } },
      { $set: { status: 'ACCEPTED', acceptedAt: now, acceptedByUserId: String(req.userId), acceptedTermsVersion: DEPOSIT_TERMS_VERSION } },
      { new: true }
    );
    if (!quote) {
      const current = await Quote.findOne({ customRequestId: request.id, version }, { status: 1 }).lean();
      const msg = current?.status === 'EXPIRED' ? 'Báo giá đã hết hạn — vui lòng nhắn shop để nhận báo giá mới'
        : current?.status === 'ACCEPTED' ? 'Bạn đã chấp nhận báo giá này rồi'
          : 'Báo giá không còn hiệu lực để chấp nhận';
      return res.status(400).json({ success: false, error: msg });
    }
    if (!request.userId) request.userId = req.userId; // yêu cầu cũ chưa gắn tài khoản -> gắn luôn chủ
    request.status = 'APPROVED';
    request.acceptedQuoteId = quote._id;
    request.updatedAt = now.toLocaleDateString('vi-VN');
    await request.save();
    res.json({ success: true, quote, request });
  } catch (err) {
    sendError(res, err);
  }
});

// Khách từ chối báo giá (có thể kèm lý do) -> yêu cầu quay về "đang trao đổi".
router.post('/:id/quotes/:version/reject', requireUserId, async (req, res) => {
  try {
    const request = await CustomRequest.findOne({ id: req.params.id });
    if (!request || !(await isOwner(request, req.userId))) return res.status(404).json({ success: false, error: 'Không tìm thấy yêu cầu' });
    const now = new Date();
    const quote = await Quote.findOneAndUpdate(
      { customRequestId: request.id, version: Number(req.params.version), status: 'SENT' },
      { $set: { status: 'REJECTED', rejectedAt: now, rejectReason: String(req.body.reason || '').trim().slice(0, 500) } },
      { new: true }
    );
    if (!quote) return res.status(400).json({ success: false, error: 'Báo giá không còn ở trạng thái chờ phản hồi' });
    request.status = 'IN_DISCUSSION';
    request.updatedAt = now.toLocaleDateString('vi-VN');
    await request.save();
    res.json({ success: true, quote, request });
  } catch (err) {
    sendError(res, err);
  }
});

// ---------------------------------------------------------------- Checkout đơn đặt làm

const BALANCE_METHODS = ['COD', 'BANK_TRANSFER'];

function readShippingAddress(raw) {
  const a = raw || {};
  const addr = {
    fullName: String(a.fullName || '').trim().slice(0, 120),
    phone: String(a.phone || '').replace(/[\s.]/g, '').slice(0, 20),
    email: String(a.email || '').trim().slice(0, 120),
    street: String(a.street || '').trim().slice(0, 200),
    district: String(a.district || '').trim().slice(0, 120),
    city: String(a.city || '').trim().slice(0, 120),
    notes: String(a.notes || '').trim().slice(0, 300),
  };
  if (!addr.fullName || !addr.street || !addr.district || !addr.city) return { error: 'Vui lòng nhập đủ họ tên và địa chỉ nhận hàng' };
  if (!/^(0|\+84)\d{9,10}$/.test(addr.phone)) return { error: 'Số điện thoại nhận hàng không hợp lệ' };
  return { addr };
}

// Tạo đơn từ báo giá đã chấp nhận. Giá, cọc, phí ship tính ở server từ báo giá trong DB; không đi
// qua giỏ hàng, không nhận mã giảm giá. Bấm nhiều lần chỉ tạo 1 đơn (unique index theo quoteId).
router.post('/:id/checkout', requireUserId, async (req, res) => {
  try {
    const request = await CustomRequest.findOne({ id: req.params.id });
    if (!request || !(await isOwner(request, req.userId))) return res.status(404).json({ success: false, error: 'Không tìm thấy yêu cầu' });
    if (req.body.agreeDepositTerms !== true) {
      return res.status(400).json({ success: false, error: 'Vui lòng đồng ý chính sách đặt cọc' });
    }
    if (req.body.couponCode) {
      return res.status(400).json({ success: false, error: 'Đơn đặt làm theo báo giá không áp dụng mã giảm giá' });
    }
    const balanceMethod = BALANCE_METHODS.includes(req.body.balanceMethod) ? req.body.balanceMethod : null;
    if (!balanceMethod) return res.status(400).json({ success: false, error: 'Vui lòng chọn cách thanh toán phần còn lại (COD hoặc chuyển khoản)' });
    const { addr, error: addrError } = readShippingAddress(req.body.shippingAddress);
    if (addrError) return res.status(400).json({ success: false, error: addrError });

    const version = Number(req.body.quoteVersion);
    const quote = await Quote.findOne({ customRequestId: request.id, version });
    if (!quote) return res.status(400).json({ success: false, error: 'Không tìm thấy báo giá' });

    // Idempotent: báo giá này đã có đơn -> trả lại đơn đó.
    const existing = await Order.findOne({ 'customRequestRef.quoteId': quote._id });
    if (existing) return res.json({ success: true, existing: true, order: existing, payment: paymentInstructions(existing) });

    const now = new Date();
    if (quote.status !== 'ACCEPTED' || String(quote.acceptedByUserId) !== String(req.userId)
      || String(request.acceptedQuoteId || '') !== String(quote._id)) {
      return res.status(400).json({ success: false, error: 'Bạn cần chấp nhận đúng phiên bản báo giá hiện hành trước khi đặt hàng' });
    }
    if (quote.acceptedTermsVersion !== DEPOSIT_TERMS_VERSION) {
      return res.status(400).json({ success: false, error: 'Chính sách cọc đã thay đổi — vui lòng chấp nhận lại báo giá' });
    }
    if (!quote.validUntil || quote.validUntil.getTime() <= now.getTime()) {
      return res.status(400).json({ success: false, error: 'Báo giá đã hết hạn — vui lòng nhắn shop để nhận báo giá mới' });
    }

    const bank = await getReceivingBank();
    if (!bank) return res.status(503).json({ success: false, error: 'Shop chưa cấu hình tài khoản nhận cọc, vui lòng liên hệ Luméa' });

    const goodsTotal = quote.total;
    const depositAmount = quote.deposit.amount;
    const shippingFee = resolveShippingFee(goodsTotal);
    const total = goodsTotal + shippingFee;
    const deadlineHours = Number(quote.policySnapshot?.depositPaymentDeadlineHours) || 24;
    const image = request.aiConceptImage || request.customerImages?.[0] || '';

    const items = quote.items.map((item, index) => ({
      id: `${request.requestCode}-V${quote.version}-${index + 1}`,
      product: {
        id: `quote:${quote._id}:${index}`,
        name: item.name,
        description: item.description,
        materialInfo: item.material,
        dimensions: item.size,
        images: image ? [image] : [],
        categoryName: 'Đặt làm theo yêu cầu',
        productionType: 'PRINT_ON_DEMAND',
        isCustomQuote: true,
      },
      quantity: item.quantity,
      selectedCustomization: null,
      unitPrice: item.unitPrice,
      totalPrice: item.lineTotal,
    }));

    let order;
    for (let attempt = 0; attempt < 5 && !order; attempt++) {
      const orderNumber = generateOrderNumber();
      try {
        order = await Order.create({
          orderNumber,
          orderType: 'CUSTOM_QUOTE',
          paymentPolicyVersion: 2,
          userId: req.userId,
          createdAtLabel: nowLabel(),
          status: 'PENDING',
          phoneConfirmRequired: false,
          hasPrintOnDemandItems: true,
          items,
          shippingAddress: addr,
          paymentMethod: balanceMethod,
          paymentStatus: 'UNPAID',
          subtotal: quote.subtotal,
          discount: quote.itemDiscountTotal + quote.quoteDiscount,
          shippingFee,
          total,
          notes: String(req.body.notes || '').trim().slice(0, 500),
          stockReserved: false,
          customRequestRef: { requestId: request.id, requestCode: request.requestCode, quoteId: quote._id, quoteVersion: quote.version },
          depositStatus: 'UNPAID',
          depositReceived: 0,
          paymentPlan: {
            type: 'DEPOSIT',
            goodsSubtotal: quote.subtotal,
            goodsDiscount: quote.itemDiscountTotal + quote.quoteDiscount,
            goodsTotal,
            depositRate: quote.deposit.rate,
            depositMinimum: quote.deposit.minimum,
            depositAmount,
            depositOverridden: !!quote.deposit.overridden,
            depositOverrideReason: quote.deposit.overrideReason || '',
            shippingFee,
            remainingAmount: goodsTotal - depositAmount + shippingFee,
            balanceMethod,
            termsVersion: quote.acceptedTermsVersion,
            policySnapshot: quote.policySnapshot,
            bank,
            transferContent: `LUMEA COC ${orderNumber.replace('ORD-', '')}`,
            deadlineAt: new Date(now.getTime() + deadlineHours * HOUR),
          },
        });
      } catch (err) {
        if (err.code !== 11000) throw err;
        if (err.keyPattern?.['customRequestRef.quoteId']) {
          // Lần bấm song song khác đã tạo đơn cho báo giá này.
          const dup = await Order.findOne({ 'customRequestRef.quoteId': quote._id });
          return res.json({ success: true, existing: true, order: dup, payment: paymentInstructions(dup) });
        }
        if (!err.keyPattern?.orderNumber) throw err;
      }
    }
    if (!order) throw new Error('Không tạo được mã đơn hàng, vui lòng thử lại');

    request.status = 'CONVERTED_TO_ORDER';
    request.orderNumber = order.orderNumber;
    request.updatedAt = now.toLocaleDateString('vi-VN');
    pushShopMessage(request, `Đã tạo đơn ${order.orderNumber}. Vui lòng chuyển khoản tiền cọc ${depositAmount.toLocaleString('vi-VN')}đ với nội dung "${order.paymentPlan.transferContent}" trước hạn để shop bắt đầu sản xuất.`);
    await request.save();

    res.json({ success: true, existing: false, order, payment: paymentInstructions(order) });
  } catch (err) {
    console.error('custom checkout error', err);
    sendError(res, err);
  }
});

module.exports = router;
