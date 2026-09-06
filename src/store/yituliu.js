import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { useNamespacedLocalStorage } from '@/utils/NamespacedLocalStorage';
import {
  startAuthorization as oauthStartAuthorization,
  exchangeToken as oauthExchangeToken,
  getUserInfo as oauthGetUserInfo,
  refreshToken as oauthRefreshToken,
  revokeToken as oauthRevokeToken,
} from '@/utils/yituliu/oauth';
import { YituliuError } from '@/utils/yituliu/common';
import { listConfigs, saveConfig } from '@/utils/yituliu/config';
import snackbar from '@/utils/snackbar';
import { t } from '@/i18n';

export const CONFIG_CATEGORY = 'toolboxCloudSync';
export const CONFIG_VERSION = 'v1';

/**
 * default 原样；其他账号去掉 uuid 连字符以适配 name 32 字符限制
 * @param {string} id
 * @returns {string}
 */
export const toConfigName = id => (id === 'default' ? id : id.replaceAll('-', ''));

const DEFAULT_STORAGE = {
  accessToken: '',
  refreshToken: '',
  expiresAt: 0,
};

const EXPIRE_SKEW_MS = 5 * 60 * 1000;

export const useYituliuStore = defineStore('yituliu', () => {
  const storage = useNamespacedLocalStorage('yituliu', DEFAULT_STORAGE);
  const { accessToken, refreshToken, expiresAt } = storage;

  /** @type {import('vue').Ref<import('@/utils/yituliu/oauth').UserInfo|null>} */
  const userInfo = ref(null);

  /** @type {Map<string, number>} */
  const configIdByName = new Map();

  const isLoggedIn = computed(() => !!accessToken.value);

  const reset = () => {
    accessToken.value = DEFAULT_STORAGE.accessToken;
    refreshToken.value = DEFAULT_STORAGE.refreshToken;
    expiresAt.value = DEFAULT_STORAGE.expiresAt;
    userInfo.value = null;
    configIdByName.clear();
  };

  /**
   * @param {import('@/utils/yituliu/config').ConfigItem[]} list
   * @returns {import('@/utils/yituliu/config').ConfigItem|null}
   */
  const pickLatest = list => {
    if (!list?.length) return null;
    return list.reduce((latest, item) =>
      !latest || item.updateTime > latest.updateTime ? item : latest,
    );
  };

  /**
   * @param {import('@/utils/yituliu/oauth').RefreshTokenData} data
   */
  const applyAccessToken = data => {
    accessToken.value = data.access_token;
    expiresAt.value = Date.now() + data.expires_in * 1000 - EXPIRE_SKEW_MS;
  };

  /**
   * @param {import('@/utils/yituliu/oauth').TokenData} data
   */
  const applyTokenData = data => {
    applyAccessToken(data);
    if (data.refresh_token) refreshToken.value = data.refresh_token;
  };

  const isAccessExpired = e => e instanceof YituliuError && e.code === 80001;
  const isRefreshRevoked = e => e instanceof YituliuError && e.code === 90009;

  const throwLoginExpired = () => {
    reset();
    throw new YituliuError(90009, t('cultivate.snackbar.yituliuLoginExpired'));
  };

  const refreshAccessToken = async () => {
    if (!refreshToken.value) throwLoginExpired();
    try {
      applyAccessToken(await oauthRefreshToken(refreshToken.value));
    } catch (e) {
      if (isRefreshRevoked(e)) throwLoginExpired();
      throw e;
    }
  };

  /**
   * @template T
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  const callAuthedApi = async fn => {
    if (Date.now() >= expiresAt.value) await refreshAccessToken();
    try {
      return await fn();
    } catch (e) {
      if (!isAccessExpired(e)) throw e;
      await refreshAccessToken();
      return fn();
    }
  };

  /**
   * @template T
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  const withYituliuSnack = async fn => {
    try {
      return await fn();
    } catch (e) {
      snackbar({
        message: String(e),
        ...(isRefreshRevoked(e) ? { timeout: 0 } : {}),
      });
      throw e;
    }
  };

  const startAuthorization = () => oauthStartAuthorization();

  /**
   * @param {object} options
   * @param {string} options.code
   * @param {string} options.state
   */
  const exchangeToken = async ({ code, state }) => {
    const data = await oauthExchangeToken({ code, state });
    applyTokenData(data);
    return data;
  };

  const refreshTokenFn = () => withYituliuSnack(refreshAccessToken);

  const revokeToken = async () => {
    try {
      const token = refreshToken.value || accessToken.value;
      if (token) await oauthRevokeToken(token);
    } finally {
      reset();
    }
  };

  const getUserInfo = async () => {
    if (userInfo.value) return userInfo.value;
    return withYituliuSnack(() =>
      callAuthedApi(async () => {
        userInfo.value = await oauthGetUserInfo(accessToken.value);
        return userInfo.value;
      }),
    );
  };

  /**
   * @param {string} name
   * @param {Record<string, any>} config
   */
  const saveCloudSync = (name, config) =>
    withYituliuSnack(() =>
      callAuthedApi(async () => {
        let id = configIdByName.get(name);
        if (id == null) {
          const latest = pickLatest(
            await listConfigs({
              accessToken: accessToken.value,
              category: CONFIG_CATEGORY,
              version: CONFIG_VERSION,
              name,
            }),
          );
          if (latest) id = latest.id;
        }
        const data = await saveConfig({
          accessToken: accessToken.value,
          ...(id != null ? { id } : {}),
          category: CONFIG_CATEGORY,
          version: CONFIG_VERSION,
          name,
          config,
        });
        configIdByName.set(name, data.id);
        return data;
      }),
    );

  /**
   * @param {string} name
   * @returns {Promise<import('@/utils/yituliu/config').ConfigItem|null>}
   */
  const restoreCloudSync = name =>
    withYituliuSnack(() =>
      callAuthedApi(async () => {
        const latest = pickLatest(
          await listConfigs({
            accessToken: accessToken.value,
            category: CONFIG_CATEGORY,
            version: CONFIG_VERSION,
            name,
          }),
        );
        if (latest) configIdByName.set(name, latest.id);
        return latest;
      }),
    );

  return {
    accessToken,
    expiresAt,
    userInfo,
    isLoggedIn,
    reset,
    startAuthorization,
    exchangeToken,
    refreshToken: refreshTokenFn,
    revokeToken,
    getUserInfo,
    callAuthedApi,
    withYituliuSnack,
    saveCloudSync,
    restoreCloudSync,
  };
});
