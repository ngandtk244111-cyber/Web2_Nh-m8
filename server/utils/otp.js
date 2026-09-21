function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Chỗ cắm SMS provider thật (Twilio, eSMS, SpeedSMS...) sau này.
 * Ở chế độ OTP_DEV_MODE=true, hàm này không gửi gì cả — mã OTP được trả thẳng
 * về response (devOtp) để test, giống cách AuraPC làm ở môi trường dev.
 */
async function sendOtpSms(phoneNumber, code) {
  if (process.env.OTP_DEV_MODE === 'true') {
    console.log(`[DEV OTP] Gửi mã ${code} tới số ${phoneNumber} (giả lập, không gửi SMS thật)`);
    return;
  }
  throw new Error('Chưa cấu hình nhà cung cấp SMS thật. Đặt OTP_DEV_MODE=true để test, hoặc bổ sung provider vào utils/otp.js.');
}

module.exports = { generateOtpCode, sendOtpSms };
