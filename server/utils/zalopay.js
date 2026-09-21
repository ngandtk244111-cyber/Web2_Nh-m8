const crypto = require('crypto');
const axios = require('axios');

function hmacSha256(data, key) {
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

function formatAppTransId() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const uniqueId = Date.now().toString().slice(-6);
  return `${yy}${mm}${dd}_${uniqueId}`;
}

/**
 * Tạo đơn hàng ZaloPay trên môi trường sandbox.
 * Tài liệu: https://docs.zalopay.vn/v2/general/overview.html
 */
async function createZaloPayOrder({ orderId, amount, description }) {
  const appId = Number(process.env.ZALOPAY_APP_ID);
  const key1 = process.env.ZALOPAY_KEY1;
  const redirectUrl = process.env.ZALOPAY_REDIRECT_URL;

  const appTransId = formatAppTransId();
  const appTime = Date.now();
  const embedData = JSON.stringify({ redirecturl: redirectUrl, orderId });
  const items = JSON.stringify([]);

  const order = {
    app_id: appId,
    app_trans_id: appTransId,
    app_user: 'deco3d_user',
    app_time: appTime,
    amount,
    item: items,
    embed_data: embedData,
    description: description || `Thanh toan don hang Luméa #${orderId}`,
    bank_code: '',
  };

  const rawSignature = `${order.app_id}|${order.app_trans_id}|${order.app_user}|${order.amount}|${order.app_time}|${order.embed_data}|${order.item}`;
  order.mac = hmacSha256(rawSignature, key1);

  const { data } = await axios.post(process.env.ZALOPAY_ENDPOINT, null, { params: order });
  return { ...data, app_trans_id: appTransId };
}

/** Verify the mac ZaloPay sends back in the server-to-server callback. */
function verifyZaloPayCallbackMac(dataStr, reqMac) {
  const key2 = process.env.ZALOPAY_KEY2;
  const expected = hmacSha256(dataStr, key2);
  return expected === reqMac;
}

module.exports = { createZaloPayOrder, verifyZaloPayCallbackMac };
