import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { koCatalog } from './scripts/ko-catalog.ts'

// https://vite.dev/config/
export default defineConfig({
  // koCatalog: 관리자 문구 수정 화면(#/admin)에 보여 줄 한국어 문구 목록을 소스에서 뽑는다
  plugins: [react(), koCatalog(fileURLToPath(new URL('./src', import.meta.url)))],
  // 상대 경로로 빌드해 GitHub Pages(https://<아이디>.github.io/ci-ensemble-room/) 같은 하위 경로에서도 동작하게 한다.
  // 라우팅은 해시 라우터라 서버 설정이 필요 없다.
  base: './',
})
