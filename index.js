const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const Groq = require('groq-sdk');
const express = require('express');

// ========== CONFIG ==========
const config = {
    GROQ_API_KEY: process.env.GROQ_API_KEY || 'your_groq_api_key_here',
    BOT_NAME: process.env.BOT_NAME || 'AI Assistant',
    RESPOND_IN_GROUPS: process.env.RESPOND_IN_GROUPS || 'mention',
    PORT: process.env.PORT || 3000,
    MAX_HISTORY: 10,
    MODEL: 'llama-3.3-70b-versatile',
};

const SYSTEM_PROMPT = `You are ${config.BOT_NAME}, a helpful and friendly AI assistant on WhatsApp. 
Be concise and helpful. Respond in the same language the user writes in.
Keep responses short and mobile-friendly. Use emojis occasionally.`;

// ========== EXPRESS SERVER (for QR code) ==========
const app = express();
let currentQR = null;
let botStatus = 'waiting'; // waiting, qr_ready, connected, disconnected

app.get('/', (req, res) => {
    if (botStatus === 'connected') {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>WhatsApp AI Bot</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { font-family: Arial, sans-serif; display: flex; justify-content: center; 
                           align-items: center; min-height: 100vh; margin: 0; background: #f0f2f5; }
                    .card { background: white; padding: 40px; border-radius: 16px; text-align: center;
                            box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 400px; }
                    .status { color: #25D366; font-size: 24px; font-weight: bold; }
                    .icon { font-size: 60px; margin-bottom: 20px; }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="icon">✅</div>
                    <div class="status">Bot is Connected!</div>
                    <p>Your WhatsApp AI Bot is running successfully.</p>
                    <p><small>Powered by Groq AI ⚡</small></p>
                </div>
            </body>
            </html>
        `);
    } else if (botStatus === 'qr_ready' && currentQR) {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>WhatsApp AI Bot - Scan QR</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <meta http-equiv="refresh" content="30">
                <style>
                    body { font-family: Arial, sans-serif; display: flex; justify-content: center; 
                           align-items: center; min-height: 100vh; margin: 0; background: #f0f2f5; }
                    .card { background: white; padding: 40px; border-radius: 16px; text-align: center;
                            box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 450px; }
                    h2 { color: #25D366; }
                    img { border: 3px solid #25D366; border-radius: 12px; padding: 10px; }
                    .steps { text-align: left; margin: 20px 0; }
                    .steps li { margin: 8px 0; color: #555; }
                    .refresh { color: #999; font-size: 12px; margin-top: 10px; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h2>📱 Scan QR Code</h2>
                    <img src="${currentQR}" width="280" height="280" alt="QR Code"/>
                    <div class="steps">
                        <ol>
                            <li>Open WhatsApp on your phone</li>
                            <li>Go to Settings → Linked Devices</li>
                            <li>Tap "Link a Device"</li>
                            <li>Scan this QR code</li>
                        </ol>
                    </div>
                    <p class="refresh">⏳ Page auto-refreshes every 30 seconds</p>
                </div>
            </body>
            </html>
        `);
    } else {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>WhatsApp AI Bot</title>
                <meta http-equiv="refresh" content="5">
                <style>
                    body { font-family: Arial, sans-serif; display: flex; justify-content: center; 
                           align-items: center; min-height: 100vh; margin: 0; background: #f0f2f5; }
                    .card { background: white; padding: 40px; border-radius: 16px; text-align: center;
                            box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
                    .loader { border: 4px solid #f3f3f3; border-top: 4px solid #25D366; 
                              border-radius: 50%; width: 40px; height: 40px; 
                              animation: spin 1s linear infinite; margin: 20px auto; }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="loader"></div>
                    <h3>🚀 Starting WhatsApp Bot...</h3>
                    <p>Please wait, this may take a minute.</p>
                    <p><small>Page auto-refreshes every 5 seconds</small></p>
                </div>
            </body>
            </html>
        `);
    }
});

app.get('/status', (req, res) => {
    res.json({ status: botStatus });
});

app.listen(config.PORT, () => {
    console.log(`🌐 Web server running on port ${config.PORT}`);
    console.log(`📱 Open the Railway URL to scan QR code`);
});

// ========== GROQ CLIENT ==========
const groq = new Groq({ apiKey: config.GROQ_API_KEY });
const userHistories = new Map();

function getHistory(userId) {
    if (!userHistories.has(userId)) userHistories.set(userId, []);
    return userHistories.get(userId);
}

function addToHistory(userId, role, content) {
    const history = getHistory(userId);
    history.push({ role, content });
    if (history.length > config.MAX_HISTORY) {
        userHistories.set(userId, history.slice(-config.MAX_HISTORY));
    }
}

async function getAIResponse(userId, message) {
    addToHistory(userId, 'user', message);
    const response = await groq.chat.completions.create({
        model: config.MODEL,
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...getHistory(userId)
        ],
        max_tokens: 1024,
        temperature: 0.7,
    });
    const reply = response.choices[0].message.content;
    addToHistory(userId, 'assistant', reply);
    return reply;
}

// ========== WHATSAPP CLIENT ==========
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: [
            '--no-sandbox', '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas',
            '--no-first-run', '--no-zygote', '--single-process', '--disable-gpu'
        ],
    }
});

client.on('qr', async (qr) => {
    console.log('📱 QR Code generated! Open your Railway URL to scan.');
    try {
        currentQR = await qrcode.toDataURL(qr);
        botStatus = 'qr_ready';
    } catch (err) {
        console.error('QR generation error:', err);
    }
});

client.on('ready', () => {
    botStatus = 'connected';
    currentQR = null;
    console.log('✅ WhatsApp Bot connected!');
});

client.on('auth_failure', () => {
    botStatus = 'disconnected';
    console.error('❌ Auth failed!');
});

client.on('disconnected', () => {
    botStatus = 'disconnected';
    console.log('⚠️ Bot disconnected!');
});

client.on('message', async (message) => {
    try {
        const chat = await message.getChat();
        const contact = await message.getContact();
        const userId = contact.id._serialized;
        const body = message.body.trim();
        const isGroup = chat.isGroup;

        if (message.from === 'status@broadcast') return;
        if (message.type !== 'chat') return;
        if (!body) return;

        if (isGroup) {
            if (config.RESPOND_IN_GROUPS === 'never') return;
            if (config.RESPOND_IN_GROUPS === 'mention') {
                const isMentioned = message.mentionedIds.includes(client.info.wid._serialized);
                const isReply = message.hasQuotedMsg && (await message.getQuotedMessage()).fromMe;
                if (!isMentioned && !isReply) return;
            }
        }

        if (body === '!help' || body === '!start') {
            await message.reply(
                `🤖 *${config.BOT_NAME}*\n\n` +
                `Commands:\n` +
                `!help - Show this message\n` +
                `!clear - Clear history\n` +
                `!ask [question] - Ask anything\n` +
                `!about - About this bot\n\n` +
                `_Just send any message to chat with AI!_`
            );
            return;
        }

        if (body === '!clear') {
            userHistories.set(userId, []);
            await message.reply('🗑️ History cleared!');
            return;
        }

        if (body === '!about') {
            await message.reply(`🤖 *${config.BOT_NAME}*\nPowered by Groq AI ⚡\nModel: LLaMA 3.3 70B`);
            return;
        }

        let userMessage = body.startsWith('!ask ') ? body.slice(5).trim() : body;
        if (!userMessage) return;

        await chat.sendStateTyping();
        const reply = await getAIResponse(userId, userMessage);
        await message.reply(reply);

    } catch (error) {
        console.error('Error:', error.message);
        try { await message.reply('❌ Something went wrong. Try again!'); } catch (e) {}
    }
});

console.log('🚀 Starting WhatsApp AI Bot...');
client.initialize();
