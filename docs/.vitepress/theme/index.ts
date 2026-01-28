import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import { onMounted, watch, nextTick } from 'vue'
import { useRoute } from 'vitepress'
import mediumZoom from 'medium-zoom'
import './style.css'

export default {
  extends: DefaultTheme,
  setup() {
    const route = useRoute()
    
    const initZoom = () => {
      // 选择文档内容区域的图片，排除 logo 等
      mediumZoom('.vp-doc img', { 
        background: 'var(--vp-c-bg)'
      })
    }
    
    onMounted(() => initZoom())
    
    // 路由切换时重新初始化
    watch(
      () => route.path,
      () => nextTick(() => initZoom())
    )
  }
} satisfies Theme
