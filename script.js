// ==========================================
// 1. CONFIGURATION FIREBASE
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

// Enregistrement du Service Worker pour la PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker enregistré !', reg))
            .catch(err => console.log('Erreur d\'enregistrement SW :', err));
    });
}

// ==========================================
// 2. RÉCUPÉRATION DES ÉLÉMENTS HTML
// ==========================================
const authScreen = document.getElementById('authScreen');
const chatScreen = document.getElementById('chatScreen');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const notifSound = document.getElementById('notificationSound');

const menuToggleBtn = document.getElementById('menuToggleBtn');
const dropdownMenu = document.getElementById('dropdownMenu');
const editMsgBtn = document.getElementById('editMsgBtn');
const deleteMsgBtn = document.getElementById('deleteMsgBtn');
const themeBtn = document.getElementById('themeBtn');

let currentUserId = null;
let currentPeerId = null;
let chatRef = null;
let selectedMessageId = null;
let selectedMessageSender = null;

// Débloquer le son dès le premier clic sur l'écran
document.addEventListener('click', () => {
    if (notifSound && notifSound.paused) {
        notifSound.play().then(() => {
            notifSound.pause();
            notifSound.currentTime = 0;
        }).catch(e => console.log("Attente d'interaction :", e));
    }
}, { once: true });

// ==========================================
// 3. GESTION DE LA SÉCURITÉ & AUTH
// ==========================================
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUserId = user.email.split('@')[0];
        document.getElementById('myIdDisplay').innerText = `Mon ID : ${currentUserId}`;
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
    if(!id || pass.length < 6) return alert("Veuillez entrer un ID et un mot de passe (6 caractères min).");
    auth.createUserWithEmailAndPassword(`${id}@fedchat.com`, pass)
        .then(() => alert("Compte créé avec succès !"))
        .catch(err => alert("Erreur : " + err.message));
});

document.getElementById('loginBtn').addEventListener('click', () => {
    const id = document.getElementById('loginId').value.trim().toLowerCase();
    const pass = document.getElementById('loginPassword').value;
    if(!id || !pass) return alert("Veuillez remplir tous les champs.");
    auth.signInWithEmailAndPassword(`${id}@fedchat.com`, pass)
        .catch(err => alert("Erreur de connexion. Vérifiez votre ID ou mot de passe."));
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    auth.signOut();
    if(chatRef) chatRef.off();
    resetChatUI();
    dropdownMenu.classList.remove('show');
});

function resetChatUI() {
    document.getElementById('messagesArea').innerHTML = '<div class="system-message">Entrez un ID ci-dessus pour démarrer une conversation.</div>';
    document.getElementById('activeChatInfo').style.display = 'none';
    document.getElementById('messageInput').disabled = true;
    document.getElementById('sendBtn').disabled = true;
    clearSelection();
}

// ==========================================
// 4. GESTION DU MENU & ACTIONS
// ==========================================
menuToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle('show');
});
document.addEventListener('click', () => dropdownMenu.classList.remove('show'));

themeBtn.addEventListener('click', () => document.body.classList.toggle('light-theme'));

function clearSelection() {
    if(selectedMessageId) {
        const prevSelected = document.getElementById(selectedMessageId);
        if(prevSelected) prevSelected.classList.remove('selected');
    }
    selectedMessageId = null;
    selectedMessageSender = null;
    editMsgBtn.classList.add('disabled-menu-item');
    deleteMsgBtn.classList.add('disabled-menu-item');
}

// SUPPRIMER LE MESSAGE
deleteMsgBtn.addEventListener('click', () => {
    if(!selectedMessageId) return;
    
    if(confirm("Voulez-vous vraiment supprimer ce message ?")) {
        const chatId = [currentUserId, currentPeerId].sort().join('_');
        
        if (selectedMessageSender === currentUserId) {
            // C'est mon message : je le supprime pour TOUT LE MONDE
            db.ref(`chats/${chatId}/messages/${selectedMessageId}`).remove()
                .then(() => clearSelection())
                .catch(err => alert("Erreur: " + err.message));
        } else {
            // C'est le message de l'autre : je le cache uniquement pour MOI ("Delete for me")
            db.ref(`chats/${chatId}/messages/${selectedMessageId}/deletedFor/${currentUserId}`).set(true)
                .then(() => {
                    const bubble = document.getElementById(selectedMessageId);
                    if(bubble) bubble.remove();
                    clearSelection();
                })
                .catch(err => alert("Erreur: " + err.message));
        }
    }
});

// MODIFIER LE MESSAGE
editMsgBtn.addEventListener('click', () => {
    if(!selectedMessageId) return;
    if(selectedMessageSender !== currentUserId) {
        alert("Vous ne pouvez modifier que vos propres messages.");
        return;
    }
    
    // Récupérer uniquement le texte, pas l'heure
    const msgNode = document.getElementById(selectedMessageId);
    let currentText = "";
    for (let node of msgNode.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
            currentText += node.textContent;
        }
    }
    currentText = currentText.trim();
    
    const newText = prompt("Modifiez votre message :", currentText);
    
    if(newText && newText.trim() !== "" && newText.trim() !== currentText) {
        const chatId = [currentUserId, currentPeerId].sort().join('_');
        // On enregistre le texte et on active un paramètre "isEdited" au lieu d'ajouter le mot dans le texte
        db.ref(`chats/${chatId}/messages/${selectedMessageId}`).update({
            text: newText.trim(),
            isEdited: true
        }).then(() => clearSelection())
          .catch(err => alert("Erreur: " + err.message));
    }
});

// ==========================================
// 5. LOGIQUE DU CHAT
// ==========================================
document.getElementById('connectPeerBtn').addEventListener('click', () => {
    const peer = document.getElementById('peerIdInput').value.trim().toLowerCase();
    if(!peer || peer === currentUserId) return alert("ID non valide ou il s'agit de votre propre ID.");
    
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

    chatRef.on('child_added', (snapshot) => {
        const msg = snapshot.val();
        const msgKey = snapshot.key;
        
        // Si le message a été supprimé pour cet utilisateur spécifique, on ne l'affiche pas
        if (msg.deletedFor && msg.deletedFor[currentUserId]) return;
        
        const div = document.createElement('div');
        const isMe = msg.sender === currentUserId;
        div.className = `message-bubble ${isMe ? 'msg-sent' : 'msg-received'}`;
        div.id = msgKey;
        
        const timeString = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const editedTag = msg.isEdited ? ' <span style="font-size: 11px; opacity: 0.6; font-style: italic;">(Modifié)</span>' : '';
        
        div.innerHTML = `${msg.text}${editedTag}<span class="msg-time">${timeString}</span>`;
        
        // Sélectionner le message
        div.addEventListener('click', (e) => {
            e.stopPropagation();
            clearSelection();
            
            selectedMessageId = msgKey;
            selectedMessageSender = msg.sender;
            div.classList.add('selected');
            
            if(isMe) {
                editMsgBtn.classList.remove('disabled-menu-item'); // Peut modifier
                deleteMsgBtn.classList.remove('disabled-menu-item'); // Peut supprimer
            } else {
                editMsgBtn.classList.add('disabled-menu-item'); // Ne peut pas modifier le message de l'autre
                deleteMsgBtn.classList.remove('disabled-menu-item'); // MAIS PEUT LE SUPPRIMER POUR LUI
            }
        });
        
        messagesDiv.appendChild(div);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        
        // Jwe son sèlman si se lòt moun nan ki voye l
        if(!isMe && !isInitialLoad && notifSound) {
            notifSound.currentTime = 0;
            let playPromise = notifSound.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => console.log("Son an poko gen pèmisyon nan navigatè a"));
            }
        }
    });

    // Modification en temps réel
    chatRef.on('child_changed', (snapshot) => {
        const msgKey = snapshot.key;
        const msg = snapshot.val();
        const msgBubble = document.getElementById(msgKey);
        
        if (msg.deletedFor && msg.deletedFor[currentUserId]) {
            if(msgBubble) msgBubble.remove();
            return;
        }

        if(msgBubble) {
            const timeString = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const editedTag = msg.isEdited ? ' <span style="font-size: 11px; opacity: 0.6; font-style: italic;">(Modifié)</span>' : '';
            msgBubble.innerHTML = `${msg.text}${editedTag}<span class="msg-time">${timeString}</span>`;
        }
    });

    // Suppression en temps réel (pour tout le monde)
    chatRef.on('child_removed', (snapshot) => {
        const msgKey = snapshot.key;
        const msgBubble = document.getElementById(msgKey);
        if(msgBubble) msgBubble.remove();
    });

    chatRef.once('value').then(() => { isInitialLoad = false; });
}

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
