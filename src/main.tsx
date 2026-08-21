import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// 内网静态部署：HashRouter 无需服务器重写规则，刷新/直达链接均不 404
import { HashRouter } from 'react-router'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
