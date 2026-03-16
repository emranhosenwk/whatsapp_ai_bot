const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const Groq = require('groq-sdk');

// ========== CONFIGURATION ==========
const config = {
    GROQ_API_KEY: process.env.GROQ_API_KEY || 'your_groq_api_key_here',
    BOT_NAME: process.env.BOT_NAME || 'AI Assistant',
    OWNER_NUMBER: process.env.OWNER_NUMBER || '', // e.g. 8801XXXXXXXXX
    RESPOND_IN_GROUPS: process.env.RESPOND_IN_GROUPS || 'mention', // 'always', 'mention', 'never'
    MAX_HISTORY: 10,
    MODEL: 'llama-3.3-70b-versatile',
};

const SYSTEM_PROMPT = `You are ${config.BOT_NAME}, a helpful and friendly AI assistant on WhatsApp. 
You can help with answering questions, writing, coding, analysis, and general conversation.
Be concise and helpful. Respond in the same language the user writes in.
Keep responses short and mobile-friendly (WhatsApp format).
Use emojis occasionally to be friendly.`;

// ========== GROQ CLIENT ==========
const groq = new Groq({ apiKey: config.GROQ_API_KEY });

// ========== CONVERSATION HISTORY ==========
const userHistories = new Map();

function getHistory(userId) {
    if (!userHistories.has(userId)) {
        userHistories.set(userId, []);
    }
    return userHistories.get(userId);
}

function addToHistory(userId, role, content) {
    const history = getHistory(userId);
    history.push({ role, content });
    if (history.length > config.MAX_HISTORY) {
        userHistories.set(userId, history.slice(-config.MAX_HISTORY));
    }
}

function clearHistory(userId) {
    userHistories.set(userId, []);
}

// ========== AI RESPONSE ==========
async function getAIResponse(userId, message) {
    addToHistory(userId, 'user', message);
    const history = getHistory(userId);

    const response = await groq.chat.completions.create({
        model: config.MODEL,
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...history
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
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ],
    }
});

// QR Code
client.on('qr', (qr) => {
    console.log('\n📱 Scan this QR code with WhatsApp:\n');
    qrcode.generate(qr, { small: true });
    console.log('\n⏳ Waiting for scan...\n');
});

// Ready
client.on('ready', () => {
    console.log('✅ WhatsApp AI Bot is ready!');
    console.log(`🤖 Bot Name: ${config.BOT_NAME}`);
    console.log('💬 Send a message to start chatting!\n');
});

// Auth failure
client.on('auth_failure', () => {
    console.error('❌ Authentication failed! Please restart and scan QR again.');
});

// Disconnected
client.on('disconnected', (reason) => {
    console.log('⚠️ Bot disconnected:', reason);
});

// ========== MESSAGE HANDLER ==========
client.on('message', async (message) => {
    try {
        const chat = await message.getChat();
        const contact = await message.getContact();
        const userId = contact.id._serialized;
        const body = message.body.trim();
        const isGroup = chat.isGroup;

        // Skip status messages
        if (message.from === 'status@broadcast') return;
        if (message.type !== 'chat') return;
        if (!body) return;

        // Group handling
        if (isGroup) {
            if (config.RESPOND_IN_GROUPS === 'never') return;
            if (config.RESPOND_IN_GROUPS === 'mention') {
                const botNumber = client.info.wid._serialized;
                const isMentioned = message.mentionedIds.includes(botNumber);
                const isReply = message.hasQuotedMsg && 
                    (await message.getQuotedMessage()).fromMe;
                if (!isMentioned && !isReply) return;
            }
        }

        // ========== COMMANDS ==========

        // !start or !help
        if (body === '!start' || body === '!help') {
            const helpText = `🤖 *${config.BOT_NAME}*\n\n` +
                `I'm your AI assistant! Here's what I can do:\n\n` +
                `💬 Just send me any message and I'll reply!\n\n` +
                `*Commands:*\n` +
                `!help - Show this message\n` +
                `!clear - Clear conversation history\n` +
                `!ask [question] - Ask a specific question\n` +
                `!about - About this bot\n\n` +
                `_I remember our conversation context. Use !clear to start fresh._`;
            await message.reply(helpText);
            return;
        }

        // !clear
        if (body === '!clear') {
            clearHistory(userId);
            await message.reply('🗑️ Conversation cleared! Let\'s start fresh. 😊');
            return;
        }

        // !about
        if (body === '!about') {
            const aboutText = `🤖 *${config.BOT_NAME}*\n\n` +
                `Powered by Groq AI ⚡\n` +
                `Model: LLaMA 3.3 70B\n\n` +
                `Fast, intelligent, and always ready to help! 🚀`;
            await message.reply(aboutText);
            return;
        }

        // !ask command
        let userMessage = body;
        if (body.startsWith('!ask ')) {
            userMessage = body.slice(5).trim();
        }

        // Remove bot mention from message
        const botNumber = client.info?.wid?.user;
        if (botNumber) {
            userMessage = userMessage.replace(`@${botNumber}`, '').trim();
        }

        if (!userMessage) return;

        // Show typing indicator
        await chat.sendStateTyping();

        // Get AI response
        const reply = await getAIResponse(userId, userMessage);
        await message.reply(reply);

    } catch (error) {
        console.error('❌ Error handling message:', error.message);
        try {
            await message.reply('❌ Sorry, something went wrong. Please try again!');
        } catch (e) {}
    }
});

// ========== START BOT ==========
console.log('🚀 Starting WhatsApp AI Bot...');
console.log('📦 Loading WhatsApp client...\n');
client.initialize();
