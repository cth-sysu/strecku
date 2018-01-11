const nodemailer = require('nodemailer');
const mailgun = require('nodemailer-mailgun-transport');

let transporter;

if (process.env.NODE_ENV == 'test') {
  transporter = require('../test/util/mail');
} else {
  transporter = nodemailer.createTransport(mailgun({
    auth: {
      api_key: process.env.STRECKUMAILGUNKEY,
      domain: process.env.STRECKUMAILGUNDOMAIN
    }
  }));
}
const defaults = {from: 'no-reply@festu.se'};

const user_invite = {
  single: transporter.templateSender({
    subject: 'Create user account',
    text: "Welcome,\n\nFollow this link to setup your user account:\n\n{{link}}\n\nCheers,\nStreckU",
  }, defaults),
  multi: transporter.templateSender({
    subject: 'Create user accounts ({{capacity}})',
    text: "Welcome,\n\nUse or share this link to setup your user accounts:\n\n{{link}}\n\nThe link can be used to create {{capacity}} accounts.\n\nCheers,\nStreckU",
  }, defaults)
};

module.exports = {
  userInvite(capacity, ...args) {
    return capacity > 1 ? user_invite.multi(...args) : user_invite.single(...args);
  },
  userActivate: transporter.templateSender({
    subject: 'Activate your account',
    text: "Hello,\n\nNearly there, follow this link to activate your user account and enter the world of krök:\n\n{{link}}\n\nCheers,\nStreckU",
  }, defaults),
  emailConfirm: transporter.templateSender({
    subject: 'Confirm email address',
    text: "Hello,\n\nPlease verify your email address by clicking the link below:\n\n{{link}}\n\nIf you didn't request an email update, you can ignore this message.\n\nCheers,\nStreckU",
  }, defaults),
  passwordReset: transporter.templateSender({
    subject: 'Password reset',
    text: "Hello,\n\nTo reset your password, please click the following link:\n\n{{link}}\n\nIf you don't want to reset your password, you can ignore this message.\n\nCheers,\nStreckU",
  }, defaults)
}