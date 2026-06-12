#!/usr/bin/env node
/**
 * Запускает Cloudflare Quick Tunnel на порту 3000 и обновляет URL в mobile/api/axios.ts
 * Использование: node start-tunnel.js
 */
import { spawn } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AXIOS_FILE = join(__dirname, 'mobile', 'DomRentMobile', 'api', 'axios.ts');
const PORT = 3000;
const RESTART_DELAY_MS = 5000;

function updateAxiosUrl(newUrl) {
  const content = readFileSync(AXIOS_FILE, 'utf8');
  const updated = content.replace(
    /const BASE_URL = 'https?:\/\/[^']+';/,
    `const BASE_URL = '${newUrl}/api';`
  );
  writeFileSync(AXIOS_FILE, updated, 'utf8');
  console.log(`\n✅ axios.ts → ${newUrl}/api`);
  console.log('📱 Нажмите r в Expo для перезагрузки\n');
}

function startTunnel() {
  console.log('🔄 Запуск Cloudflare Tunnel...');

  const cf = spawn('npx', ['cloudflared', 'tunnel', '--url', `http://localhost:${PORT}`, '--no-autoupdate'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
    detached: false,
  });

  let urlUpdated = false;

  const handleOutput = (data) => {
    const text = data.toString();
    if (!urlUpdated) {
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (match) {
        urlUpdated = true;
        updateAxiosUrl(match[0].trim());
      }
    }
  };

  cf.stdout.on('data', handleOutput);
  cf.stderr.on('data', handleOutput);

  cf.on('close', (code) => {
    console.log(`\n⚠️  Тоннель упал (код ${code}). Перезапуск через ${RESTART_DELAY_MS / 1000}с...`);
    setTimeout(startTunnel, RESTART_DELAY_MS);
  });

  cf.on('error', (err) => {
    console.error('Ошибка:', err.message);
    setTimeout(startTunnel, RESTART_DELAY_MS);
  });
}

console.log('🚇 DomRent Cloudflare Tunnel');
console.log(`📡 Пробрасываем localhost:${PORT}`);
console.log('⚠️  Не закрывайте это окно!\n');

startTunnel();

process.on('SIGINT', () => {
  console.log('\n👋 Завершение...');
  process.exit(0);
});
