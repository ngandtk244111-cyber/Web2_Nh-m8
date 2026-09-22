const crypto = require('crypto');
const axios = require('axios');

function sign(rawSignature, secretKey) {
  return crypto.createHmac('sha256', secretKey).update(rawSignature).digest('hex');
}

/**
 * Tạo yêu cầu thanh toán MoMo trên môi trường sandbox — hỗ trợ cả ví MoMo (captureWallet) lẫn
 * thẻ ATM nội địa qua cổng MoMo (payWithATM, tham khảo AuraPC-main). Cùng 1 cổng thanh toán,
 * chỉ khác requestType gửi sang MoMo.
 * Tài liệu: https://developers.momo.vn/v3/docs/payment/api/wallet/onetime
 */
async function createMomoPayment({ orderId, amount, orderInfo, requestType = 'captureWallet' }) {
  const partnerCode = process.env.MOMO_PARTNER_CODE;
  const accessKey = process.env.MOMO_ACCESS_KEY;
  const secretKey = process.env.MOMO_SECRET_KEY;
  const redirectUrl = process.env.MOMO_REDIRECT_URL;
  const ipnUrl = process.env.MOMO_IPN_URL;

  const requestId = `${orderId}-${Date.now()}`;
  const extraData = '';

  const rawSignature =
    `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}` +
    `&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${partnerCode}` +
    `&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

  const signature = sign(rawSignature, secretKey);

  const body = {
    partnerCode,
    partnerName: 'Luméa Studio',
    storeId: 'LuméaStore',
    requestId,
    amount: String(amount),
    orderId,
    orderInfo,
    redirectUrl,
    ipnUrl,
    lang: 'vi',
    extraData,
    requestType,
    signature,
  };

  const { data } = await axios.post(process.env.MOMO_ENDPOINT, body);
  return data;
}

/** Verify the signature MoMo sends back in the IPN callback body. */
function verifyMomoIpnSignature(body) {
  const secretKey = process.env.MOMO_SECRET_KEY;
  const {
    accessKey = process.env.MOMO_ACCESS_KEY, amount, extraData, message,
    orderId, orderInfo, orderType, partnerCode, payType, requestId,
    responseTime, resultCode, transId, signature,
  } = body;

  const rawSignature =
    `accessKey=${accessKey}&amount=${amount}&extraData=${extraData}&message=${message}` +
    `&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}` +
    `&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}` +
    `&resultCode=${resultCode}&transId=${transId}`;

  const expected = sign(rawSignature, secretKey);
  return expected === signature;
}

module.exports = { createMomoPayment, verifyMomoIpnSignature };
