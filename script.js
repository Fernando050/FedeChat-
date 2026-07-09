// ==========================================
// 1. KONFIGIRASYON FIREBASE
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyDVv_oN6LDQzUEeO5-vxgiQKSnA4p39PSM",
    authDomain: "fedchat-e604b.firebaseapp.com",
    databaseURL: "https://fedchat-e604b-default-rtdb.firebaseio.com", // Ajoute pou mesaj yo ka mache
    projectId: "fedchat-e604b",
    storageBucket: "fedchat-e604b.firebasestorage.app",
    messagingSenderId: "988159515018",
    appId: "1:988159515018:web:93a09a3fd007d3771b9073"
};

// Inisyalize Firebase sèlman si li poko fèt
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.database();

// ==========================================
// 2. REKIPERE ELEMAN HTML YO
// ==========================================
const authScreen = document.getElementById('authScreen');
const chatScreen = document.getElementById('chatScreen');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');

const notifSound = document.getElementById('notificationSound');

// Varyab Eta (State)
let currentUserId = null;
let currentPeerId = null;
let chatRef = null;

// ==========================================
// 3. JERE SEKIRITE (STRICT AUTHENTICATION)
// ==========================================
auth.onAuthStateChanged((user) => {
    if (user) {
        // Moun nan konekte vre
        currentUserId = user.email.split('@')[0];
        document.getElementById('myIdDisplay').innerText = `ID Mwen: ${currentUserId}`;
        
        authScreen.classList.remove('active');
        chatScreen.classList.add('active');
    } else {
        // Moun nan dekonekte, bloke l deyò
        currentUserId = null;
        currentPeerId = null;
        
        chatScreen.classList.remove('active');
        authScreen.classList.add('active');
    }
});

// ==========================================
// 4. KREYE KONT AK KONEKTE
// ==========================================
document.getElementById('showSignup').addEventListener('click', () => {
    loginForm.style.display = 'none'; signupForm.style.display = 'block';
});
document.getElementById('showLogin').addEventListener('click', () => {
    signupForm.style.display = 'none'; loginForm.style.display = 'block';
});

// Fonksyon Kreye Kont
document.getElementById('signupBtn').addEventListener('click', () => {
    const id = document.getElementById('signupId').value.trim().toLowerCase();
    const pass = document.getElementById('signupPassword').value;
    
    if(!id || pass.length < 6) return alert("Mete yon ID epi yon modpas (6 karaktè min).");
    
    auth.createUserWithEmailAndPassword(`${id}@fedchat.com`, pass)
        .then(() => alert("Kont lan kreye avèk siksè!"))
        .catch(err => alert("Erè: " + err.message));
});

// Fonksyon Konekte
document.getElementById('loginBtn').addEventListener('click', () => {
    const id = document.getElementById('loginId').value.trim().toLowerCase();
    const pass = document.getElementById('loginPassword').value;
    
    if(!id || !pass) return alert("Tanpri ranpli tout bwat yo.");
    
    auth.signInWithEmailAndPassword(`${id}@fedchat.com`, pass)
        .catch(err => alert("Erè koneksyon. Tcheke ID oswa Modpas ou."));
});

// Fonksyon Dekonekte
document.getElementById('logoutBtn').addEventListener('click', () => {
    auth.signOut();
    if(chatRef) chatRef.off();
    document.getElementById('messagesArea').innerHTML = '<div class="system-message">Antre yon ID anlè a pou w kòmanse yon konvèsasyon sekirize.</div>';
    document.getElementById('activeChatInfo').style.display = 'none';
    document.getElementById('messageInput').disabled = true;
    document.getElementById('sendBtn').disabled = true;
});

// ==========================================
// 5. LOJIK POU CHAT POU CHAT (PEER TO PEER)
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

// Chaje Mesaj yo an tan reyèl
function loadMessages() {
    const chatId = [currentUserId, currentPeerId].sort().join('_');
    const messagesDiv = document.getElementById('messagesArea');
    
    if(chatRef) chatRef.off(); 
    
    chatRef = db.ref(`chats/${chatId}/messages`);
    messagesDiv.innerHTML = '';
    
    let isInitialLoad = true;

    chatRef.on('child_added', (snapshot) => {
        const msg = snapshot.val();
        const msgKey = snapshot.key;
        
        const div = document.createElement('div');
        const isMe = msg.sender === currentUserId;
        div.className = `message-bubble ${isMe ? 'msg-sent' : 'msg-received'}`;
        div.id = msgKey;
        
        const timeString = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        div.innerHTML = `
            ${msg.text}
            <span class="msg-time">${timeString}</span>
        `;
        
        messagesDiv.appendChild(div);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        
        if(!isMe && !isInitialLoad && notifSound) {
            notifSound.play().catch(e => console.log("Son bloke pa navigatè a"));
        }
    });

    chatRef.once('value').then(() => { isInitialLoad = false; });
}

// Voye yon Mesaj
document.getElementById('sendBtn').addEventListener('click', sendMessage);
document.getElementById('messageInput').addEventListener('keypress', (e) => {
    if(e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    
    if(!text || !currentPeerId) return;
    
    const chatId = [currentUserId, currentPeerId].sort().join('_');
    const newMessageRef = db.ref(`chats/${chatId}/messages`).push();
    
    newMessageRef.set({
        sender: currentUserId,
        text: text,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    
    input.value = '';
}
