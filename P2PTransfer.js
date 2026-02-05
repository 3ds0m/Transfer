// --- Configuración y Estado ---
const CHUNK_SIZE = 64 * 1024; // 64KB for better throughput
let peer;
let conn;
let myId = '';
let fileToSend;
let receivedBuffers = [];
let receivedSize = 0;
let expectedSize = 0;
let fileMeta = {};
let isScanning = false;

// --- Traducciones ---
const translations = {
    es: {
        title: "Transferencia P2P Rápida",
        subtitle: "Transfiere archivos usando un código corto de 6 caracteres.",
        send: "Enviar Archivo",
        receive: "Recibir Archivo",
        back: "Volver",
        senderMode: "Modo: Enviar",
        receiverMode: "Modo: Recibir",
        step1Desc: "1. Tu ID de conexión (Compártelo):",
        step2Desc: "Esperando a que el receptor se conecte...",
        copy: "Copiar",
        connect: "Conectar",
        scanQr: "Escanear QR",
        stepRec1Desc: "1. Ingresa el ID del emisor o escanea QR:",
        waitingForConnection: "Esperando conexión...",
        sending: "Enviando archivo...",
        receiving: "Recibiendo archivo...",
        download: "Descargar Archivo",
        offerCodePlaceholder: "Generando ID...",
        generating: "Conectando al servidor de señalización...",
        offerCodeInputPlaceholder: "Ej: X9Y2Z1",
        fileSelected: "Archivo seleccionado: ",
        connEstablished: "¡Conectado! Iniciando transferencia...",
        connFailed: "Conexión fallida. Intenta de nuevo.",
        transferComplete: "Transferencia completada!",
        stopScan: "Detener Cámara",
        enterId: "Ingresa el ID del emisor",
        dragDropText: "Arrastra y suelta un archivo aquí o",
        selectFileBtn: "Seleccionar archivo",
        warningMsg: "⚠️ Importante: No cierres esta página hasta que el archivo haya sido recibido completamente.",
        fileReceivedSender: "Archivo recibido por el destinatario. Esperando descarga...",
        fileDownloadedSender: "¡Archivo descargado exitosamente!",
        safeToClose: "✅ Archivo entregado y descargado. Es seguro cerrar esta página.",
        waitingPeer: "Conectado. Esperando al otro dispositivo...",
        verifying: "Verificando recepción...",
        chatTitle: "Chat",
        chatPlaceholder: "Escribe un mensaje..."
    },
    en: {
        title: "Fast P2P Transfer",
        subtitle: "Transfer files using a short 6-character code.",
        send: "Send File",
        receive: "Receive File",
        back: "Back",
        senderMode: "Sender Mode",
        receiverMode: "Receiver Mode",
        step1Desc: "1. Your Connection ID (Share it):",
        step2Desc: "Waiting for receiver to connect...",
        copy: "Copy",
        connect: "Connect",
        scanQr: "Scan QR",
        stepRec1Desc: "1. Enter sender ID or scan QR:",
        waitingForConnection: "Waiting for connection...",
        sending: "Sending file...",
        receiving: "Receiving file...",
        download: "Download File",
        offerCodePlaceholder: "Generating ID...",
        generating: "Connecting to signaling server...",
        offerCodeInputPlaceholder: "Ex: X9Y2Z1",
        fileSelected: "File selected: ",
        connEstablished: "Connected! Starting transfer...",
        connFailed: "Connection failed. Try again.",
        transferComplete: "Transfer complete!",
        stopScan: "Stop Camera",
        enterId: "Enter Sender ID",
        dragDropText: "Drag and drop a file here or",
        selectFileBtn: "Select File",
        warningMsg: "⚠️ Important: Do not close this page until the file has been fully received.",
        fileReceivedSender: "File received by recipient. Waiting for download...",
        fileDownloadedSender: "File downloaded successfully!",
        safeToClose: "✅ File delivered and downloaded. It is safe to close this page.",
        waitingPeer: "Connected. Waiting for peer...",
        verifying: "Verifying receipt...",
        chatTitle: "Chat",
        chatPlaceholder: "Type a message..."
    }
};

let currentLang = 'es';

// --- UI Logic ---
function init() {
    // Theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.getElementById('themeToggle').textContent = savedTheme === 'dark' ? '☀️' : '🌙';

    // Listeners
    document.getElementById('themeToggle').onclick = toggleTheme;
    document.getElementById('langSelect').onchange = (e) => setLanguage(e.target.value);
    document.getElementById('senderBtn').onclick = startSenderFlow;
    document.getElementById('receiverBtn').onclick = startReceiverFlow;
    
    // Sender
    document.getElementById('fileInput').onchange = handleFileSelect;
    document.getElementById('customFileBtn').onclick = () => document.getElementById('fileInput').click();
    
    const uploadZone = document.getElementById('uploadZone');
    uploadZone.addEventListener('dragover', handleDragOver);
    uploadZone.addEventListener('dragleave', handleDragLeave);
    uploadZone.addEventListener('drop', handleDrop);

    document.getElementById('copyOfferBtn').onclick = () => copyToClipboard('offerCode');

    // Receiver
    document.getElementById('scanQrBtn').onclick = toggleQRScanner;
    document.getElementById('offerCodeInput').oninput = (e) => {
        e.target.value = e.target.value.toUpperCase(); // Force uppercase
        document.getElementById('connectBtn').disabled = e.target.value.trim().length < 4;
    };
    document.getElementById('connectBtn').onclick = connectToPeer;

    // Chat Listeners
    document.getElementById('sendChatBtn').onclick = sendChatMessage;
    document.getElementById('chatInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
    document.getElementById('chatToggleBtn').onclick = toggleChat;

    setLanguage('es');
}

function generateShortId() {
    // Generates a random 6-character alphanumeric ID (uppercase)
    return Math.random().toString(36).substr(2, 6).toUpperCase();
}

function initializePeer(isSender) {
    if (peer) peer.destroy();
    
    // Use a random short ID for everyone to avoid collisions, but we can try to use a custom one if needed.
    // PeerJS Cloud doesn't support forcing custom IDs reliably if taken, so random is safer.
    // But for "User Experience", we want the Sender to have a fixed ID they can share.
    
    const id = generateShortId();
    myId = id;
    
    peer = new Peer(id, {
        debug: 2,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' }
            ]
        }
    });

    peer.on('open', (id) => {
        console.log('My peer ID is: ' + id);
        if (isSender) {
            document.getElementById('generatingCodeSpinner').style.display = 'none';
            document.getElementById('offerCode').classList.remove('hidden');
            document.getElementById('copyOfferBtn').classList.remove('hidden');
            document.getElementById('qrSenderContainer').classList.remove('hidden');
            
            document.getElementById('offerCode').value = id;
            generateQR('qrSenderContainer', id);
        }
    });

    peer.on('connection', (connection) => {
        // Handle incoming connection (Sender receives connection from Receiver)
        if (conn && conn.open) {
            connection.close(); // Only one connection allowed
            return;
        }
        
        conn = connection;
        
        // Ensure connection is fully open before setting up
        if (conn.open) {
            setupConnection(conn, true);
        } else {
            conn.on('open', () => {
                setupConnection(conn, true);
            });
        }
    });

    peer.on('error', (err) => {
        console.error(err);
        alert("Error de conexión (PeerJS): " + err.type);
    });
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    document.getElementById('themeToggle').textContent = next === 'dark' ? '☀️' : '🌙';
}

function setLanguage(lang) {
    currentLang = lang;
    const t = translations[lang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if(t[key]) el.textContent = t[key];
    });
    
    // Update placeholders
    document.getElementById('offerCode').placeholder = t.offerCodePlaceholder;
    document.getElementById('offerCodeInput').placeholder = t.offerCodeInputPlaceholder;
    
    if(isScanning) {
        document.getElementById('scanQrBtn').textContent = t.stopScan;
    }
}

function showMain() {
    document.getElementById('mainScreen').classList.remove('hidden');
    document.getElementById('senderPanel').classList.add('hidden');
    document.getElementById('receiverPanel').classList.add('hidden');
    resetState();
}

function resetState() {
    if(peer) { peer.destroy(); peer = null; }
    if(conn) { conn.close(); conn = null; }
    fileToSend = null;
    receivedBuffers = [];
    receivedSize = 0;
    isScanning = false;
    
    // Reset UI
    document.getElementById('senderStep1').classList.remove('hidden');
    document.getElementById('senderStep2').classList.add('hidden');
    document.getElementById('senderStep3').classList.add('hidden');
    
    document.getElementById('receiverStep1').classList.remove('hidden');
    document.getElementById('receiverStep2').classList.add('hidden');
    
    document.getElementById('fileInput').value = '';
    document.getElementById('offerCode').value = '';
    document.getElementById('offerCodeInput').value = '';
    
    document.getElementById('sendProgress').value = 0;
    document.getElementById('receiveProgress').value = 0;
    document.getElementById('qrSenderContainer').innerHTML = '';
    document.getElementById('downloadLink').classList.add('hidden');
    document.getElementById('fileInfo').textContent = '';
    document.getElementById('sendStatus').textContent = '';
    document.getElementById('receiveStatus').textContent = '';

    stopQRScanner();
    
    // Reset Chat
    document.getElementById('chatContainer').classList.add('hidden', 'collapsed');
    document.getElementById('chatToggleBtn').classList.add('hidden');
    document.getElementById('chatHistory').innerHTML = '';
    lastMessageRole = null;
    lastMessageWrapper = null;
}

function copyToClipboard(elementId) {
    const el = document.getElementById(elementId);
    el.select();
    document.execCommand('copy');
    // Visual feedback handled by CSS or could add here
}

// --- Sender Logic ---

function startSenderFlow() {
    currentRole = 'sender';
    document.getElementById('mainScreen').classList.add('hidden');
    document.getElementById('senderPanel').classList.remove('hidden');
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    processFile(file);
}

function processFile(file) {
    fileToSend = file;
    const t = translations[currentLang];
    document.getElementById('fileInfo').textContent = `${t.fileSelected} ${file.name} (${formatSize(file.size)})`;
    
    // Start Peer immediately to generate ID
    document.getElementById('senderStep1').classList.add('hidden');
    document.getElementById('senderStep2').classList.remove('hidden');
    document.getElementById('generatingCodeSpinner').style.display = 'block';
    
    initializePeer(true);
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('uploadZone').classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('uploadZone').classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    document.getElementById('uploadZone').classList.remove('dragover');
    
    const dt = e.dataTransfer;
    const file = dt.files[0];
    
    if (file) {
        processFile(file);
    }
}

// --- Receiver Logic ---

function startReceiverFlow() {
    currentRole = 'receiver';
    document.getElementById('mainScreen').classList.add('hidden');
    document.getElementById('receiverPanel').classList.remove('hidden');
    initializePeer(false); // Init peer so we can connect
}

function connectToPeer() {
    const targetId = document.getElementById('offerCodeInput').value.trim().toUpperCase();
    if(!targetId) return;

    if (!peer || peer.destroyed) initializePeer(false);

    // Use default serialization (BinaryPack) which handles both JSON and ArrayBuffer correctly
    conn = peer.connect(targetId);
    
    let isConnected = false;

    conn.on('open', () => {
        if (isConnected) return;
        isConnected = true;
        setupConnection(conn, false);
    });
    
    conn.on('error', (err) => {
        alert("Error connecting to peer: " + err);
    });
    
    // Force open check after a timeout
    setTimeout(() => {
        if(conn && conn.open && !isConnected) {
            isConnected = true;
            setupConnection(conn, false);
        }
    }, 1000);
}

// --- Connection & Transfer ---

function setupConnection(connection, isSender) {
    conn = connection;
    
    conn.on('data', handleMessage);
    
    conn.on('close', () => {
        alert("Connection closed");
        showMain();
    });

    // Show Chat
    document.getElementById('chatContainer').classList.remove('hidden', 'collapsed');
    document.getElementById('chatToggleBtn').classList.remove('hidden');
    document.getElementById('chatToggleIcon').textContent = '▼'; // Ensure icon matches expanded state

    const t = translations[currentLang];
    
    if(isSender) {
        document.getElementById('senderStep2').classList.add('hidden');
        document.getElementById('senderStep3').classList.remove('hidden');
        document.getElementById('sendStatus').textContent = t.waitingPeer;
        
        // Retry Handshake loop
        let attempts = 0;
        const handshakeInterval = setInterval(() => {
            if(!conn || !conn.open) {
                clearInterval(handshakeInterval);
                return;
            }
            if(attempts >= 5) {
                // If handshake fails after 5 seconds, try forcing transfer anyway
                clearInterval(handshakeInterval);
                document.getElementById('sendStatus').textContent = "Tiempo de espera agotado. Forzando envío...";
                sendFile();
                return;
            }
            
            console.log("Sending PING (attempt " + (attempts+1) + ")");
            conn.send({ type: 'ping' });
            attempts++;
        }, 1000);
        
        // Also send one immediately
        conn.send({ type: 'ping' });
        
        // Store interval ID to clear it later if PONG received
        conn.handshakeInterval = handshakeInterval;
        
    } else {
        // Fix: Update status to remove spinner and show connected state
        const statusContainer = document.querySelector('#receiverStep2 .status-msg');
        if(statusContainer) {
            statusContainer.innerHTML = '✅ ' + t.connEstablished;
        }
        // document.getElementById('receiverStep1').classList.add('hidden'); // Already hidden?
        document.getElementById('receiverStep2').classList.remove('hidden');
        // We stay in Step 2 until metadata is received
    }
}

function formatTime(seconds) {
    if(!isFinite(seconds) || seconds < 0) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

async function sendFile() {
    if(!fileToSend || !conn) return;
    
    const t = translations[currentLang];
    document.getElementById('sendStatus').textContent = t.sending;

    // 1. Send Metadata
    const meta = {
        type: 'metadata',
        name: fileToSend.name,
        size: fileToSend.size,
        mime: fileToSend.type || 'application/octet-stream'
    };
    conn.send(meta);

    // 2. Send Chunks
    const totalChunks = Math.ceil(fileToSend.size / CHUNK_SIZE);
    let offset = 0;
    
    // Performance metrics
    let lastUiUpdate = 0;
    const updateInterval = 100; // Update UI max every 100ms
    const startTime = Date.now();
    
    // Buffer limits
    const MAX_BUFFERED_AMOUNT = 16 * 1024 * 1024; // 16MB
    const RESUME_THRESHOLD = 8 * 1024 * 1024;     // 8MB

    for(let i = 0; i < totalChunks; i++) {
        if(!conn.open) break;
        
        // Flow control: wait if buffer is too full
        if (conn.dataChannel && conn.dataChannel.bufferedAmount > MAX_BUFFERED_AMOUNT) {
            await new Promise(resolve => {
                const check = setInterval(() => {
                    if (!conn.dataChannel || conn.dataChannel.bufferedAmount < RESUME_THRESHOLD) {
                        clearInterval(check);
                        resolve();
                    }
                }, 50);
            });
        }

        const slice = fileToSend.slice(offset, offset + CHUNK_SIZE);
        const buffer = await slice.arrayBuffer();
        
        conn.send(buffer);
        offset += CHUNK_SIZE;
        
        // Update UI intelligently (not every chunk)
        const now = Date.now();
        if (now - lastUiUpdate > updateInterval || i === totalChunks - 1) {
            // Account for buffered amount to show "real" network progress
            const buffered = conn.dataChannel.bufferedAmount || 0;
            const sentBytes = Math.max(0, offset - buffered);
            const percent = (sentBytes / fileToSend.size) * 100;
            
            // Cap at 99% until confirmed
            document.getElementById('sendProgress').value = Math.min(percent, 99);
            
            // Calculate stats
            const elapsed = (now - startTime) / 1000; // seconds
            if (elapsed > 0) {
                const speed = sentBytes / elapsed; // bytes/sec
                const remaining = (fileToSend.size - sentBytes) / speed;
                
                document.getElementById('senderStats').textContent = 
                    `${Math.round(percent)}% | ${formatSize(speed)}/s | ETA: ${formatTime(remaining)}`;
            }

            lastUiUpdate = now;
            
            // Yield to main thread to keep UI responsive
            await new Promise(r => setTimeout(r, 0));
        }
    }

    // Wait for buffer to drain completely
    while (conn.dataChannel.bufferedAmount > 0) {
        if(!conn.open) break;
        const buffered = conn.dataChannel.bufferedAmount;
        const sentBytes = Math.max(0, fileToSend.size - buffered);
        const percent = (sentBytes / fileToSend.size) * 100;
        
        document.getElementById('sendProgress').value = Math.min(percent, 99);
        document.getElementById('senderStats').textContent = `${Math.round(percent)}% | Enviando últimos datos...`;
        
        await new Promise(r => setTimeout(r, 100));
    }
    
    // Do NOT show 100% yet. Wait for 'transfer-complete' message from receiver.
    document.getElementById('sendStatus').textContent = translations[currentLang].verifying;
}

let lastReceiverUpdate = 0;
let receiveStartTime = 0;

function handleMessage(data) {
    console.log("Received data:", data);
    
    // Handshake handling
    if (data && data.type === 'ping') {
        console.log("Received PING, sending PONG");
        conn.send({ type: 'pong' });
        return;
    }
    if (data && data.type === 'pong') {
        console.log("Received PONG, starting transfer");
        if(conn.handshakeInterval) clearInterval(conn.handshakeInterval);
        sendFile();
        return;
    }

    if (data && data.type === 'metadata') {
        // Clear any handshake intervals on receiver side if they existed
        fileMeta = data;
        receivedBuffers = [];
        receivedSize = 0;
        expectedSize = data.size;
        lastReceiverUpdate = 0;
        receiveStartTime = Date.now();
        document.getElementById('receiveStatus').textContent = `Recibiendo: ${data.name}`;
        
        // Force UI transition to receiving state
        document.getElementById('receiverStep2').classList.add('hidden');
        document.getElementById('receiverStep3').classList.remove('hidden');
    } else if (data && data.type === 'chat') {
        addMessageToChat(data.message, 'received', data.role);
        if (document.getElementById('chatContainer').classList.contains('collapsed')) {
             const btn = document.getElementById('chatToggleBtn');
             btn.style.animation = 'none';
             btn.offsetHeight; /* trigger reflow */
             btn.style.animation = 'pulse 1s';
        }
    } else if (data && data.type === 'transfer-complete') {
        const t = translations[currentLang];
        document.getElementById('sendProgress').value = 100;
        document.getElementById('senderStats').textContent = "100%";
        document.getElementById('sendStatus').textContent = t.fileReceivedSender;
    } else if (data && data.type === 'file-downloaded') {
        const t = translations[currentLang];
        const warningMsg = document.getElementById('warningMsg');
        if(warningMsg) {
            warningMsg.textContent = t.safeToClose;
            warningMsg.classList.add('success');
        }
        document.getElementById('sendStatus').textContent = t.fileDownloadedSender;
    } else {
        // Binary chunk handling
        let chunk = data;
        
        // PeerJS BinaryPack usually returns ArrayBuffer or Uint8Array directly
        // but let's be safe against wrapped objects just in case
        if (data && data._data && (data.constructor === Object || data._data instanceof Uint8Array)) {
             chunk = data._data;
        }

        // Validate chunk is binary-like
        if (chunk instanceof ArrayBuffer || ArrayBuffer.isView(chunk) || chunk instanceof Blob) {
            receivedBuffers.push(chunk);
            receivedSize += chunk.byteLength || chunk.size || 0;
        } else {
            // If we receive an empty object or something else, it might be a serialization artifact
            // Log it but don't break
            if (Object.keys(chunk).length === 0) {
                 // Ignore empty objects (keepalive or serialization error)
                 return;
            }
            console.warn("Received non-binary chunk:", data);
        }
        
        // Throttle UI updates
        const now = Date.now();
        if (now - lastReceiverUpdate > 100 || receivedSize >= expectedSize) {
            const percent = (receivedSize / expectedSize) * 100;
            document.getElementById('receiveProgress').value = Math.min(percent, 100);
            
            // Calculate stats
            const elapsed = (now - receiveStartTime) / 1000;
            if (elapsed > 0) {
                const speed = receivedSize / elapsed;
                const remaining = expectedSize - receivedSize;
                const eta = remaining / speed;
                
                document.getElementById('receiverStats').textContent = 
                    `${Math.round(percent)}% | ${formatSize(speed)}/s | ETA: ${formatTime(eta)}`;
            }

            lastReceiverUpdate = now;
        }

        if (receivedSize >= expectedSize) {
            document.getElementById('receiverStats').textContent = "100%";
            finishReceive();
        }
    }
}

function finishReceive() {
    const t = translations[currentLang];
    document.getElementById('receiveStatus').textContent = t.transferComplete;
    
    // Notify sender
    if(conn && conn.open) {
        conn.send({ type: 'transfer-complete' });
    }

    const blob = new Blob(receivedBuffers, { type: fileMeta.mime });
    const url = URL.createObjectURL(blob);
    
    const link = document.getElementById('downloadLink');
    link.href = url;
    link.download = fileMeta.name;
    link.textContent = `${t.download} (${formatSize(expectedSize)})`;
    link.classList.remove('hidden');
    
    // Notify sender on download
    link.onclick = () => {
        if(conn && conn.open) {
            conn.send({ type: 'file-downloaded' });
        }
    };
    
    receivedBuffers = []; // Clear memory
}

// --- QR Helpers ---

function generateQR(containerId, text) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    new QRCode(container, {
        text: text,
        width: 180,
        height: 180,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.M
    });
}

let videoStream;
let scanInterval;

async function toggleQRScanner() {
    if(isScanning) {
        stopQRScanner();
        return;
    }

    try {
        const video = document.getElementById('qrScanner');
        videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = videoStream;
        video.setAttribute("playsinline", true);
        video.play();
        video.classList.remove('hidden');
        
        isScanning = true;
        document.getElementById('scanQrBtn').textContent = translations[currentLang].stopScan;
        
        requestAnimationFrame(tickScanner);
    } catch (e) {
        alert("Camera access denied or error: " + e.message);
    }
}

function stopQRScanner() {
    if(videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    document.getElementById('qrScanner').classList.add('hidden');
    isScanning = false;
    document.getElementById('scanQrBtn').textContent = translations[currentLang].scanQr;
}

function tickScanner() {
    if(!isScanning) return;
    
    const video = document.getElementById('qrScanner');
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
        });

        if (code) {
            // Found QR
            const id = code.data.trim().toUpperCase();
            if(id.length >= 4) { // Basic validation
                document.getElementById('offerCodeInput').value = id;
                document.getElementById('connectBtn').disabled = false;
                stopQRScanner();
                // Optional: Auto connect
                connectToPeer();
            }
        }
    }
    requestAnimationFrame(tickScanner);
}

function formatSize(bytes) {
    if(bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// --- Chat Logic ---

let lastMessageRole = null;
let lastMessageWrapper = null;

function toggleChat() {
    const chat = document.getElementById('chatContainer');
    // Ensure hidden class is removed if present so we can actually see the transition
    if (chat.classList.contains('hidden')) {
        chat.classList.remove('hidden');
        chat.classList.remove('collapsed');
    } else {
        chat.classList.toggle('collapsed');
    }
    
    // Update internal icon if visible
    const icon = document.getElementById('chatToggleIcon');
    if(icon) {
        icon.textContent = chat.classList.contains('collapsed') ? '▲' : '▼';
    }
    
    // Update header button state for visual feedback
    const btn = document.getElementById('chatToggleBtn');
    if(btn) {
        if(chat.classList.contains('collapsed')) {
            btn.style.opacity = '0.5';
        } else {
            btn.style.opacity = '1';
        }
    }
}

function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message || !conn || !conn.open) return;

    // Send to peer
    conn.send({ type: 'chat', message: message, role: currentRole });

    // Display locally
    addMessageToChat(message, 'sent', currentRole);
    input.value = '';
}

function addMessageToChat(message, type, role) {
    const history = document.getElementById('chatHistory');
    
    // Check for grouping
    // We group if: same role AND same type (sent/received) AND last wrapper exists
    const isConsecutive = (lastMessageRole === role) && lastMessageWrapper && lastMessageWrapper.classList.contains(type);

    if (isConsecutive) {
        // Append to existing group
        const msgDiv = createMessageElement(message, type);
        lastMessageWrapper.appendChild(msgDiv);
    } else {
        // Create new group
        const wrapper = document.createElement('div');
        wrapper.className = `chat-message-wrapper ${type}`;

        // Label logic: for both messages to ensure clarity
        const label = document.createElement('div');
        label.className = 'chat-message-label';
        
        let roleLabel = 'Desconocido';
        if (role === 'sender') roleLabel = 'Emisor';
        else if (role === 'receiver') roleLabel = 'Receptor';
        
        // If it's sent by me (locally 'sent'), I am the 'currentRole'.
        // If I am sender, label is Emisor. If I am receiver, label is Receptor.
        // Wait, if I am sender, I want to see "Tú (Emisor)" or just "Emisor"?
        // The user said "cada mensaje incluya indicadores visuales claros de quién lo envió".
        // Let's stick to "Emisor" and "Receptor" as requested originally.
        
        label.textContent = roleLabel;
        wrapper.appendChild(label);
        
        const msgDiv = createMessageElement(message, type);
        wrapper.appendChild(msgDiv);
        
        history.appendChild(wrapper);
        
        // Update state
        lastMessageWrapper = wrapper;
        lastMessageRole = role;
    }
    
    history.scrollTop = history.scrollHeight;
}

function createMessageElement(message, type) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${type}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = message;
    
    msgDiv.appendChild(contentDiv);
    
    return msgDiv;
}

// Initialize
init();