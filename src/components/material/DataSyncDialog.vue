<template>
  <div class="data-sync mdui-dialog mdui-typo" ref="dialogRef">
    <div class="mdui-dialog-title">{{ $t('cultivate.panel.sync.cloudSync') }}</div>
    <div class="mdui-dialog-content mdui-p-b-0">
      <div
        v-if="showSyncServiceSelect"
        class="mdui-valign mdui-m-t-1 mdui-m-b-2"
        :style="{ gap: '8px 24px' }"
      >
        <span>{{ $t('cultivate.panel.sync.syncService') }}</span>
        <mdui-radio-group
          v-model="parent.globalSetting.syncService"
          :options="syncServiceOptions"
          @change="dialog.handleUpdateNextTick()"
        />
      </div>
      <div v-if="isYituliu" key="yituliu" class="mdui-m-b-3">
        <button
          v-if="!isLoggedIn"
          class="mdui-btn mdui-ripple"
          v-theme-class="$root.color.pinkBtn"
          @click="yituliuStore.startAuthorization()"
          >{{ $t('cultivate.panel.sync.loginWithYituliu') }}</button
        >
        <div v-else class="yituliu-user mdui-valign">
          <mdui-spinner v-if="!userInfo" />
          <template v-else>
            <button
              class="mdui-btn mdui-ripple mdui-m-r-2"
              v-theme-class="$root.color.redBtn"
              @click="yituliuStore.revokeToken()"
              >{{ $t('cultivate.panel.sync.logout') }}</button
            >
            <span>{{ displayName }}</span>
          </template>
        </div>
      </div>
      <div
        class="mdui-valign-bottom space-8"
        :class="{
          processing: parent.dataSyncing,
          'mdui-m-b-1': isYituliu,
        }"
      >
        <button
          class="mdui-btn mdui-ripple"
          v-theme-class="['mdui-color-green-600', 'mdui-color-green-300 mdui-ripple-black']"
          :disabled="yituliuActionsDisabled"
          @click="parent.cloudSaveData()"
          ><i class="mdui-icon material-icons mdui-icon-left">cloud_upload</i
          >{{ $t('common.backup') }}</button
        >
        <button
          class="mdui-btn mdui-ripple"
          v-theme-class="['mdui-color-blue-600', 'mdui-color-blue-300 mdui-ripple-black']"
          @click="parent.cloudRestoreData()"
          :disabled="restoreDisabled"
          ><i class="mdui-icon material-icons mdui-icon-left">cloud_download</i
          >{{ $t('common.restore') }}</button
        >
        <mdui-switch v-model="parent.setting.autoSyncUpload" :disabled="restoreDisabled">{{
          $t('cultivate.panel.sync.autoSyncUpload')
        }}</mdui-switch>
      </div>
      <table v-if="!isYituliu" class="sync-options thin-table mdui-m-b-2" style="width: 100%">
        <tbody>
          <tr>
            <td>
              <div class="mdui-textfield">
                <label class="mdui-textfield-label">{{
                  $t('cultivate.panel.sync.syncCode')
                }}</label>
                <input
                  class="mdui-textfield-input"
                  type="text"
                  v-model.trim="parent.syncCode"
                  :disabled="parent.dataSyncing"
                />
              </div>
            </td>
            <td class="va-bottom" width="1">
              <button
                class="mdui-btn mdui-ripple"
                v-theme-class="['mdui-text-color-pink-accent', 'mdui-text-color-indigo-a100']"
                style="min-width: unset"
                :disabled="!parent.syncCode"
                @click="parent.copySyncCode()"
                >{{ $t('common.copy') }}</button
              >
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!isYituliu">{{ $t('cultivate.panel.sync.cloudSyncReadme') }}</p>
      <p>{{ $t('cultivate.panel.sync.autoSyncUploadTip') }}</p>
    </div>
    <div class="mdui-dialog-actions">
      <button
        class="mdui-btn mdui-ripple"
        v-theme-class="$root.color.dialogTransparentBtn"
        mdui-dialog-cancel
        >{{ $t('common.close') }}</button
      >
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { MDUI_DIALOG_EMITS, useMduiDialog } from '@/mixins/mduiDialog';
import { useYituliuStore } from '@/store/yituliu';
import { JSON_STORAGE_SERVER, YITULIU_CLIENT_ID } from '@/utils/env';
import { t } from '@/i18n';

const parent = inject('parent')();
const yituliuStore = useYituliuStore();
const { isLoggedIn, userInfo } = storeToRefs(yituliuStore);

if (isLoggedIn.value) {
  yituliuStore.getUserInfo().catch(() => {});
}

const showSyncServiceSelect = !!(JSON_STORAGE_SERVER && YITULIU_CLIENT_ID);
const isYituliu = computed(() => parent.globalSetting.syncService === 'yituliu');
const yituliuActionsDisabled = computed(() => isYituliu.value && !isLoggedIn.value);
const restoreDisabled = computed(() => (isYituliu.value ? !isLoggedIn.value : !parent.syncCode));
const displayName = computed(() => {
  const info = userInfo.value;
  if (!info) return '';
  return info.nickname || info.userName || String(info.uid);
});
const syncServiceOptions = computed(() => [
  { value: 'arkntools', text: t('cultivate.panel.sync.service.arkntools') },
  { value: 'yituliu', text: t('cultivate.panel.sync.service.yituliu') },
]);

const emit = defineEmits(MDUI_DIALOG_EMITS);
const dialogRef = ref();
const dialog = useMduiDialog(emit, dialogRef);
defineExpose(dialog);
</script>

<style lang="scss" scoped>
.data-sync {
  .tag-btn {
    padding: 0 14px;
  }
}
.sync-options {
  .mdui-textfield {
    display: block;
    padding: 0;
  }
}
.yituliu-user {
  min-height: 36px;
}
</style>
