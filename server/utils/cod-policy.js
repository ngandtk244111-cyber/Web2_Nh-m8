// Đơn COD có cần nhân viên gọi xác nhận trước khi giao không

const AdminConfig = require('../models/AdminConfig');

const DEFAULT_THRESHOLD = 500000;

/** Ngưỡng lấy từ Cài đặt của my-admin (settings.codConfirmThreshold); 0 = đơn COD nào cũng phải gọi. */
async function codConfirmThreshold() {
  const doc = await AdminConfig.findOne({ key: 'settings' }, { value: 1 }).lean();
  const value = Number(doc?.value?.codConfirmThreshold);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_THRESHOLD;
}

async function codNeedsPhoneConfirm(total, hasPrintOnDemandItems) {
  if (hasPrintOnDemandItems) return true;
  return total >= (await codConfirmThreshold());
}

module.exports = { codNeedsPhoneConfirm, DEFAULT_THRESHOLD };
