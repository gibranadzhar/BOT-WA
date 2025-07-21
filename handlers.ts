import fs from "fs";
import path from "path";
import config from "./nology/config.ts";
import chalk from "chalk";
import { pathToFileURL } from "url";

let loadedPlugins = [];

export const loadPlugins = async (directory = "./command") => {
  const dirPath = path.resolve(directory);
  const files = fs.readdirSync(dirPath);
  loadedPlugins = [];

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    if (filePath.endsWith(".js") || filePath.endsWith(".ts")) {
      try {
        const fileUrl = pathToFileURL(filePath).href;
        const plugin = await import(fileUrl + `?update=${Date.now()}`);
        if (plugin?.default) {
          loadedPlugins.push(plugin.default);
          console.log(chalk.green("✔ Plugin dimuat:"), chalk.cyan(file));
        }
      } catch (error) {
        console.error(chalk.red(`❌ Gagal load plugin ${file}:`), error);
      }
    }
  }

  return loadedPlugins;
};

export const watchPlugins = (directory = "./command") => {
  const dirPath = path.resolve(directory);
  fs.watch(dirPath, { recursive: false }, async (eventType, filename) => {
    if (filename && (filename.endsWith(".js") || filename.endsWith(".ts"))) {
      console.log(chalk.yellow(`🔁 Reload plugin karena perubahan:`), filename);
      await loadPlugins(directory);
    }
  });
};

export const executeCommand = async (text, m, respond) => {
  const command = text.trim().split(" ")[0].toLowerCase();
  const prefix = config.prefix || "!";
  const isBot = m.key.fromMe;
  const pushname = m.pushName || "Pengguna";
  const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
  const mime = Object.keys(m.message || {})[0];
  const fquoted = m.message?.extendedTextMessage?.contextInfo || null;

  const reply = (msg) => respond(msg);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fetchJson = async (url, options = {}) => {
    const res = await fetch(url, options);
    return res.json();
  };

  const plug = {
    prefix,
    command,
    reply,
    text,
    isBot,
    pushname,
    mime,
    quoted,
    fquoted,
    sleep,
    fetchJson,
    isPrivate: m.key.remoteJid?.endsWith("@s.whatsapp.net") || false,
  };

  for (const plugin of loadedPlugins) {
    if (!plugin.command || !Array.isArray(plugin.command)) continue;

    if (plugin.command.includes(command)) {
      if (plugin.isBot && !isBot) return;
      if (plugin.private && !plug.isPrivate) {
        return reply(config.message?.private || "Command ini hanya untuk private chat.");
      }

      if (typeof plugin === "function") {
        try {
          await plugin(m, plug);
        } catch (err) {
          console.error(chalk.red(`❌ Error saat menjalankan plugin:`), err);
          reply("Terjadi kesalahan saat mengeksekusi perintah.");
        }
      }
    }
  }
};