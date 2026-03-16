# WhatsApp AI Chatbot 🤖

An AI-powered WhatsApp bot using Groq API (Free & Fast!)

## Features
- 💬 Smart AI conversations (LLaMA 3.3 70B)
- 🧠 Remembers conversation context
- 👥 Works in private chats & groups
- ⚡ Super fast responses (Groq)
- 🌍 Supports all languages
- 📱 Mobile-friendly responses

## Commands
- `!help` - Show help message
- `!clear` - Clear conversation history
- `!ask [question]` - Ask a specific question
- `!about` - About the bot

## Setup (Local)

### Requirements
- Node.js 18+
- npm

### Installation
```bash
npm install
```

### Configuration
Set environment variables:
```
GROQ_API_KEY=your_groq_api_key
BOT_NAME=My AI Assistant
RESPOND_IN_GROUPS=mention
```

### Run
```bash
npm start
```

Scan the QR code with WhatsApp to connect!

## Group Settings
- `always` - Reply to all messages
- `mention` - Only reply when mentioned (recommended)
- `never` - Don't respond in groups

## Environment Variables
| Variable | Description | Default |
|----------|-------------|---------|
| GROQ_API_KEY | Groq API Key | required |
| BOT_NAME | Bot display name | AI Assistant |
| RESPOND_IN_GROUPS | Group response mode | mention |

## ⚠️ Disclaimer
This bot uses an unofficial WhatsApp library. Use at your own risk.
