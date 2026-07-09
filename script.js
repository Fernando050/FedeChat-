// ==========================================
// 1. ANREJISTRE SERVICE WORKER (POU PWA / APP)
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('PWA Anrejistre kòrèkteman!', reg))
            .catch(err => console.error('PWA Echwe', err));
    });
}

// ==========================================
// 2. KONFIGIRASYON FIREBASE
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyDVv_oN6LDQzUEeO5-vxgiQKSnA4p39PSM",
    authDomain: "fedchat-e604b.firebaseapp.com",
    databaseURL: "https://fedchat-e604b-default-rtdb.firebaseio.com",
    projectId: "fedchat-e604b",
    storageBucket: "fedchat-e604b.firebasestorage.app",
    messagingSenderId: "988159515018",
    appId: "1:988159515018:web:93a09a3fd007d3771b9073"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.database();

// Rekipere Eleman yo
const authScreen = document.getElementById('authScreen');
const chatScreen = document.getElementById('chatScreen');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const notifSound = document.getElementById('notificationSound');

let currentUserId = null;
let currentPeerId = null;
let chatRef = null;

// ==========================================
// 3. SISTÈM TÈM (Nwa, Klè, Hack)
// ==========================================
const themeBtn = document.getElementById('themeBtn');
const themes = ['', 'light-theme', 'hacker-theme'];
let currentThemeIndex = parseInt(localStorage.getItem('fedchat-theme')) || 0;

document.body.className = themes[currentThemeIndex];

themeBtn.addEventListener('click', () => {
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    document.body.className = themes[currentThemeIndex];
    localStorage.setItem('fedchat-theme', currentThemeIndex);
});

// ==========================================
// 4. JERE SEKIRITE & KONEKSYON
// ==========================================
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUserId = user.email.split('@')[0];
        document.getElementById('myIdDisplay').innerText = `ID Mwen: ${currentUserId}`;
        authScreen.classList.remove('active');
        chatScreen.classList.add('active');
    } else {
        currentUserId = null;
        currentPeerId = null;
        chatScreen.classList.remove('active');
        authScreen.classList.add('active');
    }
});

document.getElementById('showSignup').addEventListener('click', () => {
    loginForm.style.display = 'none'; signupForm.style.display = 'block';
});
document.getElementById('showLogin').addEventListener('click', () => {
    signupForm.style.display = 'none'; loginForm.style.display = 'block';
});

document.getElementById('signupBtn').addEventListener('click', () => {
    const id = document.getElementById('signupId').value.trim().toLowerCase();
    const pass = document.getElementById('signupPassword').value;
    if(!id || pass.length < 6) return alert("Mete yon ID epi yon modpas (6 karaktè min).");
    
    auth.createUserWithEmailAndPassword(`${id}@fedchat.com`, pass)
        .then(() => alert("Kont lan kreye avèk siksè!"))
        .catch(err => alert("Erè: " + err.message));
});

document.getElementById('loginBtn').addEventListener('click', () => {
    const id = document.getElementById('loginId').value.trim().toLowerCase();
    const pass = document.getElementById('loginPassword').value;
    if(!id || !pass) return alert("Tanpri ranpli tout bwat yo.");
    
    auth.signInWithEmailAndPassword(`${id}@fedchat.com`, pass)
        .catch(err => alert("Erè koneksyon. Tcheke ID oswa Modpas ou."));
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    auth.signOut();
    if(chatRef) chatRef.off();
    document.getElementById('messagesArea').innerHTML = '<div class="system-message">Antre yon ID anlè a pou w kòmanse.</div>';
    document.getElementById('activeChatInfo').style.display = 'none';
    document.getElementById('messageInput').disabled = true;
    document.getElementById('sendBtn').disabled = true;
});

// ==========================================
// 5. CHAT POU CHAT AK KONSTRIKSYON MENI AN
// ==========================================
document.getElementById('connectPeerBtn').addEventListener('click', () => {
    const peer = document.getElementById('peerIdInput').value.trim().toLowerCase();
    if(!peer || peer === currentUserId) return alert("ID a pa valab oswa se pwòp ID ou.");
    
    currentPeerId = peer;
    document.getElementById('activeChatInfo').style.display = 'block';
    document.getElementById('chattingWithDisplay').innerText = currentPeerId;
    document.getElementById('messageInput').disabled = false;
    document.getElementById('sendBtn').disabled = false;
    
    loadMessages();
});

function loadMessages() {
    const chatId = [currentUserId, currentPeerId].sort().join('_');
    const messagesDiv = document.getElementById('messagesArea');
    
    if(chatRef) chatRef.off(); 
    chatRef = db.ref(`chats/${chatId}/messages`);
    messagesDiv.innerHTML = '';
    
    let isInitialLoad = true;

    // Lè yon nouvo mesaj antre
    chatRef.on('child_added', (snapshot) => {
        const msg = snapshot.val();
        const msgKey = snapshot.key;
        
        const div = document.createElement('div');
        const isMe = msg.sender === currentUserId;
        div.className = `message-bubble ${isMe ? 'msg-sent' : 'msg-received'}`;
        div.id = msgKey;
        
        const timeString = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        let actionButtons = '';
        if (isMe) {
            actionButtons = `
            <button class="msg-menu-btn" onclick="toggleMenu('${msgKey}')">⋮</button>
            <div class="msg-dropdown" id="menu-${msgKey}">
                <button onclick="editMessage('${msgKey}')">✏️ Modifye</button>
                <button class="delete-btn" onclick="deleteMessage('${msgKey}')">🗑️ Efase</button>
            </div>`;
        }
        
        div.innerHTML = `
            <span class="msg-text">${msg.text}</span>
            ${actionButtons}
            <span class="msg-time">${timeString} ${msg.edited ? '(modifye)' : ''}</span>
        `;
        
        messagesDiv.appendChild(div);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        
        if(!isMe && !isInitialLoad && notifSound) {
            notifSound.play().catch(() => {});
        }
    });

    // Lè yon mesaj modifye
    chatRef.on('child_changed', (snapshot) => {
        const msgKey = snapshot.key;
        const msg = snapshot.val();
        const msgDiv = document.getElementById(msgKey);
        if (msgDiv) {
            msgDiv.querySelector('.msg-text').innerText = msg.text;
            const timeSpan = msgDiv.querySelector('.msg-time');
            if(!timeSpan.innerText.includes('modifye')) timeSpan.innerText += ' (modifye)';
        }
    });

    // Lè yon mesaj efase
    chatRef.on('child_removed', (snapshot) => {
        const msgKey = snapshot.key;
        const msgDiv = document.getElementById(msgKey);
        if (msgDiv) msgDiv.remove();
    });

    chatRef.once('value').then(() => { isInitialLoad = false; });
}

// Voye Mesaj
document.getElementById('sendBtn').addEventListener('click', sendMessage);
document.getElementById('messageInput').addEventListener('keypress', (e) => {
    if(e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if(!text || !currentPeerId) return;
    
    const chatId = [currentUserId, currentPeerId].sort().join('_');
    db.ref(`chats/${chatId}/messages`).push().set({
        sender: currentUserId,
        text: text,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    
    input.value = '';
}

// ==========================================
// 6. FONKSYON POU JERE MENI, MODIFYE AK EFASE
// ==========================================

// Ouvri/Fèmen Meni Twa Pwen an
window.toggleMenu = function(msgKey) {
    // Fèmen tout lòt meni ki ta ouvè yo dabò
    document.querySelectorAll('.msg-dropdown.show').forEach(menu => {
        if (menu.id !== `menu-${msgKey}`) menu.classList.remove('show');
    });
    
    // Basile meni ou fèk klike a
    const menu = document.getElementById(`menu-${msgKey}`);
    if (menu) {
        menu.classList.toggle('show');
    }
};

// Klike deyò pou fèmen meni an otomatik
document.addEventListener('click', (event) => {
    if (!event.target.matches('.msg-menu-btn')) {
        document.querySelectorAll('.msg-dropdown.show').forEach(menu => {
            menu.classList.remove('show');
        });
    }
});

// Fonksyon Modifye
window.editMessage = function(msgKey) {
    const msgDiv = document.getElementById(msgKey);
    const oldText = msgDiv.querySelector('.msg-text').innerText;
    
    const newText = prompt("Modifye mesaj ou a:", oldText);
    
    if (newText && newText.trim() !== "" && newText !== oldText) {
        const chatId = [currentUserId, currentPeerId].sort().join('_');
        db.ref(`chats/${chatId}/messages/${msgKey}`).update({
            text: newText.trim(),
            edited: true
        });
    }
    // Fèmen meni an
    document.getElementById(`menu-${msgKey}`).classList.remove('show');
};

// Fonksyon Efase
window.deleteMessage = function(msgKey) {
    if (confirm("Ou sèten ou vle efase mesaj sa?")) {
        const chatId = [currentUserId, currentPeerId].sort().join('_');
        db.ref(`chats/${chatId}/messages/${msgKey}`).remove();
    }
};
