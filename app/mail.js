const config = require('config');
const nodemailer = require('nodemailer');

let transporter;
const defaults = { from: 'no-reply@festu.se' };

if (process.env.NODE_ENV == 'test') {
  transporter = require('../test/util/mail');
} else {
  transporter = nodemailer.createTransport(config.mail.url, defaults);
}

function userInviteSingle(to, link) {
  const subject = 'Create user account';
  const text = `Welcome,\n\nFollow this link to setup your user account:\n\n${link}\n\nCheers,\nStreckU`;
  return transporter.sendMail({ to, subject, text });
}

function userInviteMultiple(to, link, capacity) {
  const subject = `Create user accounts (${capacity})`;
  const text = `Welcome,\n\nUse or share this link to setup your user accounts:\n\n${link}\n\nThe link can be used to create ${capacity} accounts.\n\nCheers,\nStreckU`;
  return transporter.sendMail({ to, subject, text });
}

module.exports = {
  userInvite(to, link, capacity) {
    return capacity > 1 ? userInviteMultiple(to, link, capacity) : userInviteSingle(to, link);
  },
  userActivate(to, link) {
    const subject = 'Activate your account';
    const text = `Hello,\n\nNearly there, follow this link to activate your user account and enter the world of krök:\n\n${link}\n\nCheers,\nStreckU`;
    return transporter.sendMail({ to, subject, text });
  },
  emailConfirm(to, link) {
    const subject = 'Confirm email address';
    const text = `Hello,\n\nPlease verify your email address by clicking the link below:\n\n${link}\n\nIf you didn't request an email update, you can ignore this message.\n\nCheers,\nStreckU`;
    return transporter.sendMail({ to, subject, text });
  },
  passwordReset(to, link) {
    const subject = 'Password reset';
    const text = `Hello,\n\nTo reset your password, please click the following link:\n\n${link}\n\nIf you don't want to reset your password, you can ignore this message.\n\nCheers,\nStreckU`;
    return transporter.sendMail({ to, subject, text });
  },
}