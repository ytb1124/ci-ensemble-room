import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 상대 경로로 빌드해 GitHub Pages(https://<아이디>.github.io/ci-ensemble-room/) 같은 하위 경로에서도 동작하게 한다.
  // 라우팅은 해시 라우터라 서버 설정이 필요 없다.
  base: './',
})
