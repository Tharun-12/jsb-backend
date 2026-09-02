// nodemailer.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'iiiqbets01@gmail.com',
    pass: 'rava xoel gzai rkgx'
  },
  tls: {
    rejectUnauthorized: false
  }
});

const adminEmail = 'manitejavadnala@gmail.com';

// Verify transporter connection
transporter.verify((error, success) => {
  if (error) {
    console.error('Email transporter error:', error);
  } else {
    console.log('Email transporter ready to send messages');
  }
});

module.exports = {
  transporter,
  adminEmail
};