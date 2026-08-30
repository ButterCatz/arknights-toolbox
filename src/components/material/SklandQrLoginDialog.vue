<template>
  <div class="mdui-dialog mdui-typo" ref="dialogRef" style="width: 325px">
    <div class="mdui-dialog-title mdui-p-b-0">森空岛扫码登录</div>
    <div class="mdui-dialog-content mdui-p-b-0 mdui-p-t-2">
      <div class="qr-login">
        <p class="qr-login__hint no-sl">请使用森空岛手机 APP 扫码登录</p>
        <div class="qrcode no-sl">
          <vue-qrcode v-if="scanUrl" :value="scanUrl" :options="qrCodeOption" />
          <div v-if="status !== QrStatus.WAIT" class="qrcode__mask">
            <mdui-spinner v-if="status === QrStatus.LOADING" />
            <div v-else class="qrcode__action">
              <i v-if="showCheckIcon" class="mdui-icon material-icons qrcode__check"
                >check_circle</i
              >
              <div class="refresh-btn" :class="{ 'icon--hide': showCheckIcon }" @click="restart">
                <i class="mdui-icon material-icons">refresh</i>
              </div>
            </div>
          </div>
        </div>
        <p class="qr-login__status no-sl">{{ statusText }}</p>
      </div>
    </div>
    <div class="mdui-dialog-actions">
      <button
        class="mdui-btn mdui-ripple"
        v-theme-class="$root.color.dialogTransparentBtn"
        mdui-dialog-cancel
        >关闭</button
      >
    </div>
  </div>
</template>

<script setup>
import VueQrcode from '@chenfengyuan/vue-qrcode';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { MDUI_DIALOG_EMITS, useMduiDialog } from '@/mixins/mduiDialog';
import { useSklandStore } from '@/store/skland';
import { sleep } from '@/utils/common';
import { sklandCreateScan, sklandGetScanStatus, sklandTokenByScanCode } from '@/utils/skland';

const QrStatus = {
  LOADING: 0,
  WAIT: 1,
  SCANNED: 2,
  EXPIRED: 3,
  SUCCESS: 4,
  ERROR: 5,
};

const POLL_INTERVAL = 2000;
const SUCCESS_CLOSE_DELAY = 400;

const qrCodeOption = {
  margin: 0,
  width: 196,
};

const emit = defineEmits(MDUI_DIALOG_EMITS);
const store = useSklandStore();

const emitAndStopOnClose = (event, ...args) => {
  if (event === 'close') invalidate();
  emit(event, ...args);
};

const dialogRef = ref();
const dialog = useMduiDialog(emitAndStopOnClose, dialogRef);
defineExpose(dialog);

const status = ref(QrStatus.LOADING);
const scanUrl = ref('');
const errMsg = ref('');

const showCheckIcon = computed(
  () => status.value === QrStatus.SCANNED || status.value === QrStatus.SUCCESS,
);

const statusText = computed(() => {
  switch (status.value) {
    case QrStatus.LOADING:
      return '加载中';
    case QrStatus.WAIT:
      return '等待扫码';
    case QrStatus.SCANNED:
      return '已扫码，等待登录';
    case QrStatus.EXPIRED:
      return '二维码已过期，请刷新';
    case QrStatus.SUCCESS:
      return '登录成功';
    default:
      return errMsg.value || '发生错误';
  }
});

let session = 0;

const invalidate = () => {
  session += 1;
};

const start = async () => {
  const mySession = ++session;
  status.value = QrStatus.LOADING;
  errMsg.value = '';

  try {
    const { scanId, scanUrl: url } = await sklandCreateScan();
    if (mySession !== session) return;
    scanUrl.value = url;
    status.value = QrStatus.WAIT;
    await poll(scanId, mySession);
  } catch (e) {
    if (mySession !== session) return;
    errMsg.value = e.message || '发生错误';
    status.value = QrStatus.ERROR;
  }
};

const poll = async (scanId, mySession) => {
  while (mySession === session) {
    await sleep(POLL_INTERVAL);
    if (mySession !== session) return;

    try {
      const { state, scanCode } = await sklandGetScanStatus(scanId);
      if (mySession !== session) return;

      if (state === 'pending') {
        status.value = QrStatus.WAIT;
        continue;
      }
      if (state === 'scanned') {
        status.value = QrStatus.SCANNED;
        continue;
      }
      if (state === 'expired') {
        status.value = QrStatus.EXPIRED;
        return;
      }

      const token = await sklandTokenByScanCode(scanCode);
      if (mySession !== session) return;
      status.value = QrStatus.SUCCESS;
      store.oauthToken = token;
      await sleep(SUCCESS_CLOSE_DELAY);
      if (mySession !== session) return;
      dialog.close();
      return;
    } catch (e) {
      if (mySession !== session) return;
      errMsg.value = e.message || '发生错误';
      status.value = QrStatus.ERROR;
      return;
    }
  }
};

const restart = () => start();

onMounted(start);
onBeforeUnmount(invalidate);
</script>

<style lang="scss" scoped>
.qr-login {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.qr-login__hint,
.qr-login__status {
  margin: 0;
}

.qr-login__hint {
  margin-bottom: 16px;
}

.qr-login__status {
  margin-top: 16px;
}

.qrcode {
  position: relative;
  min-width: 196px;
  min-height: 196px;
  display: flex;
  align-items: center;
  justify-content: center;

  &__mask {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    background-color: rgba(255, 255, 255, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__action {
    position: relative;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  &__check {
    position: absolute;
    font-size: 32px;
    color: green;
  }
}

.refresh-btn {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background-color: #fff;
  border-radius: 50%;
  box-shadow:
    0 1.25px 5px 0 rgba(0, 0, 0, 0.2),
    0 0.3333px 1.5px 0 rgba(0, 0, 0, 0.04);
  overflow: hidden;
  cursor: pointer;
  user-select: none;

  &::after {
    position: absolute;
    content: '';
    top: 0;
    right: 0;
    left: 0;
    bottom: 0;
    transition: background-color 0.1s;
  }

  &:hover::after {
    background-color: rgba(0, 0, 0, 0.08);
  }

  &:active::after {
    background-color: rgba(0, 0, 0, 0.12);
  }
}

.icon--hide {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
}

.qrcode:hover {
  .icon--hide {
    opacity: 1;
    pointer-events: auto;
  }
}
</style>
