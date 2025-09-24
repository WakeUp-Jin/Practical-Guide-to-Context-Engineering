<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  src: string
  alt?: string
  width?: string | number
  height?: string | number
  lazy?: boolean
  placeholder?: string // 可选：低清模糊占位图（base64 或小图）
}>()

const loaded = ref(false)
const errored = ref(false)

function onLoad() {
  loaded.value = true
}
function onError() {
  errored.value = true
}
</script>

<template>
  <div
    class="vp-img-wrapper"
    :style="{
      width: typeof width === 'number' ? width + 'px' : width,
      height: typeof height === 'number' ? height + 'px' : height
    }"
  >
    <!-- 骨架/占位（加载中） -->
    <div v-if="!loaded && !errored" class="vp-img-skeleton">
      <div class="vp-img-spinner" aria-label="图片加载中" />
    </div>

    <!-- 加载失败 -->
    <div v-if="errored" class="vp-img-error">
      <span>图片加载失败</span>
    </div>

    <!-- 渐进式占位（低清 → 高清） -->
    <img
      v-if="placeholder && !loaded && !errored"
      class="vp-img-blur"
      :src="placeholder"
      :alt="alt || ''"
      aria-hidden="true"
      decoding="async"
    />

    <!-- 真图（渐显） -->
    <img
      class="vp-img-real"
      :class="{ 'vp-img-loaded': loaded }"
      :src="src"
      :alt="alt || ''"
      :loading="lazy === false ? undefined : 'lazy'"
      decoding="async"
      @load="onLoad"
      @error="onError"
    />
  </div>
</template>

<style scoped>
.vp-img-wrapper {
  position: relative;
  display: block;
  overflow: hidden;
  border-radius: 8px;
  background: #f4f4f5; /* 作为骨架底色 */
}

/* 骨架层 */
.vp-img-skeleton {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  animation: pulse 1.2s ease-in-out infinite;
}
@keyframes pulse {
  0% { background-color: #f3f4f6; }
  50% { background-color: #e5e7eb; }
  100% { background-color: #f3f4f6; }
}
.vp-img-spinner {
  width: 20px; height: 20px;
  border: 2px solid rgba(0,0,0,0.2);
  border-top-color: rgba(0,0,0,0.5);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* 失败层 */
.vp-img-error {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #a1a1aa;
  background: #fafafa;
  font-size: 12px;
}

/* 低清模糊图 */
.vp-img-blur {
  position: absolute;
  inset: 0;
  width: 100%; height: 100%;
  object-fit: contain;
  filter: blur(12px);
  transform: scale(1.02);
}

/* 真图渐显 */
.vp-img-real {
  position: relative;
  display: block;
  width: 100%; height: auto;
  opacity: 0;
  transition: opacity 320ms ease;
}
.vp-img-real.vp-img-loaded {
  opacity: 1;
}
</style>
