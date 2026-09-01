// https://github.com/oott123/sklanding/blob/master/src/utils/sign.ts
import md5 from 'js-md5';
import { once } from 'lodash';
import { v4 as uuid } from 'uuid';
import { PROXY_SERVER } from './env';
import { gmAvailable, gmJsonFetch } from './gmFetch';

const HYPERGRYPH_AS_HOST = 'https://as.hypergryph.com';
const SKLAND_ZONAI_HOST = 'https://zonai.skland.com';
const SKLAND_APP_CODE = '4ca99fa6b56cc2ba';
const HYPERGRYPH_USER_ORIGIN = 'https://user.hypergryph.com';

const AS_WEB_HEADERS = {
  Origin: HYPERGRYPH_USER_ORIGIN,
  Referer: `${HYPERGRYPH_USER_ORIGIN}/`,
};

const AS_JSON_HEADERS = {
  ...AS_WEB_HEADERS,
  'Content-Type': 'application/json',
};

const SCAN_STATUS_MAP = {
  0: 'confirmed',
  100: 'pending',
  101: 'scanned',
  102: 'expired',
};

const apiDid = uuid().toUpperCase();

function buf2hex(buffer) {
  return [...new Uint8Array(buffer)].map(x => x.toString(16).padStart(2, '0')).join('');
}

async function sign(path, token) {
  const timestamp = `${Math.floor(Date.now() / 1000)}`;
  const platform = '3';
  const dId = apiDid;
  const vName = '1.0.0';

  const headers = {
    dId,
    platform,
    timestamp,
    vName,
  };
  if (!token) {
    return headers;
  }

  const signPayload = `${path.replace(
    /\?/,
    '',
  )}${timestamp}{"platform":"${platform}","timestamp":"${timestamp}","dId":${JSON.stringify(
    dId,
  )},"vName":"${vName}"}`;

  const utf8encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    utf8encoder.encode(token),
    { name: 'HMAC', hash: 'SHA-256' },
    true,
    ['sign'],
  );
  const intPayload = await crypto.subtle.sign(
    { name: 'HMAC', hash: 'SHA-256' },
    key,
    utf8encoder.encode(signPayload),
  );

  const res = md5(buf2hex(intPayload));

  return {
    ...headers,
    Sign: res,
  };
}

class SklandError extends Error {
  /**
   * @param {string} message
   * @param {number} code
   */
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

export async function fetchSkland(path, cred, token, body) {
  const res = await fetch(`${SKLAND_ZONAI_HOST}${path}`, {
    ...(body
      ? {
          body: JSON.stringify(body),
          method: 'POST',
        }
      : {}),
    headers: {
      ...(cred ? { Cred: cred } : {}),
      ...(await sign(path, token)),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
  });

  const data = await res.json();

  if (data.code === 0) {
    return data.data;
  } else {
    throw new SklandError(data.message, data.code);
  }
}

/**
 * @param {string} token
 * @returns {{ cred: string, token: string }}
 */
export async function sklandOAuthLogin(token) {
  return gmAvailable() ? sklandOauthLoginByGm(token) : sklandOAuthLoginByProxy(token);
}

const sklandOAuthLoginByProxy = async token => {
  const res = await fetch(`${PROXY_SERVER}/skland/oauth_combine`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Did: await getDeviceId(),
    },
    body: JSON.stringify({ token }),
  });

  const data = await res.json();

  if (data.code !== 0) {
    throw new SklandError(data.message, data.code);
  }

  return data.data;
};

const sklandOauthLoginByGm = async token => {
  const oauthRes = await gmJsonFetch(`${HYPERGRYPH_AS_HOST}/user/oauth2/v2/grant`, {
    method: 'POST',
    headers: {
      'User-Agent':
        'Skland/1.5.1 (com.hypergryph.skland; build:100501001; Android 34; ) Okhttp/4.11.0',
      'Content-Type': 'application/json',
      Connection: 'close',
    },
    body: JSON.stringify({
      appCode: SKLAND_APP_CODE,
      type: 0,
      token,
    }),
  });
  if (oauthRes.status !== 0) {
    throw new SklandError(oauthRes.msg, oauthRes.status);
  }

  const credRes = await gmJsonFetch(`${SKLAND_ZONAI_HOST}/web/v1/user/auth/generate_cred_by_code`, {
    body: JSON.stringify({
      code: oauthRes.data.code,
      kind: 1,
    }),
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      referer: 'https://www.skland.com/',
      origin: 'https://www.skland.com',
      dId: await getDeviceId(),
      platform: '3',
      timestamp: `${Math.floor(Date.now() / 1000)}`,
      vName: '1.0.0',
    },
  });
  if (credRes.code !== 0) {
    throw new SklandError(credRes.message, credRes.code);
  }
  return credRes.data;
};

/**
 * @param {SklandError} err
 */
export function isCredTokenExpiredError(err) {
  return err.code === 10000;
}

/**
 * @param {SklandError} err
 */
export function isNotLoginError(err) {
  return err.code === 10002;
}

/**
 * @returns {Promise<{ scanId: string, scanUrl: string }>}
 */
export async function sklandCreateScan() {
  const res = await gmJsonFetch(`${HYPERGRYPH_AS_HOST}/general/v1/gen_scan/login`, {
    method: 'POST',
    headers: AS_JSON_HEADERS,
    body: JSON.stringify({ appCode: SKLAND_APP_CODE }),
  });
  if (res.status !== 0) {
    throw new SklandError(res.msg, res.status);
  }
  const scanId = res.data?.scanId;
  if (!scanId) {
    throw new SklandError(res.msg || '获取二维码失败', res.status);
  }
  return {
    scanId,
    scanUrl: res.data.scanUrl || `hypergryph://scan_login?scanId=${encodeURIComponent(scanId)}`,
  };
}

/**
 * @param {string} scanId
 * @returns {Promise<{ state: 'pending' | 'scanned' | 'expired' | 'confirmed', scanCode?: string }>}
 */
export async function sklandGetScanStatus(scanId) {
  const res = await gmJsonFetch(
    `${HYPERGRYPH_AS_HOST}/general/v1/scan_status?scanId=${encodeURIComponent(scanId)}`,
    {
      method: 'GET',
      headers: AS_WEB_HEADERS,
    },
  );
  const state = SCAN_STATUS_MAP[res.status];
  if (!state) {
    throw new SklandError(res.msg, res.status);
  }
  if (state !== 'confirmed') {
    return { state };
  }
  const scanCode = res.data?.scanCode;
  if (!scanCode) {
    throw new SklandError(res.msg || '未返回扫码授权码', res.status);
  }
  return { state, scanCode };
}

/**
 * @param {string} scanCode
 * @returns {Promise<string>}
 */
export async function sklandTokenByScanCode(scanCode) {
  const res = await gmJsonFetch(`${HYPERGRYPH_AS_HOST}/user/auth/v1/token_by_scan_code`, {
    method: 'POST',
    headers: AS_JSON_HEADERS,
    body: JSON.stringify({ scanCode }),
  });
  if (res.status !== 0) {
    throw new SklandError(res.msg, res.status);
  }
  const token = res.data?.token;
  if (!token) {
    throw new SklandError(res.msg || '获取 token 失败', res.status);
  }
  return token;
}

const loadSmSdk = once(() => {
  const { promise, resolve, reject } = Promise.withResolvers();
  window._smReadyFuncs = [resolve];
  window._smConf = {
    organization: 'UWXspnCCJN4sfYlNfqps',
    appId: 'default',
    publicKey:
      'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCmxMNr7n8ZeT0tE1R9j/mPixoinPkeM+k4VGIn/s0k7N5rJAfnZ0eMER+QhwFvshzo0LNmeUkpR8uIlU/GEVr8mN28sKmwd2gpygqj0ePnBmOW4v0ZVwbSYK+izkhVFk2V/doLoMbWy6b+UnA8mkjvg0iYWRByfRsK2gdl7llqCwIDAQAB',
    protocol: 'https',
  };
  import(/* webpackIgnore: true */ 'https://static.portal101.cn/dist/web/v3.0.0/fp.min.js').catch(
    reject,
  );
  return promise;
});

const getDeviceId = once(async () => {
  await loadSmSdk();
  return window.SMSdk.getDeviceId();
});
