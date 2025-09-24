import DefaultTheme from 'vitepress/theme'
import ImageWithStatus from './components/ImageWithStatus.vue'
import type { Theme } from 'vitepress'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('ImageWithStatus', ImageWithStatus)
  }
} satisfies Theme
