import { readonly, ref } from 'vue';
import lib from '@arkntools/userscript-extension';

export const useGmAvailable = () => {
  const available = ref(lib.available());
  if (!available.value) {
    lib.waitAvailable().then(() => {
      available.value = true;
    });
  }
  return readonly(available);
};

export const gmAvailable = () => lib.available();

/**
 * @param {string} url
 * @param {Pick<RequestInit, 'method' | 'headers' | 'body'>} options
 * @returns
 */
export const gmJsonFetch = (url, options = {}) => {
  if (!lib.available()) throw new Error('ArknTools extension is not available');
  const { method, headers, body } = options;
  return new Promise((resolve, reject) => {
    lib.request({
      url,
      method,
      headers,
      data: body,
      fetch: true,
      responseType: 'json',
      onload: res => {
        // eslint-disable-next-line no-console
        console.log('[GMFetch]', url, options, res);
        resolve(res.response);
      },
      onerror: res => {
        console.error('[GMFetch]', url, options, res);
        reject(res.error);
      },
    });
  });
};
