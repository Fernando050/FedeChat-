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
// ELEMAN POU SON YO
const soundToggle = document.getElementById('soundToggle');
const soundSelect = document.getElementById('soundSelect');

// Chaje preferans itilizatè a si yo te sove yo deja
let isSoundEnabled = localStorage.getItem('fedchat_sound_enabled') !== 'false'; // True pa defo
let selectedSoundUrl = localStorage.getItem('fedchat_sound_url') || soundSelect.value;

// Aplike preferans yo
soundToggle.checked = isSoundEnabled;
soundSelect.value = selectedSoundUrl;
if (notifSound) notifSound.src = selectedSoundUrl;

// Lè moun nan aktive/dezaktive son an
soundToggle.addEventListener('change', (e) => {
    isSoundEnabled = e.target.checked;
    localStorage.setItem('fedchat_sound_enabled', isSoundEnabled); // Sove chwa a
});

// Lè moun nan chwazi yon lòt son
soundSelect.addEventListener('change', (e) => {
    selectedSoundUrl = e.target.value;
    if (notifSound) notifSound.src = selectedSoundUrl;
    localStorage.setItem('fedchat_sound_url', selectedSoundUrl); // Sove chwa a
    
    // Jwe ti bout son an pou l ka tande kisa l chwazi a (si son an aktive)
    if (isSoundEnabled && notifSound) {
        notifSound.currentTime = 0;
        notifSound.play().catch(err => console.log("En attente...", err));
    }
});

let currentUserId = null;
let currentPeerId = null;
let chatRef = null;
let selectedMessageId = null;
let selectedMessageSender = null;
let audioUnlocked = false;

// ==========================================
// DÉBLOQUER LE SON DE FORCE (Anti-blocage navigateur)
// ==========================================
function unlockAudio() {
    if (!audioUnlocked && notifSound) {
        notifSound.volume = 0; // Jwe l an silans avan pou navigatè a bay pèmisyon
        notifSound.play().then(() => {
            notifSound.pause();
            notifSound.currentTime = 0;
            notifSound.volume = 1; // Remete volim nan nòmal pou lè l ap sonnen vre
            audioUnlocked = true;
            // Retire aksyon an pou l pa plede fèt chak fwa
            document.removeEventListener('click', unlockAudio);
            document.removeEventListener('touchstart', unlockAudio);
        }).catch(e => console.warn("En attente du déblocage audio..."));
    }
}
// Ekoute premye fwa itilizatè a touche ekran an ou klike
document.addEventListener('click', unlockAudio);
document.addEventListener('touchstart', unlockAudio);

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
            // Supprimer pour tout le monde si c'est mon message
            db.ref(`chats/${chatId}/messages/${selectedMessageId}`).remove()
                .then(() => clearSelection())
                .catch(err => alert("Erreur: " + err.message));
        } else {
            // Supprimer uniquement pour moi ("Delete for me")
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
        db.ref(`chats/${chatId}/messages/${selectedMessageId}`).update({
            text: newText.trim(),
            isEdited: true // Se SÈLMAN LÈ SA li pral pase a true
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
        
        if (msg.deletedFor && msg.deletedFor[currentUserId]) return;
        
        const div = document.createElement('div');
        const isMe = msg.sender === currentUserId;
        div.className = `message-bubble ${isMe ? 'msg-sent' : 'msg-received'}`;
        div.id = msgKey;
        
        const timeString = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        // Verifikasyon Strik pou l pa mete "Modifié" pou granmesi
        const editedTag = (msg.isEdited === true) ? ' <span style="font-size: 11px; opacity: 0.6; font-style: italic;">(Modifié)</span>' : '';
        
        div.innerHTML = `${msg.text}${editedTag}<span class="msg-time">${timeString}</span>`;
        
        div.addEventListener('click', (e) => {
            e.stopPropagation();
            clearSelection();
            
            selectedMessageId = msgKey;
            selectedMessageSender = msg.sender;
            div.classList.add('selected');
            
            if(isMe) {
                editMsgBtn.classList.remove('disabled-menu-item'); 
                deleteMsgBtn.classList.remove('disabled-menu-item'); 
            } else {
                editMsgBtn.classList.add('disabled-menu-item'); 
                deleteMsgBtn.classList.remove('disabled-menu-item'); 
            }
        });
        
        messagesDiv.appendChild(div);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        
        // JOUER LE SON (Sèlman si bouton an aktive)
        if(!isMe && !isInitialLoad && notifSound && audioUnlocked && isSoundEnabled) {
            notifSound.currentTime = 0;
            notifSound.play().catch(e => console.log("Erreur audio non critique"));
        }
    });

    // Lè yon mesaj change (swa yo modifye l, swa lè a konfime)
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
            // Verifikasyon Strik : asire w isEdited vrèman VRAI avan w afiche mo a
            const editedTag = (msg.isEdited === true) ? ' <span style="font-size: 11px; opacity: 0.6; font-style: italic;">(Modifié)</span>' : '';
            msgBubble.innerHTML = `${msg.text}${editedTag}<span class="msg-time">${timeString}</span>`;
        }
    });

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

// ==========================================
// 6. SYSTÈME D'APPELS VIDÉO/AUDIO (PEERJS)
// ==========================================
let peer = null;
let currentCall = null;
let localStream = null;

const videoModal = document.getElementById('videoModal');
const callStatus = document.getElementById('callStatus');
const remoteVideo = document.getElementById('remoteVideo');
const localVideo = document.getElementById('localVideo');
const answerBtn = document.getElementById('answerBtn');
const hangupBtn = document.getElementById('hangupBtn');
const callBtn = document.getElementById('callBtn');
const callBtnContainer = document.getElementById('callBtnContainer');

// Inisyalize PeerJS lè moun nan konekte (Mete sa nan auth.onAuthStateChanged)
auth.onAuthStateChanged((user) => {
    if (user) {
        // ... (Ansyen kòd yo rete la)
        currentUserId = user.email.split('@')[0];
        
        // Fèmen ansyen koneksyon Peer la si l te egziste
        if (peer) peer.destroy();
        
        // Kreye nouvo koneksyon an avèk ID itilizatè a
        peer = new Peer(currentUserId);
        
        peer.on('open', (id) => {
            console.log("Sistèm apèl la pare avèk ID: " + id);
        });

        // Lè yon moun ap rele w
        peer.on('call', (call) => {
            videoModal.style.display = 'flex';
            callStatus.innerText = call.peer + " ap rele w...";
            answerBtn.style.display = 'block';

            // Si w chwazi reponn
            answerBtn.onclick = () => {
                navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                .then((stream) => {
                    localStream = stream;
                    localVideo.srcObject = stream;
                    answerBtn.style.display = 'none';
                    callStatus.innerText = "W ap pale ak " + call.peer;
                    
                    call.answer(stream); // Voye videyo pa w la ba li
                    currentCall = call;

                    call.on('stream', (remoteStream) => {
                        remoteVideo.srcObject = remoteStream; // Afiche videyo l la
                    });
                    
                    call.on('close', stopCallUI);
                })
                .catch(err => alert("Nou pa ka jwenn aksè ak Kamera/Mikwo a."));
            };
        });
    }
});

// Pou w wè bouton rele a lè w chwazi yon moun
document.getElementById('connectPeerBtn').addEventListener('click', () => {
    // Bouton an ap parèt otomatikman
    if(currentPeerId && currentPeerId !== currentUserId) {
        callBtnContainer.style.display = 'block';
    }
});

// Lè w klike sou bouton Rele a
callBtn.addEventListener('click', () => {
    if(!currentPeerId || !peer) return;
    
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then((stream) => {
        localStream = stream;
        localVideo.srcObject = stream;
        
        videoModal.style.display = 'flex';
        callStatus.innerText = "W ap sonnen " + currentPeerId + "...";
        answerBtn.style.display = 'none';
        
        // Lanse apèl la
        const call = peer.call(currentPeerId, stream);
        currentCall = call;

        call.on('stream', (remoteStream) => {
             callStatus.innerText = "W ap pale ak " + currentPeerId;
             remoteVideo.srcObject = remoteStream; // Afiche videyo l la lè l reponn
        });
        
        call.on('close', stopCallUI);
    })
    .catch(err => alert("Nou pa ka jwenn aksè ak Kamera/Mikwo a."));
});

// Bouton pou fèmen apèl la
hangupBtn.addEventListener('click', () => {
    if(currentCall) currentCall.close();
    stopCallUI();
});

// Netwaye ekran an epi fèmen kamera a lè apèl la fini
function stopCallUI() {
    videoModal.style.display = 'none';
    if(localStream) {
        localStream.getTracks().forEach(track => track.stop()); // Fèmen limyè kamera a
    }
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
    currentCall = null;
}

