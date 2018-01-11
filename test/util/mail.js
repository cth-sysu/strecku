module.exports = {
  all: [],
  last: null,
  templateSender: function(mail, defaults) {
    return (header, data) => {
      let text = mail.text.replace(/{{.+}}/g, key => data[key.slice(2, -2)]);
      Object.assign(mail, {header, data, text});
      this.all.push(this.last = mail);
      return Promise.resolve();
    };
  },
  reset: function() {
    this.all = [];
    this.last = null;
    return Promise.resolve();
  }
}
