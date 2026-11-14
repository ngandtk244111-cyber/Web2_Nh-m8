// Tài khoản ngân hàng nhận tiền chuyển khoản (cọc đơn đặt làm). Ưu tiên cấu hình ở my-admin
// (AdminConfig key 'payment', chỉ quyền payments.config được sửa), thiếu thì dùng biến môi trường
// BANK_CODE / BANK_NAME / BANK_ACCOUNT_NUMBER / BANK_ACCOUNT_NAME. Không có cả hai thì không nhận cọc.
// Lúc tạo đơn, thông tin này được chụp vào đơn (paymentPlan.bank) — đổi tài khoản sau đó không ảnh hưởng đơn đang chờ.

const AdminConfig = require('../models/AdminConfig');

const BANK_FIELDS = ['bankCode', 'bankName', 'accountNumber', 'accountName'];

/** Chuẩn hoá + kiểm tra dữ liệu tài khoản; trả về { bank } hoặc { error }. */
function validateBankConfig(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'Dữ liệu tài khoản không hợp lệ' };
  const bank = {
    // Mã ngân hàng theo VietQR (BIN 6 số hoặc mã viết tắt, vd. 970436 / VCB).
    bankCode: String(raw.bankCode || '').trim().toUpperCase(),
    bankName: String(raw.bankName || '').trim().slice(0, 120),
    accountNumber: String(raw.accountNumber || '').replace(/\s/g, ''),
    accountName: String(raw.accountName || '').trim().toUpperCase().slice(0, 120),
  };
  if (!/^[A-Z0-9]{2,20}$/.test(bank.bankCode)) return { error: 'Mã ngân hàng (VietQR) không hợp lệ' };
  if (!bank.bankName) return { error: 'Vui lòng nhập tên ngân hàng' };
  if (!/^\d{6,20}$/.test(bank.accountNumber)) return { error: 'Số tài khoản gồm 6–20 chữ số' };
  if (!bank.accountName) return { error: 'Vui lòng nhập tên chủ tài khoản' };
  return { bank };
}

function bankFromEnv() {
  const { bank } = validateBankConfig({
    bankCode: process.env.BANK_CODE,
    bankName: process.env.BANK_NAME,
    accountNumber: process.env.BANK_ACCOUNT_NUMBER,
    accountName: process.env.BANK_ACCOUNT_NAME,
  });
  return bank || null;
}

/** Tài khoản nhận tiền hiện hành, hoặc null nếu chưa cấu hình. */
async function getReceivingBank() {
  const doc = await AdminConfig.findOne({ key: 'payment' }, { value: 1 }).lean();
  const { bank } = validateBankConfig(doc?.value?.bank || null);
  return bank || bankFromEnv();
}

/** Ảnh VietQR (dịch vụ công khai img.vietqr.io, không cần khoá). */
function vietQrImageUrl(bank, amount, content) {
  if (!bank) return '';
  const params = new URLSearchParams({ amount: String(amount), addInfo: content, accountName: bank.accountName });
  return `https://img.vietqr.io/image/${encodeURIComponent(bank.bankCode)}-${encodeURIComponent(bank.accountNumber)}-compact2.png?${params}`;
}

module.exports = { BANK_FIELDS, validateBankConfig, getReceivingBank, vietQrImageUrl };
