<template>
  <label class="mdui-radio">
    <input
      type="radio"
      :name="name"
      :checked="checked"
      :disabled="disabled"
      @change="$emit('change', $event.target.checked)"
      v-bind="$attrs"
    />
    <i class="mdui-radio-icon"></i><slot v-if="customSlot"></slot
    ><span v-else class="ra-text"><slot></slot></span>
  </label>
</template>

<script>
export default {
  name: 'mdui-radio',
  model: {
    prop: 'checked',
    event: 'change',
  },
  props: {
    name: String,
    checked: Boolean,
    disabled: Boolean,
    customSlot: Boolean,
  },
};
</script>

<style scoped>
.mdui-radio {
  padding-left: 28px;
}

.ra-text {
  white-space: nowrap;
}
</style>
