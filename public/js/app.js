// ==================== Socket Connection ====================
const socket = io();

let currentUser = null;
let aiChatEnabled = false;

// ==================== Login ====================
const AVATARS = ['🦁', '🐱', '🐶', '🐰', '🦊', '🐼', '🐨', '🐯', '🐸', '🐙', '🦄', '🐲'];
const COLORS = ['#0071e3', '#ff375f', '#ff9500', '#34c759', '#5856d6', '#ff2d55', '#00c7be', '#af52de'];

function initLogin() {
  const avatarPicker = document.getElementById('avatar-picker');
  const colorPicker = document.getElementById('color-picker');

  AVATARS.forEach((a, i) => {
    const dot = document.createElement('span');
    dot.className = 'avatar-dot' + (i === 0 ? ' selected' : '');
    dot.textContent = a;
    dot.dataset.value = a;
    dot.onclick = () => selectPicker(avatarPicker, dot);
    avatarPicker.appendChild(dot);
  });

  COLORS.forEach((c, i) => {
    const dot = document.createElement('span');
    dot.className = 'color-dot' + (i === 0 ? ' selected' : '');
    dot.style.backgroundColor = c;
    dot.dataset.value = c;
    dot.onclick = () => selectPicker(colorPicker, dot);
    colorPicker.appendChild(dot);
  });

  document.getElementById('codename-input').value =
    ['夜莺', '孤狼', '星辰', '深海', '极光', '风影', '墨客', '云端'][Math.floor(Math.random() * 8)];

  document.getElementById('password-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doLogin();
  });
}

function selectPicker(container, dot) {
  container.querySelectorAll('.avatar-dot, .color-dot').forEach(d => d.classList.remove('selected'));
  dot.classList.add('selected');
}

function doLogin() {
  const codename = document.getElementById('codename-input').value.trim();
  const nickname = document.getElementById('nickname-input').value.trim();
  const avatarEl = document.querySelector('#avatar-picker .avatar-dot.selected');
  const colorEl = document.querySelector('#color-picker .color-dot.selected');
  const password = document.getElementById('password-input').value.trim();

  if (!codename || !nickname) {
    showLoginError('请输入代号和昵称');
    return;
  }
  if (password !== 'xmy_is_dog') {
    showLoginError('暗号不对哦');
    return;
  }

  const profile = {
    codename,
    nickname,
    avatar: avatarEl?.dataset.value || AVATARS[0],
    color: colorEl?.dataset.value || COLORS[0],
  };

  socket.emit('user:login', profile, (res) => {
    if (res.ok) {
      currentUser = res.user;
      sessionStorage.setItem('isLoggedIn', 'true');
      sessionStorage.setItem('userProfile', JSON.stringify(currentUser));
      enterApp();
    }
  });
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 2000);
}

// ==================== App Entry ====================
function enterApp() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app-layout').classList.add('active');

  updateSidebarUser();
  requestAllData();
  initRightSidebar();

  document.getElementById('top-title').textContent = '🎬 每日灵感';
  refreshInspiration();

  // Restore notepad locally first, then server will sync
  const localNote = localStorage.getItem('my_local_note');
  if (localNote && !document.getElementById('notepad').value) {
    document.getElementById('notepad').value = localNote;
  }
}

function updateSidebarUser() {
  if (!currentUser) return;
  document.getElementById('sidebar-avatar').textContent = currentUser.avatar;
  document.getElementById('sidebar-avatar').style.backgroundColor = currentUser.color;
  document.getElementById('sidebar-nick').textContent = currentUser.nickname;
  document.getElementById('sidebar-code').textContent = currentUser.codename;
}

function requestAllData() {
  socket.emit('board:request');
  socket.emit('chat:request');
  socket.emit('notepad:request');
}

// ==================== Sidebar Toggles ====================
function toggleSidebar() {
  document.getElementById('left-sidebar').classList.toggle('collapsed');
}

function toggleRightSidebar() {
  const rs = document.getElementById('right-sidebar');
  rs.classList.toggle('collapsed');
  const btn = document.getElementById('toggle-right-btn');
  if (rs.classList.contains('collapsed')) {
    btn.textContent = '◀';
    btn.title = '展开右侧栏';
  } else {
    btn.textContent = '▶';
    btn.title = '收起右侧栏';
  }
}

// ==================== Tab Switching ====================
function switchTab(panelId, menuItem) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));

  document.getElementById(panelId).classList.add('active');
  if (menuItem) {
    menuItem.classList.add('active');
    document.getElementById('top-title').textContent = menuItem.textContent.trim();
  }

  if (panelId === 'view-notepad') {
    socket.emit('notepad:request');
  }
}

// ==================== Inspiration ====================
const mockPlots = [
  '一个深夜，你房间里的老式收音机突然在没有插电的情况下，传出了你十年前好朋友的声音……',
  '所有人都在这一天失去了近5年的记忆，除了正在看着手机的你们几个人。',
  '你收到一封来自未来的匿名邮件，里面只有一张你们几人明天在咖啡厅聚会的合影，但照片背景里有一个巨大的倒计时屏幕。',
  '街角的旧书店里，每一本书都在悄悄记录着读者的秘密。今天，你发现了一本写有你名字的书。',
  '全球的镜子在同一时刻，不再反射现实，而是显示出另一个平行世界中的自己。',
];

function refreshInspiration() {
  fetch('https://v1.hitokoto.cn/?c=a&c=b&c=c')
    .then(r => r.json())
    .then(data => {
      document.getElementById('daily-quote').innerHTML = `&ldquo;${escapeHTML(data.hitokoto)}&rdquo;`;
      document.getElementById('daily-from').innerText = `—— 《${data.from}》`;
    })
    .catch(() => {
      document.getElementById('daily-quote').innerHTML = '&ldquo;生活不是你活过的样子，而是你记住的样子。&rdquo;';
      document.getElementById('daily-from').innerText = '—— 《百年孤独》';
    });

  document.getElementById('daily-plot').textContent = mockPlots[Math.floor(Math.random() * mockPlots.length)];
}

// ==================== Notepad ====================
let notepadDirty = false;
let notepadTimer = null;

function saveNote() {
  notepadDirty = true;
  clearTimeout(notepadTimer);
  const content = document.getElementById('notepad').value;
  localStorage.setItem('my_local_note', content);

  notepadTimer = setTimeout(() => {
    socket.emit('notepad:update', { content });
    notepadDirty = false;
  }, 400);
}

// ==================== Message Board ====================
function addMessage() {
  const input = document.getElementById('board-input');
  const content = input.value.trim();
  if (!content) return;
  socket.emit('board:message', content);
  input.value = '';
}

document.addEventListener('DOMContentLoaded', () => {
  const boardInput = document.getElementById('board-input');
  if (boardInput) {
    boardInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addMessage();
    });
  }
});

function renderBoardMessage(msg) {
  const container = document.getElementById('board-content');
  const div = document.createElement('div');
  const isSelf = msg.userId === socket.id;

  div.className = 'msg-bubble ' + (isSelf ? 'msg-self' : 'msg-other');
  div.innerHTML = `
    <div class="msg-sender">
      <span class="msg-sender-avatar" style="background:${msg.color}">${msg.avatar}</span>
      <span class="msg-sender-name">${escapeHTML(msg.codename)} · ${escapeHTML(msg.nickname)}</span>
    </div>
    <div>${escapeHTML(msg.content)}</div>
    <div class="msg-time">${formatTime(msg.timestamp)}</div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// ==================== Chat ====================
function sendChat() {
  const input = document.getElementById('chat-input');
  const content = input.value.trim();
  if (!content) return;
  socket.emit('chat:message', { content, aiEnabled: aiChatEnabled });
  input.value = '';
}

function toggleAI() {
  aiChatEnabled = !aiChatEnabled;
  const sw = document.getElementById('ai-switch');
  if (aiChatEnabled) {
    sw.classList.add('active');
    sw.parentElement.querySelector('span:last-child').textContent = 'AI 已开启';
  } else {
    sw.classList.remove('active');
    sw.parentElement.querySelector('span:last-child').textContent = 'AI 已关闭';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendChat();
    });
  }
});

function renderChatMessage(msg) {
  const container = document.getElementById('chat-content');
  const div = document.createElement('div');
  const isSelf = msg.userId === socket.id;
  const isAI = msg.isAI;

  if (isAI) {
    div.className = 'msg-bubble msg-ai';
    div.innerHTML = `
      <div class="msg-sender">
        <span class="msg-sender-avatar" style="background:${msg.color}">${msg.avatar}</span>
        <span class="msg-sender-name">${escapeHTML(msg.codename)}</span>
        ${msg.replyTo ? `<span style="font-size:11px;color:var(--text-tertiary)">→ @${escapeHTML(msg.replyTo)}</span>` : ''}
      </div>
      <div>${escapeHTML(msg.content)}</div>
      <div class="msg-time">${formatTime(msg.timestamp)}</div>
    `;
  } else {
    div.className = 'msg-bubble ' + (isSelf ? 'msg-self' : 'msg-other');
    div.innerHTML = `
      <div class="msg-sender">
        <span class="msg-sender-avatar" style="background:${msg.color}">${msg.avatar}</span>
        <span class="msg-sender-name">${escapeHTML(msg.codename)} · ${escapeHTML(msg.nickname)}</span>
      </div>
      <div>${escapeHTML(msg.content)}</div>
      <div class="msg-time">${formatTime(msg.timestamp)}</div>
    `;
  }
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// ==================== Right Sidebar ====================
function initRightSidebar() {
  updateOnlineUsers([]);
}

function updateOnlineUsers(users) {
  const list = document.getElementById('online-list');
  if (!list) return;
  list.innerHTML = '';

  if (users.length === 0) {
    list.innerHTML = '<li style="font-size:13px;color:var(--text-tertiary);padding:8px 10px;">暂无在线成员</li>';
    return;
  }

  users.forEach(u => {
    const li = document.createElement('li');
    li.className = 'online-user-item';
    li.innerHTML = `
      <span class="online-user-avatar" style="background:${u.color}">
        ${u.avatar}
        <span class="online-dot"></span>
      </span>
      <div>
        <div style="font-weight:600;font-size:13px;">${escapeHTML(u.nickname)}</div>
        <div style="font-size:11px;color:var(--text-tertiary);">${escapeHTML(u.codename)}</div>
      </div>
    `;
    list.appendChild(li);
  });

  document.getElementById('online-count').textContent = users.length;
}

// ==================== Socket Event Handlers ====================
socket.on('board:new', (msg) => {
  renderBoardMessage(msg);
  saveBoardToLocal(msg);
});

socket.on('board:history', (msgs) => {
  const container = document.getElementById('board-content');
  container.innerHTML = '';
  msgs.forEach(m => renderBoardMessage(m));
});

socket.on('chat:new', (msg) => {
  renderChatMessage(msg);
  saveChatToLocal(msg);
});

socket.on('chat:history', (msgs) => {
  const container = document.getElementById('chat-content');
  container.innerHTML = '';
  msgs.forEach(m => renderChatMessage(m));
});

socket.on('notepad:sync', (data) => {
  if (!notepadDirty) {
    document.getElementById('notepad').value = data.content || '';
    const status = document.getElementById('notepad-status');
    if (status && data.modifiedBy) {
      status.textContent = `最后编辑：${data.modifiedBy} · ${formatTime(data.modifiedAt)}`;
    }
  }
  localStorage.setItem('my_local_note', data.content || '');
});

socket.on('users:update', (users) => {
  updateOnlineUsers(users);
});

socket.on('user:joined', (user) => {
  showToast(`${user.nickname} (${user.codename}) 进入了基地`);
});

socket.on('user:left', (user) => {
  showToast(`${user.nickname} (${user.codename}) 离开了基地`);
});

// ==================== Local Backup ====================
function saveBoardToLocal(msg) {
  const msgs = JSON.parse(localStorage.getItem('my_local_msgs') || '[]');
  msgs.push(msg);
  if (msgs.length > 100) msgs.splice(0, msgs.length - 100);
  localStorage.setItem('my_local_msgs', JSON.stringify(msgs));
}

function saveChatToLocal(msg) {
  const msgs = JSON.parse(localStorage.getItem('my_local_chat') || '[]');
  msgs.push(msg);
  if (msgs.length > 100) msgs.splice(0, msgs.length - 100);
  localStorage.setItem('my_local_chat', JSON.stringify(msgs));
}

// ==================== Toast ====================
function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = `
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      background: rgba(30,30,32,0.9); color: white; padding: 10px 22px;
      border-radius: 20px; font-size: 13px; z-index: 999;
      backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
      pointer-events: none; transition: all 0.3s var(--ease-out-expo);
      opacity: 0; font-family: var(--font-stack);
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(8px)';
  }, 2000);
}

// ==================== Logout ====================
function logout() {
  sessionStorage.removeItem('isLoggedIn');
  sessionStorage.removeItem('userProfile');
  socket.disconnect();
  window.location.reload();
}

// ==================== Helpers ====================
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');

  if (d.toDateString() === now.toDateString()) {
    return `今天 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `昨天 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ==================== Init ====================
window.onload = function () {
  initLogin();

  // Check for saved session
  if (sessionStorage.getItem('isLoggedIn') === 'true') {
    const saved = sessionStorage.getItem('userProfile');
    if (saved) {
      try {
        currentUser = JSON.parse(saved);
        socket.emit('user:login', currentUser, (res) => {
          if (res.ok) {
            currentUser = res.user;
            enterApp();
          }
        });
      } catch (e) {
        sessionStorage.removeItem('isLoggedIn');
      }
    }
  }
};
