import { YITULIU_CLIENT_ID } from '@/utils/env';
import { AUTH_BASE, callApi } from './common';

export { YituliuError } from './common';
const PKCE_STORAGE_KEY = 'uc.oauth.pkce';

/**
 * 清除会话中保存的 PKCE 参数
 */
export const removePkceStorage = () => {
  sessionStorage.removeItem(PKCE_STORAGE_KEY);
};

/**
 * @typedef {object} TokenData
 * @property {string} access_token
 * @property {string} token_type
 * @property {number} expires_in 有效期（秒）
 * @property {string} [refresh_token] 仅换码响应可能包含
 * @property {string} [scope]
 */

/**
 * @typedef {object} RefreshTokenData
 * @property {string} access_token
 * @property {string} token_type
 * @property {number} expires_in 有效期（秒）
 */

/**
 * @typedef {object} UserInfo
 * @property {number} uid
 * @property {string|null} userName
 * @property {string|null} nickname
 * @property {string|null} avatar
 */

/**
 * @typedef {object} PkceSession
 * @property {string} state
 * @property {string} codeVerifier
 * @property {string} redirectUri
 */

/**
 * @typedef {object} PkceParameters
 * @property {string} state
 * @property {string} codeVerifier
 * @property {string} codeChallenge
 * @property {string} codeChallengeMethod
 */

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
const toBase64Url = bytes => {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
};

/**
 * @param {number} byteLength
 * @returns {string}
 */
const randomBase64Url = byteLength =>
  toBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));

/**
 * 生成本次授权所需的 state 与 PKCE 参数
 * @returns {Promise<PkceParameters>}
 */
const createPkceParameters = async () => {
  const state = randomBase64Url(32);
  const codeVerifier = randomBase64Url(64);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));

  return {
    state,
    codeVerifier,
    codeChallenge: toBase64Url(new Uint8Array(digest)),
    codeChallengeMethod: 'S256',
  };
};

/**
 * 读取并解析当前会话中保存的 PKCE 参数
 * @returns {PkceSession|null}
 */
const readPkceSession = () => {
  const raw = sessionStorage.getItem(PKCE_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/**
 * 校验回调 state 是否与会话中保存值完全一致
 * @param {string} state
 * @returns {boolean}
 */
export const validateState = state => {
  const session = readPkceSession();
  return !!session && session.state === state;
};

/**
 * 生成安全参数、写入会话并跳转至 OAuth 授权端点
 * @param {object} [options]
 * @param {string} [options.redirectUri] 已登记的精确回调地址，默认 `${location.origin}/`
 * @param {string} [options.scope] 逗号分隔的已批准范围子集；不传则使用全部范围
 * @returns {Promise<void>}
 */
export const startAuthorization = async ({ redirectUri = `${location.origin}/`, scope } = {}) => {
  const pkce = await createPkceParameters();

  sessionStorage.setItem(
    PKCE_STORAGE_KEY,
    JSON.stringify({
      state: pkce.state,
      codeVerifier: pkce.codeVerifier,
      redirectUri,
    }),
  );

  const url = new URL('/oauth2/authorize', AUTH_BASE);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', YITULIU_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', pkce.state);
  url.searchParams.set('code_challenge', pkce.codeChallenge);
  url.searchParams.set('code_challenge_method', pkce.codeChallengeMethod);
  if (scope) url.searchParams.set('scope', scope);

  location.assign(url.toString());
};

/**
 * 校验 state 后用授权码兑换令牌，并立即清除会话中的 PKCE 参数
 * @param {object} options
 * @param {string} options.code 回调带回的授权码
 * @param {string} options.state 回调带回的 state，须与会话中保存值完全一致
 * @param {string} [options.redirectUri] 覆盖会话中的回调地址，须与发起授权时完全一致
 * @returns {Promise<TokenData>}
 */
export const exchangeToken = async ({ code, state, redirectUri }) => {
  const session = readPkceSession();

  try {
    if (!session || session.state !== state) {
      throw new Error('state mismatch');
    }

    return await callApi({
      path: '/oauth2/token',
      body: {
        grant_type: 'authorization_code',
        client_id: YITULIU_CLIENT_ID,
        code,
        redirect_uri: redirectUri ?? session.redirectUri,
        code_verifier: session.codeVerifier,
      },
    });
  } finally {
    removePkceStorage();
  }
};

/**
 * 使用 access token 获取当前已授权用户的公开资料
 * @param {string} accessToken
 * @returns {Promise<UserInfo>}
 */
export const getUserInfo = accessToken =>
  callApi({
    path: '/oauth2/userinfo',
    header: { Authorization: `Bearer ${accessToken}` },
  });

/**
 * 使用固定 refresh token 签发新的 access token。refresh token 不轮换、响应中不返回
 * @param {string} token
 * @returns {Promise<RefreshTokenData>}
 */
export const refreshToken = token =>
  callApi({
    path: '/oauth2/token',
    body: {
      grant_type: 'refresh_token',
      client_id: YITULIU_CLIENT_ID,
      refresh_token: token,
    },
  });

/**
 * 吊销 access token 或 refresh token。吊销 refresh token 时关联的 access token 会同时失效
 * @param {string} token
 * @returns {Promise<null>}
 */
export const revokeToken = token =>
  callApi({
    path: '/oauth2/revoke',
    body: {
      client_id: YITULIU_CLIENT_ID,
      token,
    },
  });
