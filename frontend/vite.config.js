import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Windows에서 파일 변경 감지가 자주 누락돼 옛 코드가 서빙되는 문제를 막기 위해 폴링 사용
    watch: { usePolling: true, interval: 300 },
  },
});
