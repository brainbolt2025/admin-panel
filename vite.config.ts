import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind to all interfaces so `localhost` works whether the browser
    // resolves it to IPv4 (127.0.0.1) or IPv6 (::1). Node 17+ resolves
    // `localhost` to ::1 by default, which otherwise leaves 127.0.0.1
    // unreachable and makes the browser time out.
    host: true,
    port: 5173,
  },
})
