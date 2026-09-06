<template>
  <div class="mdui-radio-group">
    <mdui-radio
      v-for="opt in options"
      :key="getValue(opt)"
      :name="groupName"
      :value="getValue(opt)"
      :checked="value === getValue(opt)"
      :disabled="disabled"
      @change="checked => select(checked, opt)"
      >{{ getText(opt) }}</mdui-radio
    >
  </div>
</template>

<script>
let uid = 0;

export default {
  name: 'mdui-radio-group',
  model: {
    event: 'change',
  },
  props: {
    value: [String, Number],
    options: Array,
    name: String,
    disabled: Boolean,
  },
  data: () => ({
    fallbackName: `mdui-radio-group-${++uid}`,
  }),
  computed: {
    groupName() {
      return this.name || this.fallbackName;
    },
  },
  methods: {
    getValue(opt) {
      return typeof opt === 'string' ? opt : opt.value;
    },
    getText(opt) {
      return typeof opt === 'string' ? opt : opt.text;
    },
    select(checked, opt) {
      if (checked) this.$emit('change', this.getValue(opt));
    },
  },
};
</script>

<style scoped>
.mdui-radio-group {
  display: contents;
}
</style>
