const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==================== Data Layer ====================
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

function loadJSON(filename, fallback) {
  const fp = path.join(DATA_DIR, filename);
  try { return JSON.parse(fs.readFileSync(fp, 'utf-8')); }
  catch { return fallback; }
}
function saveJSON(filename, data) {
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2), 'utf-8');
}

let boardMessages = loadJSON('messages.json', []);
let notepadContent = loadJSON('notepad.json', { content: '', modifiedBy: '', modifiedAt: null });
let chatHistory = loadJSON('chat.json', []);
let users = loadJSON('users.json', {});
// onlineUsers: socketId -> userProfile, rebuilt on each connection
let onlineUsers = {}; // socketId -> userProfile

// ==================== AI Service Interface ====================
const AIConfig = {
  enabled: false,
  provider: 'mock',
  apiKey: '',
  endpoint: '',
  model: '',
};

const aiResponses = {
  greeting: [
    '嘿 {nickname}，今天想聊什么？我在基地随时待命。',
    '{nickname} 来了！有什么创意灵感需要我帮忙吗？',
    '你好呀 {nickname}，基地的 AI 助手在线中~',
  ],
  general: [
    '这个想法很有趣！{codename}，要不要深入讨论一下？',
    '我理解你的意思。从另一个角度看，也许可以试试换个思路？',
    '嗯，这个问题值得好好想想。你觉得关键点在哪里？',
    '哈哈，{nickname} 总是能提出有意思的话题！',
    '让我想想... 根据基地的数据，这确实是个值得探讨的方向。',
  ],
  farewell: [
    '回头聊，{nickname}！灵感随时会来。',
    '好的，{codename}，我在这儿等你回来。',
  ],
};

function getAIResponse(userMessage, userProfile) {
  const { nickname = '朋友', codename = '访客' } = userProfile || {};
  const lower = userMessage.toLowerCase();

  let pool;
  if (/你好|嗨|hello|hi|hey/.test(lower)) pool = aiResponses.greeting;
  else if (/再见|拜拜|bye|晚安/.test(lower)) pool = aiResponses.farewell;
  else pool = aiResponses.general;

  const template = pool[Math.floor(Math.random() * pool.length)];
  return template.replace(/\{nickname\}/g, nickname).replace(/\{codename\}/g, codename);
}

// AI proxy endpoint for real API integration
app.post('/api/ai/chat', (req, res) => {
  const { message, userProfile, history } = req.body;

  if (AIConfig.provider === 'mock' || !AIConfig.enabled) {
    const reply = getAIResponse(message, userProfile);
    return res.json({ reply, provider: 'mock' });
  }

  // For real AI providers, proxy the request
  // Currently returns mock; swap in fetch() to your AI provider
  const reply = getAIResponse(message, userProfile);
  res.json({ reply, provider: 'mock', note: 'Configure AIConfig in server.js for real AI' });
});

// ==================== REST API ====================
app.get('/api/users/online', (_req, res) => {
  res.json(Object.values(onlineUsers));
});

app.get('/api/users/all', (_req, res) => {
  res.json(Object.values(users));
});

app.get('/api/notepad', (_req, res) => {
  res.json(notepadContent);
});

// ==================== Socket.IO ====================
io.on('connection', (socket) => {
  console.log(`[连接] ${socket.id}`);

  // -- User Login --
  socket.on('user:login', (profile, callback) => {
    const user = {
      id: socket.id,
      codename: profile.codename || '访客',
      nickname: profile.nickname || 'Guest',
      avatar: profile.avatar || '👤',
      color: profile.color || '#007aff',
      joinedAt: Date.now(),
    };
    users[socket.id] = user;
    onlineUsers[socket.id] = user;
    saveJSON('users.json', users);

    socket.broadcast.emit('user:joined', user);
    io.emit('users:update', Object.values(onlineUsers));
    if (callback) callback({ ok: true, user });
  });

  // -- Notepad Sync --
  socket.on('notepad:update', (data) => {
    notepadContent = {
      content: data.content,
      modifiedBy: onlineUsers[socket.id]?.nickname || '未知',
      modifiedAt: Date.now(),
    };
    saveJSON('notepad.json', notepadContent);
    socket.broadcast.emit('notepad:sync', notepadContent);
  });

  socket.on('notepad:request', () => {
    socket.emit('notepad:sync', notepadContent);
  });

  // -- Message Board --
  socket.on('board:message', (content) => {
    const user = onlineUsers[socket.id];
    if (!user) return;
    const msg = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      userId: socket.id,
      codename: user.codename,
      nickname: user.nickname,
      avatar: user.avatar,
      color: user.color,
      content,
      timestamp: Date.now(),
    };
    boardMessages.push(msg);
    if (boardMessages.length > 200) boardMessages = boardMessages.slice(-200);
    saveJSON('messages.json', boardMessages);
    io.emit('board:new', msg);
  });

  socket.on('board:request', () => {
    socket.emit('board:history', boardMessages);
  });

  // -- Chat --
  socket.on('chat:message', async (data) => {
    const user = onlineUsers[socket.id];
    if (!user) return;

    const userMsg = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      userId: socket.id,
      codename: user.codename,
      nickname: user.nickname,
      avatar: user.avatar,
      color: user.color,
      content: data.content,
      timestamp: Date.now(),
      isAI: false,
    };
    chatHistory.push(userMsg);
    if (chatHistory.length > 500) chatHistory = chatHistory.slice(-500);
    saveJSON('chat.json', chatHistory);
    io.emit('chat:new', userMsg);

    // AI response if enabled
    if (data.aiEnabled) {
      const aiReply = getAIResponse(data.content, user);
      const aiMsg = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        userId: 'ai',
        codename: 'AI助手',
        nickname: 'AI',
        avatar: '🤖',
        color: '#5856d6',
        content: aiReply,
        timestamp: Date.now(),
        isAI: true,
      };
      chatHistory.push(aiMsg);
      if (chatHistory.length > 500) chatHistory = chatHistory.slice(-500);
      saveJSON('chat.json', chatHistory);
      setTimeout(() => io.emit('chat:new', aiMsg), 400 + Math.random() * 600);
    }
  });

  socket.on('chat:request', () => {
    socket.emit('chat:history', chatHistory.slice(-100));
  });

  // -- Disconnect --
  socket.on('disconnect', () => {
    const user = onlineUsers[socket.id];
    delete onlineUsers[socket.id];
    if (user) {
      io.emit('user:left', user);
      io.emit('users:update', Object.values(onlineUsers));
    }
    console.log(`[断开] ${socket.id}`);
  });
});

// ==================== Start ====================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 秘密基地服务器启动: http://localhost:${PORT}`);
});
