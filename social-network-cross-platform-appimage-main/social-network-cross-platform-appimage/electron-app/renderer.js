const { shell } = require('electron');

let ws;
let currentToken = localStorage.getItem('session_token');
let selectedUser = null;
let isOffline = !navigator.onLine;

// Эмодзи
const emojis = ["😀", "😂", "🥰", "😎", "🤔", "😢", "😡", "👍", "🔥"];
const emojiPicker = document.getElementById('emoji-picker');
emojis.forEach(e => {
    let span = document.createElement('span');
    span.className = 'emoji';
    span.innerText = e;
    span.onclick = () => document.getElementById('message-input').value += e;
    emojiPicker.appendChild(span);
});

// Проверка сессии при загрузке
if (currentToken) {
    showChatScreen();
    connectWebSocket();
}

function openRegistration() {
    // Редирект на веб-версию соцсети
    shell.openExternal('http://localhost:3000/register');
}

async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (isOffline) {
        alert("Невозможно войти без интернета!");
        return;
    }

    try {
        // Подставь здесь свой эндпоинт из твоего Go бэкенда
        const response = await fetch('http://localhost:8080/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (response.ok) {
            const data = await response.json();
            currentToken = data.token; // или как токен возвращается в твоем API
            localStorage.setItem('session_token', currentToken);
            showChatScreen();
            connectWebSocket();
        } else {
            alert("Неверный email или пароль");
        }
    } catch (error) {
        alert("Ошибка подключения к серверу");
    }
}

function logout() {
    localStorage.removeItem('session_token');
    if (ws) ws.close();
    document.getElementById('chat-screen').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
}

function showChatScreen() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('chat-screen').style.display = 'flex';
    loadOfflineMessages();
}

// === WebSocket Логика ===
function connectWebSocket() {
    // Подключаемся к WebSocket твоего бэкенда
    ws = new WebSocket(`ws://localhost:8080/ws?token=${currentToken}`);

    ws.onopen = () => console.log('Подключено к WS');

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
            case 'USER_STATUS':
                updateUserStatus(data.userId, data.isOnline);
                break;
            case 'NEW_MESSAGE':
                saveMessageLocally(data.message);
                if (selectedUser === data.message.fromId || data.message.fromId === 'me') {
                    renderMessage(data.message);
                } else {
                    notifyUser(data.message);
                }
                break;
            case 'USER_LIST':
                renderUsers(data.users);
                break;
        }
    };

    ws.onclose = () => {
        if (!isOffline) setTimeout(connectWebSocket, 3000); // Реконнект
    };
}

function sendMessage() {
    if (isOffline) {
        alert("Нет соединения. Оффлайн режим позволяет только просматривать историю.");
        return;
    }

    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (!text || !selectedUser) return;

    const msg = {
        type: 'SEND_MESSAGE',
        toId: selectedUser,
        content: text,
        timestamp: new Date().toISOString()
    };

    ws.send(JSON.stringify(msg));
    
    // Оптимистичный рендеринг для себя
    const localMsg = { ...msg, fromId: 'me' };
    saveMessageLocally(localMsg);
    renderMessage(localMsg);
    input.value = '';
    emojiPicker.style.display = 'none';
}

function toggleEmojis() {
    emojiPicker.style.display = emojiPicker.style.display === 'block' ? 'none' : 'block';
}

// === Отрисовка UI ===
function renderUsers(users) {
    const list = document.getElementById('users-list');
    list.innerHTML = '';
    users.forEach(user => {
        const div = document.createElement('div');
        div.className = 'user-item';
        div.onclick = () => selectUser(user);
        div.innerHTML = `
            <span>${user.nickname || user.first_name}</span>
            <div class="status-dot ${user.isOnline ? 'online' : ''}" id="status-${user.id}"></div>
        `;
        list.appendChild(div);
    });
}

function updateUserStatus(userId, isOnline) {
    const dot = document.getElementById(`status-${userId}`);
    if (dot) {
        dot.className = `status-dot ${isOnline ? 'online' : ''}`;
    }
}

function selectUser(user) {
    selectedUser = user.id;
    document.getElementById('chat-with').innerText = `Чат с: ${user.nickname || user.first_name}`;
    loadOfflineMessages(); // Подгружаем локальную историю с этим юзером
}

function renderMessage(msg) {
    const area = document.getElementById('messages-area');
    const div = document.createElement('div');
    div.className = `message ${msg.fromId === 'me' ? 'msg-mine' : 'msg-theirs'}`;
    div.innerText = msg.content;
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
}

// === Оффлайн хранилище (LocalStorage) ===
function saveMessageLocally(msg) {
    // В реальном проекте лучше использовать IndexedDB
    let history = JSON.parse(localStorage.getItem('chat_history')) || [];
    history.push(msg);
    localStorage.setItem('chat_history', JSON.stringify(history));
}

function loadOfflineMessages() {
    const area = document.getElementById('messages-area');
    area.innerHTML = '';
    let history = JSON.parse(localStorage.getItem('chat_history')) || [];
    
    // Фильтруем сообщения только для текущего чата
    history.filter(m => m.toId === selectedUser || m.fromId === selectedUser)
           .forEach(renderMessage);
}

// === Оффлайн/Онлайн отслеживание ===
window.addEventListener('offline', () => {
    isOffline = true;
    document.getElementById('offline-banner').style.display = 'block';
    document.getElementById('send-btn').disabled = true;
    document.getElementById('message-input').disabled = true;
});

window.addEventListener('online', () => {
    isOffline = false;
    document.getElementById('offline-banner').style.display = 'none';
    document.getElementById('send-btn').disabled = false;
    document.getElementById('message-input').disabled = false;
    if (currentToken) connectWebSocket();
});

// === Интерактивный поиск ===
document.getElementById('search-bar').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const messages = document.querySelectorAll('.message');
    
    messages.forEach(msg => {
        if (msg.innerText.toLowerCase().includes(query)) {
            msg.style.display = 'block';
            // Опционально: подсветка текста
        } else {
            msg.style.display = 'none';
        }
    });
});

// Уведомления (HTML5 Desktop Notifications)
function notifyUser(msg) {
    if (Notification.permission === 'granted') {
        new Notification("Новое сообщение", { body: msg.content });
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                new Notification("Новое сообщение", { body: msg.content });
            }
        });
    }
}