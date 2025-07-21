import baileys from '@whiskeysockets/baileys'
import pino from 'pino'
import qrcode from 'qrcode-terminal'
import { loadPlugins, executeCommand } from './handlers.ts'
import { color } from './nology/colors.ts'

const {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers
} = baileys

async function startNology() {
  const { state, saveCreds } = await useMultiFileAuthState('./nology/sesibot')
  const { version } = await fetchLatestBaileysVersion()

  const nology = makeWASocket({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    auth: state,
    version,
    browser: Browsers.macOS('Desktop'),
    msgRetryCounterMap: {},
    retryRequestDelayMs: 250,
    markOnlineOnConnect: false,
    emitOwnEvents: true,
    patchMessageBeforeSending: (msg) => {
      if (msg.contextInfo) delete msg.contextInfo.mentionedJid
      return msg
    }
  })

  await loadPlugins()

  nology.ev.on('creds.update', saveCreds)

  nology.ev.on('connection.update', async ({ qr, connection, lastDisconnect }) => {
    if (qr) {
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'close') {
      const code = (lastDisconnect?.error)?.output?.statusCode
      const shouldReconnect = code !== DisconnectReason.loggedOut

      if (shouldReconnect) startNology()
    }

    if (connection === 'open') {
      try {
        await nology.newsletterFollow('120363367787013309@newsletter')
      } catch {}
    }
  })

  nology.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    const msg = messages[0]
    if (!msg || !msg.message || msg.key.fromMe) return

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      ''

    if (!text) return

    const sender = msg.key.remoteJid || 'unknown'

    try {
      await executeCommand(text, msg, async (res: string) => {
        await nology.sendMessage(sender, { text: res })
      })
    } catch {}
  })
}

startNology()