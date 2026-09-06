import { callApi } from './common';

/**
 * @typedef {object} ConfigItem
 * @property {number} id
 * @property {string} clientId
 * @property {string} category
 * @property {string} version
 * @property {string} name
 * @property {string|null} source
 * @property {string|null} note
 * @property {any} config
 * @property {string} hash
 * @property {string} createTime
 * @property {string} updateTime
 */

/**
 * @typedef {object} SaveConfigResult
 * @property {number} id
 * @property {string} hash
 */

/**
 * @param {string} accessToken
 * @returns {Record<string, string>}
 */
const authHeader = accessToken => ({ Authorization: `Bearer ${accessToken}` });

/**
 * 按分类、版本、名称列出当前客户端名下的配置
 * @param {object} options
 * @param {string} options.accessToken
 * @param {string} options.category
 * @param {string} [options.version]
 * @param {string} [options.name]
 * @returns {Promise<ConfigItem[]>}
 */
export const listConfigs = ({ accessToken, category, version, name }) =>
  callApi({
    path: '/oauth2/config/list',
    header: authHeader(accessToken),
    query: { category, version, name },
  });

/**
 * 保存配置。有 id 则为更新，否则创建。不传 expectedHash，直接覆盖云端
 * @param {object} options
 * @param {string} options.accessToken
 * @param {number} [options.id]
 * @param {string} options.category
 * @param {string} options.version
 * @param {string} options.name
 * @param {Record<string, any>} options.config
 * @returns {Promise<SaveConfigResult>}
 */
export const saveConfig = ({ accessToken, id, category, version, name, config }) =>
  callApi({
    path: '/oauth2/config/save',
    header: authHeader(accessToken),
    json: true,
    body: {
      ...(id != null ? { id } : {}),
      category,
      version,
      name,
      config,
    },
  });
