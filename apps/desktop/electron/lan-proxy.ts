/**
 * LAN TCP proxy for the "Connect from Phone" feature.
 *
 * The Hermes backend always spawns on 127.0.0.1:<ephemeral port> so the
 * desktop's token-based WebSocket auth works (loopback mode: no auth gate,
 * plain ?token= accepted). When the user enables "Connect from Phone" we
 * forward 0.0.0.0:LAN_PROXY_PORT -> 127.0.0.1:<backend_port> via a pure
 * Node.js TCP proxy - no admin rights, no netsh, no firewall rules needed.
 *
 * The proxy is transparent: it forwards raw TCP bytes in both directions so
 * HTTP, WebSocket upgrades, and all API paths work without modification.
 */

import * as net from 'net'

export const LAN_PROXY_PORT = 9090

let _proxy: net.Server | null = null
let _backendPort: number | null = null

/** Start the LAN proxy forwarding port 9090 -> 127.0.0.1:<backendPort>. */
export async function startLanProxy(backendPort: number): Promise<void> {
  if (_proxy) {
    if (_backendPort === backendPort) return
    await stopLanProxy()
  }

  _backendPort = backendPort

  return new Promise((resolve, reject) => {
    const server = net.createServer(client => {
      const upstream = net.connect({ host: '127.0.0.1', port: backendPort })

      client.pipe(upstream)
      upstream.pipe(client)

      const cleanup = () => {
        client.destroy()
        upstream.destroy()
      }

      client.on('error', cleanup)
      upstream.on('error', cleanup)
      client.on('close', () => upstream.destroy())
      upstream.on('close', () => client.destroy())
    })

    server.on('error', err => {
      _proxy = null
      _backendPort = null
      reject(err)
    })

    server.listen(LAN_PROXY_PORT, '0.0.0.0', () => {
      _proxy = server
      resolve()
    })
  })
}

/** Stop the LAN proxy if running. */
export async function stopLanProxy(): Promise<void> {
  const server = _proxy
  _proxy = null
  _backendPort = null

  if (!server) return

  return new Promise(resolve => {
    server.close(() => resolve())
  })
}

/** True when the proxy is currently listening. */
export function isLanProxyRunning(): boolean {
  return _proxy !== null && _proxy.listening
}
