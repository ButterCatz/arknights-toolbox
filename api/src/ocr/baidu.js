const Auth = require('@baiducloud/sdk/src/auth');
const qs = require('querystring');

const { BAIDUBCE_API_KEY, BAIDUBCE_SECRET_KEY } = process.env;

module.exports = async image => {
  const auth = new Auth(BAIDUBCE_API_KEY, BAIDUBCE_SECRET_KEY);
  const now = new Date();

  const method = 'POST';
  const uri = '/rest/2.0/ocr/v1/general_basic';
  const headers = {
    host: 'aip.baidubce.com',
    'content-type': 'application/x-www-form-urlencoded',
  };

  const authorization = auth.generateAuthorization(method, uri, {}, headers, now.getTime() / 1000);

  return fetch(`https://${headers.host}${uri}`, {
    body: qs.stringify({ image }),
    headers: {
      ...headers,
      'x-bce-date': now.toISOString(),
      authorization,
    },
    method,
  }).then(r => r.json());
};
