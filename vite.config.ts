import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
// base 保持 '/'：Vercel 根路径部署；HashRouter 已保证刷新/直达不 404
// inspectAttr 仅开发调试使用，生产构建剔除（避免 React.Fragment 控制台噪音）
export default defineConfig(({ command }) => ({
  base: '/',
  plugins: [...(command === 'serve' ? [inspectAttr()] : []), react()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
