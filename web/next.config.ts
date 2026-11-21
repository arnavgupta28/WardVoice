import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Enable React strict mode
  reactStrictMode: true,
  turbopack: {
    root: path.resolve(__dirname, '..'),
  },

  // Optimize images
  images: {
    unoptimized: true,
  },

  async rewrites() {
    // AGENT_BACKEND_URL wins. On Render, AGENT_BACKEND_HOST comes from the API service (`fromService … host`),
    // which survives Render adding a random suffix to the service name (e.g. wardvoice-api-ab12).
    const host = process.env.AGENT_BACKEND_HOST?.trim()
    const fromHost = host ? (host.includes('.') ? `https://${host}` : `https://${host}.onrender.com`) : undefined
    const backendUrl = (process.env.AGENT_BACKEND_URL || fromHost)?.replace(/\/$/, '')
    if (!backendUrl) {
      return []
    }

    return [
      {
        source: '/api/get_config',
        destination: `${backendUrl}/get_config`,
      },
      {
        source: '/api/startAgent',
        destination: `${backendUrl}/startAgent`,
      },
      {
        source: '/api/stopAgent',
        destination: `${backendUrl}/stopAgent`,
      },
      {
        source: '/api/ward/:path*',
        destination: `${backendUrl}/ward/:path*`,
      },
    ]
  },
}

export default nextConfig
