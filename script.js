// ==========================================
// 1. PWA - ENSTALE APLIKASYON AN
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.error(err));
    });
}

let deferredPrompt;
const installAppBtn = document.getElementById('installAppBtn');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installAppBtn) installAppBtn.style.display = 'block';
});

if (installAppBtn) {
    installAppBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            deferredPrompt = null;
            installAppBtn.style.display = 'none';
        }
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

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// Varyab Global
let currentUserId = null;
let currentPeerId = null;
let chatRef = null;
let selectedMessageKey = null; // Pou kenbe memwa kilès mesaj nou chwazi a

// ==========================================
// 3. JERE MENI PRENSIPAL LA AK TÈM NAN
// ==========================================
const headerMenuBtn = document.getElementById('headerMenuBtn');
const headerDropdown = document.getElementById('headerDropdown');
const menuThemeBtn = document.getElementById('menuThemeBtn');
const menuEditBtn = document.getElementById('menuEditBtn');
const menuDeleteBtn = document.getElementById('menuDeleteBtn');
const menuLogoutBtn = document.getElementById('menuLogoutBtn');

// Ouvri/Fèmen Meni an
headerMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    headerDropdown.classList.toggle('show');
});

// Fèmen meni si w klike deyò
document.addEventListener('click', () => {
    headerDropdown.classList.remove('show');
});
// Anpeche klik anndan meni an fèmen l brital
headerDropdown.addEventListener('click', (e) => e.stopPropagation());

// Chanje Tèm
const themes = ['', 'light-theme', 'hacker-theme'];
let currentThemeIndex = parseInt(localStorage.getItem('fedchat-theme')) || 0;
document.body.className = themes[currentThemeIndex];

menuThemeBtn.addEventListener('click', () => {
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    document.body.className = themes[currentThemeIndex];
    localStorage.setItem('fedchat-theme', currentThemeIndex);
    headerDropdown.classList.remove('show'); // fèmen meni an apre
});

// ==========================================
// 4. KONEKSYON AK SEKIRITE
// ==========================================
const authScreen = document.getElementById('authScreen');
const chatScreen = document.getElementById('chatScreen');

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
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'block';
});
document.getElementById('showLogin').addEventListener('click', () => {
    document.getElementById('signupForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
});

document.getElementById('signupBtn').addEventListener('click', () => {
    const id = document.getElementById('signupId').value.trim().toLowerCase();
    const pass = document.getElementById('signupPassword').value;
    if(!id || pass.length < 6) return alert("Mete yon ID epi yon modpas (6 karaktè min).");
    auth.createUserWithEmailAndPassword(`${id}@fedchat.com`, pass).then(() => alert("Siksè!")).catch(e => alert(e.message));
});

document.getElementById('loginBtn').addEventListener('click', () => {
    const id = document.getElementById('loginId').value.trim().toLowerCase();
    const pass = document.getElementById('loginPassword').value;
    if(!id || !pass) return alert("Ranpli tout bwat yo.");
    auth.signInWithEmailAndPassword(`${id}@fedchat.com`, pass).catch(() => alert("Erè koneksyon."));
});

menuLogoutBtn.addEventListener('click', () => {
    auth.signOut();
    if(chatRef) chatRef.off();
    document.getElementById('messagesArea').innerHTML = '<div class="system-message">Antre yon ID anlè a.</div>';
    headerDropdown.classList.remove('show');
    clearMessageSelection(); // Efase tout seleksyon yo si l ap dekonekte
});

// ==========================================
// 5. CHAT AK SELEKSYON MESAJ
// ==========================================
document.getElementById('connectPeerBtn').addEventListener('click', () => {
    const peer = document.getElementById('peerIdInput').value.trim().toLowerCase();
    if(!peer || peer === currentUserId) return alert("ID a pa valab.");
    currentPeerId = peer;
    document.getElementById('activeChatInfo').style.display = 'block';
    document.getElementById('chattingWithDisplay').innerText = currentPeerId;
    document.getElementById('messageInput').disabled = false;
    document.getElementById('sendBtn').disabled = false;
    clearMessageSelection();
    loadMessages();
});

function loadMessages() {
    const chatId = [currentUserId, currentPeerId].sort().join('_');
    const messagesDiv = document.getElementById('messagesArea');
    if(chatRef) chatRef.off(); 
    chatRef = db.ref(`chats/${chatId}/messages`);
    messagesDiv.innerHTML = '';
    
    chatRef.on('child_added', (snapshot) => {
        const msg = snapshot.val();
        const msgKey = snapshot.key;
        const div = document.createElement('div');
        const isMe = msg.sender === currentUserId;
        div.className = `message-bubble ${isMe ? 'msg-sent' : 'msg-received'}`;
        div.id = msgKey;
        
        const timeString = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        div.innerHTML = `
            <span class="msg-text">${msg.text}</span>
            <span class="msg-time">${timeString} ${msg.edited ? '(modifye)' : ''}</span>
        `;
        
        // Pèmèt seleksyone mesaj la si se ou ki te voye l
        if (isMe) {
            div.addEventListener('click', (e) => {
                e.stopPropagation();
                selectMessage(msgKey, div);
            });
        }
        
        messagesDiv.appendChild(div);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });

    chatRef.on('child_changed', (snapshot) => {
        const msgDiv = document.getElementById(snapshot.key);
        if (msgDiv) {
            msgDiv.querySelector('.msg-text').innerText = snapshot.val().text;
            const timeSpan = msgDiv.querySelector('.msg-time');
            if(!timeSpan.innerText.includes('modifye')) timeSpan.innerText += ' (modifye)';
        }
    });

    chatRef.on('child_removed', (snapshot) => {
        const msgDiv = document.getElementById(snapshot.key);
        if (msgDiv) msgDiv.remove();
        if (selectedMessageKey === snapshot.key) clearMessageSelection();
    });
}

// Voye Mesaj
document.getElementById('sendBtn').addEventListener('click', sendMessage);
document.getElementById('messageInput').addEventListener('keypress', (e) => { if(e.key === 'Enter') sendMessage(); });

function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if(!text || !currentPeerId) return;
    const chatId = [currentUserId, currentPeerId].sort().join('_');
    db.ref(`chats/${chatId}/messages`).push().set({
        sender: currentUserId, text: text, timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    input.value = '';
    clearMessageSelection(); // Retire seleksyon an si w voye yon nouvo mesaj
}

// ==========================================
// 6. LOJIK SELEKSYONE, MODIFYE AK EFASE
// ==========================================

function selectMessage(msgKey, element) {
    // Retire style seleksyone nan tout ansyen mesaj yo
    document.querySelectorAll('.selected-msg').forEach(el => el.classList.remove('selected-msg'));
    
    // Si w klike sou mesaj ki te deja seleksyone a, li deseleksyone l
    if (selectedMessageKey === msgKey) {
        clearMessageSelection();
        return;
    }

    // Aplike nouvo seleksyon an
    selectedMessageKey = msgKey;
    element.classList.add('selected-msg');
    
    // Fè bouton modifye ak efase yo parèt nan meni an
    menuEditBtn.style.display = 'block';
    menuDeleteBtn.style.display = 'block';
}

function clearMessageSelection() {
    selectedMessageKey = null;
    document.querySelectorAll('.selected-msg').forEach(el => el.classList.remove('selected-msg'));
    // Kache bouton modifye ak efase yo anndan meni an
    menuEditBtn.style.display = 'none';
    menuDeleteBtn.style.display = 'none';
}

// Klike nan nenpòt espas vid nan zòn mesaj la anile seleksyon an
document.getElementById('messagesArea').addEventListener('click', clearMessageSelection);

// Lè w klike 'Modifye' nan meni an
menuEditBtn.addEventListener('click', () => {
    if (!selectedMessageKey) return;
    const msgDiv = document.getElementById(selectedMessageKey);
    const oldText = msgDiv.querySelector('.msg-text').innerText;
    
    const newText = prompt("Modifye mesaj ou a:", oldText);
    
    if (newText && newText.trim() !== "" && newText !== oldText) {
        const chatId = [currentUserId, currentPeerId].sort().join('_');
        db.ref(`chats/${chatId}/messages/${selectedMessageKey}`).update({
            text: newText.trim(),
            edited: true
        });
    }
    headerDropdown.classList.remove('show');
    clearMessageSelection();
});

// Lè w klike 'Efase' nan meni an
menuDeleteBtn.addEventListener('click', () => {
    if (!selectedMessageKey) return;
    if (confirm("Ou sèten ou vle efase mesaj sa?")) {
        const chatId = [currentUserId, currentPeerId].sort().join('_');
        db.ref(`chats/${chatId}/messages/${selectedMessageKey}`).remove();
    }
    headerDropdown.classList.remove('show');
    clearMessageSelection();
});
