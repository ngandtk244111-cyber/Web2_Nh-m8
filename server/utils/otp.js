const axios = require('axios');
const nodemailer = require('nodemailer');

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isDevMode() {
  return process.env.OTP_DEV_MODE === 'true';
}

// ===================== EMAIL (Gmail SMTP qua Nodemailer) =====================

let mailTransporter = null;

function isEmailConfigured() {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getMailTransporter() {
  if (!mailTransporter) {
    // Mặc định Gmail (smtp.gmail.com:465). SMTP_PASS là "Mật khẩu ứng dụng" 16 ký tự của Google,
    // KHÔNG phải mật khẩu Gmail thường. Đổi SMTP_HOST/SMTP_PORT nếu dùng nhà cung cấp khác.
    const port = Number(process.env.SMTP_PORT || 465);
    mailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return mailTransporter;
}

function otpEmailHtml(code) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #eee;border-radius:16px">
    <h2 style="margin:0 0 8px;color:#A3152D;letter-spacing:2px">LUMÉA</h2>
    <p style="color:#333;font-size:14px">Mã xác thực của bạn là:</p>
    <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#111;margin:12px 0">${code}</p>
    <p style="color:#666;font-size:13px">Mã có hiệu lực trong 5 phút. Không chia sẻ mã này cho bất kỳ ai, kể cả nhân viên Luméa.</p>
    <p style="color:#999;font-size:12px;margin-top:24px">Nếu bạn không yêu cầu mã này, hãy bỏ qua email.</p>
  </div>`;
}

/**
 * Gửi OTP qua email. Trả về true nếu đã gửi thật, false nếu đang chạy dev mode chưa cấu hình
 * SMTP (khi đó mã được trả về qua devOtp để test). Đã cấu hình SMTP thì luôn gửi thật.
 */
async function sendOtpEmail(email, code) {
  if (isEmailConfigured()) {
    try {
      await getMailTransporter().sendMail({
        from: process.env.MAIL_FROM || `"Luméa" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `${code} là mã xác thực Luméa của bạn`,
        text: `Mã xác thực Luméa của bạn là ${code}. Mã có hiệu lực trong 5 phút. Không chia sẻ mã này cho bất kỳ ai.`,
        html: otpEmailHtml(code),
      });
    } catch (err) {
      console.error('send OTP email failed', err.message);
      throw new Error('Không gửi được email, vui lòng thử lại sau.');
    }
    return true;
  }
  if (isDevMode()) {
    console.log(`[DEV OTP] Gửi mã ${code} tới email ${email} (chưa cấu hình SMTP, không gửi thật)`);
    return false;
  }
  throw new Error('Chưa cấu hình gửi email (SMTP_USER/SMTP_PASS). Đặt OTP_DEV_MODE=true để test.');
}

// ===================== SMS (eSMS.vn) =====================

function isSmsConfigured() {
  return !!(process.env.ESMS_API_KEY && process.env.ESMS_SECRET_KEY);
}

/**
 * Gửi OTP qua SMS bằng eSMS.vn (tin nhắn Brandname CSKH). Nội dung tin phải khớp mẫu đã đăng ký
 * với eSMS — đặt qua ESMS_TEMPLATE, {code} sẽ được thay bằng mã OTP. Cùng quy ước trả về như
 * sendOtpEmail: true = đã gửi thật, false = dev mode chưa cấu hình.
 */
async function sendOtpSms(phoneNumber, code) {
  if (isSmsConfigured()) {
    const template = process.env.ESMS_TEMPLATE || '{code} la ma xac minh dang ky Baotrixemay cua ban';
    let data;
    try {
      ({ data } = await axios.post(
        'https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/',
        {
          ApiKey: process.env.ESMS_API_KEY,
          SecretKey: process.env.ESMS_SECRET_KEY,
          Brandname: process.env.ESMS_BRANDNAME || 'Baotrixemay',
          SmsType: '2',
          IsUnicode: '0',
          Phone: phoneNumber,
          Content: template.replace('{code}', code),
        },
        { timeout: 15000 }
      ));
    } catch (err) {
      console.error('eSMS request failed', err.message);
    }
    // CodeResult "100" = eSMS đã nhận tin; mã khác (sai key, hết tiền, sai mẫu...) xem log.
    if (String(data?.CodeResult) !== '100') {
      if (data) console.error('eSMS send failed', data);
      throw new Error('Không gửi được SMS, vui lòng thử lại sau.');
    }
    return true;
  }
  if (isDevMode()) {
    console.log(`[DEV OTP] Gửi mã ${code} tới số ${phoneNumber} (chưa cấu hình eSMS, không gửi SMS thật)`);
    return false;
  }
  throw new Error('Chưa cấu hình nhà cung cấp SMS (ESMS_API_KEY/ESMS_SECRET_KEY). Đặt OTP_DEV_MODE=true để test.');
}

module.exports = { generateOtpCode, sendOtpSms, sendOtpEmail };
