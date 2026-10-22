// The website's own uploader: talks to the ESP's USB-serial chip with Web Serial (Chrome / Edge),
// using Espressif's esptool-js. Browsers allow this only on https or http://localhost, so uploads are
// done in Chrome/Edge on the server PC itself (owner decision).

export const BAUD = 115200 // PRD: ESP32 fails at 921600, works at 115200

export function usbSupport() {
  if (!('serial' in navigator)) return { ok: false, reason: 'This browser cannot use USB serial. Use Chrome or Edge.' }
  if (!window.isSecureContext) {
    return { ok: false, reason: `Uploading over USB only works on the server PC itself: open http://localhost:${location.port || 80} there in Chrome or Edge.` }
  }
  return { ok: true }
}

const CHIP_BY_MODEL = { esp32: 'ESP32', esp8266: 'ESP8266' }

const CONNECT_TIMEOUT_MS = 40000

// Ask the user to pick the board's port, put the chip in upload mode and identify it.
// manual: the user already put the board in upload mode (hold BOOT/FLASH, tap EN/RST), so no automatic reset.
// Never hangs: after CONNECT_TIMEOUT_MS the port is released so the user can try again.
export async function connectBoard(onLog = () => {}, { manual = false, port: chosen } = {}) {
  const port = chosen ?? (await navigator.serial.requestPort())
  const { ESPLoader, Transport, ClassicReset } = await import('esptool-js') // loaded only when uploading
  const transport = new Transport(port, false)
  const terminal = { clean() {}, writeLine: (l) => onLog(`${l}\n`), write: (t) => onLog(t) }
  let attempt = 0
  const resetConstructors = {
    // Same reset as esptool-js, but say what is happening so the page never looks frozen.
    classicReset: (t, delay) => ({
      reset: async () => {
        attempt++
        onLog(`\nAttempt ${attempt}: restarting the board into upload mode…\n`)
        await new ClassicReset(t, delay).reset()
      },
    }),
  }
  const loader = new ESPLoader({ transport, baudrate: BAUD, romBaudrate: BAUD, terminal, resetConstructors })
  if (manual) onLog('Connecting without an automatic restart (board already in upload mode)…\n')

  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), CONNECT_TIMEOUT_MS)
  })
  try {
    const connecting = loader.main(manual ? 'no_reset' : 'default_reset')
    connecting.catch(() => {}) // if the time limit wins, this attempt's later failure is expected
    const description = await Promise.race([connecting, timeout])
    const mac = await loader.chip.readMac(loader)
    const tail = mac.split(':').slice(3).join('').toLowerCase()
    return { port, transport, loader, chip: loader.chip.CHIP_NAME, description, mac, chipId: tail, deviceId: `acls-${tail}` }
  } catch (err) {
    await transport.disconnect().catch(() => {}) // release the port so another try (or tool) can use it
    const noAnswer = err.message === 'timeout' || /Failed to connect/i.test(err.message)
    const error = new Error(
      noAnswer
        ? manual
          ? 'The board still did not answer. Check the USB cable (it must carry data) and that nothing else uses the port, then try again.'
          : 'The board did not go into upload mode by itself. Use "Connect by hand" below: hold the BOOT button, tap EN (RST), release BOOT, then connect.'
        : `${err.message || err}. Close Arduino IDE or any other serial monitor and try again.`
    )
    error.needsManual = noAnswer && !manual
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export function checkBoard(board, { espModel, deviceId }) {
  const problems = []
  if (espModel && board.chip !== CHIP_BY_MODEL[espModel]) problems.push(`This is an ${board.chip}, but the firmware is for ${CHIP_BY_MODEL[espModel]}.`)
  if (deviceId && board.deviceId !== deviceId) problems.push(`This board is ${board.deviceId}, but the firmware was made for ${deviceId}.`)
  return problems
}

export async function flashImage(board, image, offset, onProgress = () => {}) {
  await board.loader.writeFlash({
    fileArray: [{ data: image, address: offset }],
    flashMode: 'keep',
    flashFreq: 'keep',
    flashSize: 'keep',
    eraseAll: false,
    compress: true,
    reportProgress: (_i, written, total) => onProgress(written / total),
  })
  await board.loader.after('hard_reset')
  await board.transport.disconnect()
}

export async function disconnectBoard(board) {
  await board?.transport.disconnect().catch(() => {})
}

// Serial Monitor at 115200 on the same port: resets the board so the boot log is visible.
export async function openMonitor(port, onText) {
  await port.open({ baudRate: BAUD })
  // EN low (RTS) then release, with IO0 high (DTR off): a normal reset into the new firmware.
  await port.setSignals({ dataTerminalReady: false, requestToSend: true })
  await new Promise((r) => setTimeout(r, 120))
  await port.setSignals({ dataTerminalReady: false, requestToSend: false })
  const reader = port.readable.getReader()
  const decoder = new TextDecoder()
  let stopped = false
  ;(async () => {
    try {
      while (!stopped) {
        const { value, done } = await reader.read()
        if (done) break
        onText(decoder.decode(value, { stream: true }))
      }
    } catch {
      /* port closed */
    }
  })()
  return async () => {
    stopped = true
    await reader.cancel().catch(() => {})
    reader.releaseLock()
    await port.close().catch(() => {})
  }
}
