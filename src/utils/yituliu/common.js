export const AUTH_BASE = 'https://auth.yituliu.cn';

/**
 * 一图流接口业务错误
 */
export class YituliuError extends Error {
  /**
   * @param {number|string} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = 'YituliuError';
    this.code = code;
  }

  toString() {
    return `YituliuError: (${this.code}) ${this.message}`;
  }
}

/**
 * @typedef {object} CallApiOptions
 * @property {string} path
 * @property {Record<string, any>} [header]
 * @property {Record<string, any>} [query]
 * @property {Record<string, any>} [body]
 * @property {boolean} [json] 有 body 时为 true 则发送 JSON，否则为 form-urlencoded
 */

/**
 * 请求一图流接口。有 body 则为 POST；`json` 为 true 时发送 JSON。
 * @template T
 * @param {CallApiOptions} options
 * @returns {Promise<T>}
 */
export const callApi = async ({ path, header, query, body, json }) => {
  const url = new URL(path, AUTH_BASE);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value != null) url.searchParams.set(key, String(value));
    });
  }

  const hasBody = body != null;
  const res = await fetch(url, {
    method: hasBody ? 'POST' : 'GET',
    headers: {
      ...(hasBody
        ? { 'Content-Type': json ? 'application/json' : 'application/x-www-form-urlencoded' }
        : {}),
      ...header,
    },
    body: hasBody
      ? json
        ? JSON.stringify(body)
        : new URLSearchParams(body).toString()
      : undefined,
  });

  let jsonBody;
  try {
    jsonBody = await res.json();
  } catch {
    if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
    throw new Error(`${res.status}: invalid JSON response`);
  }

  if (jsonBody.code !== 200) {
    throw new YituliuError(jsonBody.code, jsonBody.msg);
  }

  return jsonBody.data;
};
