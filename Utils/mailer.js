const { transporter } = require("../config/nodemailer");

const sendOTP = async (email, otp) => {
  return transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.MAIL_USER || "JSB Admin",
    to: email,
    subject: "JSB Admin Password Reset OTP",
    text: `Your JSB Admin password reset OTP is ${otp}. It is valid for 5 minutes.`,
    html: `<div style="font-family:Arial,sans-serif"><h2>JSB Admin Password Reset</h2><p>Your password reset OTP is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${otp}</p><p>This OTP is valid for <strong>5 minutes</strong>.</p><p>If you did not request a password reset, ignore this email.</p></div>`
  });
};
module.exports=sendOTP;
