// --- Configuración y Estado ---
const iceConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};
const CHUNK_SIZE = 16384; // 16KB
let pc, dataChannel;
let fileToSend;
let receivedBuffers = [];
let receivedSize = 0;
let expectedSize = 0;
let fileMeta = {};
let isScanning = false;

// --- Traducciones ---
const translations = {
    es: {
        title: "Transferencia P2P Segura",
        subtitle: "Transfiere archivos directamente entre dispositivos sin servidores.",
        send: "Enviar Archivo",
        receive: "Recibir Archivo",
        back: "Volver",
        senderMode: "Modo: Enviar",
        receiverMode: "Modo: Recibir",
        step1Desc: "1. Comparte este código o muestra el QR al receptor",
        step2Desc: "2. Pega el código de respuesta del receptor",
        copy: "Copiar Código",
        connect: "Conectar",
        scanQr: "Escanear QR",
        processOffer: "Generar Respuesta",
        stepRec1Desc: "1. Escanea el QR del emisor o pega el código",
        stepRec2Desc: "2. Comparte este código de respuesta con el emisor",
        waitingForConnection: "Esperando conexión...",
        sending: "Enviando archivo...",
        receiving: "Recibiendo archivo...",
        download: "Descargar Archivo",
        offerCodePlaceholder: "Generando código...",
        generating: "Generando código de conexión (esto puede tardar unos segundos)...",
        answerCodeInputPlaceholder: "Pega código de respuesta aquí",
        offerCodeInputPlaceholder: "Pega código aquí o escanea QR",
        fileSelected: "Archivo seleccionado: ",
        connEstablished: "Conexión establecida. Iniciando transferencia...",
        connFailed: "Conexión fallida. Intenta de nuevo.",
        transferComplete: "Transferencia completada!",
        stopScan: "Detener Cámara"
    },
    en: {
        title: "Secure P2P Transfer",
        subtitle: "Transfer files directly between devices without servers.",
        send: "Send File",
        receive: "Receive File",
        back: "Back",
        senderMode: "Sender Mode",
        receiverMode: "Receiver Mode",
        step1Desc: "1. Share this code or show QR to receiver",
        step2Desc: "2. Paste the receiver's answer code",
        copy: "Copy Code",
        connect: "Connect",
        scanQr: "Scan QR",
        processOffer: "Generate Answer",
        stepRec1Desc: "1. Scan sender's QR or paste code",
        stepRec2Desc: "2. Share this answer code with sender",
        waitingForConnection: "Waiting for connection...",
        sending: "Sending file...",
        receiving: "Receiving file...",
        download: "Download File",
        offerCodePlaceholder: "Generating code...",
        generating: "Generating connection code (this may take a few seconds)...",
        answerCodeInputPlaceholder: "Paste answer code here",
        offerCodeInputPlaceholder: "Paste code here or scan QR",
        fileSelected: "File selected: ",
        connEstablished: "Connection established. Starting transfer...",
        connFailed: "Connection failed. Try again.",
        transferComplete: "Transfer complete!",
        stopScan: "Stop Camera"
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
    document.getElementById('copyOfferBtn').onclick = () => copyToClipboard('offerCode');
    document.getElementById('answerCodeInput').oninput = (e) => {
        document.getElementById('connectBtn').disabled = !e.target.value.trim();
    };
    document.getElementById('connectBtn').onclick = handleSenderConnect;

    // Receiver
    document.getElementById('scanQrBtn').onclick = toggleQRScanner;
    document.getElementById('offerCodeInput').oninput = (e) => {
        document.getElementById('processOfferBtn').disabled = !e.target.value.trim();
    };
    document.getElementById('processOfferBtn').onclick = handleReceiverOffer;
    document.getElementById('copyAnswerBtn').onclick = () => copyToClipboard('answerCode');

    setLanguage('es');
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
    document.getElementById('answerCodeInput').placeholder = t.answerCodeInputPlaceholder;
    document.getElementById('offerCodeInput').placeholder = t.offerCodeInputPlaceholder;
    
    // Update dynamic texts if needed
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
    if(pc) { pc.close(); pc = null; }
    if(dataChannel) { dataChannel.close(); dataChannel = null; }
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
    document.getElementById('receiverStep3').classList.add('hidden');
    
    document.getElementById('fileInput').value = '';
    document.getElementById('offerCode').value = '';
    document.getElementById('answerCodeInput').value = '';
    document.getElementById('offerCodeInput').value = '';
    document.getElementById('answerCode').value = '';
    
    document.getElementById('sendProgress').value = 0;
    document.getElementById('receiveProgress').value = 0;
    document.getElementById('qrSenderContainer').innerHTML = '';
    document.getElementById('qrAnswerContainer').innerHTML = '';
    document.getElementById('downloadLink').classList.add('hidden');
    document.getElementById('fileInfo').textContent = '';
    document.getElementById('sendStatus').textContent = '';
    document.getElementById('receiveStatus').textContent = '';

    stopQRScanner();
}

function copyToClipboard(elementId) {
    const el = document.getElementById(elementId);
    el.select();
    document.execCommand('copy');
    const originalText = el.nextElementSibling.textContent;
    el.nextElementSibling.textContent = "Copied!";
    setTimeout(() => el.nextElementSibling.textContent = originalText, 2000);
}

// --- Sender Logic ---

function startSenderFlow() {
    document.getElementById('mainScreen').classList.add('hidden');
    document.getElementById('senderPanel').classList.remove('hidden');
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    fileToSend = file;
    const t = translations[currentLang];
    document.getElementById('fileInfo').textContent = `${t.fileSelected} ${file.name} (${formatSize(file.size)})`;
    
    createOffer();
}

async function createOffer() {
    // Show loading state immediately
    document.getElementById('senderStep1').classList.add('hidden');
    document.getElementById('senderStep2').classList.remove('hidden');
    document.getElementById('offerCode').classList.add('hidden');
    document.getElementById('copyOfferBtn').classList.add('hidden');
    document.getElementById('qrSenderContainer').classList.add('hidden');
    document.getElementById('generatingCodeSpinner').style.display = 'block';

    try {
        pc = new RTCPeerConnection(iceConfig);
        dataChannel = pc.createDataChannel('fileTransfer');
        setupDataChannel(dataChannel, true);

        pc.onicecandidate = (e) => {
            if (e.candidate === null) {
                // ICE gathering finished
                const offerJson = JSON.stringify(pc.localDescription);
                const encodedOffer = btoa(offerJson);
                
                // Show result
                document.getElementById('generatingCodeSpinner').style.display = 'none';
                document.getElementById('offerCode').classList.remove('hidden');
                document.getElementById('copyOfferBtn').classList.remove('hidden');
                document.getElementById('qrSenderContainer').classList.remove('hidden');
                
                document.getElementById('offerCode').value = encodedOffer;
                generateQR('qrSenderContainer', encodedOffer);
            }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
    } catch (e) {
        alert("Error creando conexión: " + e.message);
        showMain();
    }
}

async function handleSenderConnect() {
    const answerCode = document.getElementById('answerCodeInput').value.trim();
    if(!answerCode) return;

    try {
        const answerDesc = JSON.parse(atob(answerCode));
        await pc.setRemoteDescription(answerDesc);
        document.getElementById('connectBtn').textContent = "Connecting...";
    } catch (e) {
        alert("Error parsing answer code: " + e.message);
    }
}

// --- Receiver Logic ---

function startReceiverFlow() {
    document.getElementById('mainScreen').classList.add('hidden');
    document.getElementById('receiverPanel').classList.remove('hidden');
}

async function handleReceiverOffer() {
    const offerCode = document.getElementById('offerCodeInput').value.trim();
    if(!offerCode) return;

    try {
        const offerDesc = JSON.parse(atob(offerCode));
        pc = new RTCPeerConnection(iceConfig);

        pc.ondatachannel = (e) => {
            dataChannel = e.channel;
            setupDataChannel(dataChannel, false);
        };

        pc.onicecandidate = (e) => {
            if(e.candidate === null) {
                const answerJson = JSON.stringify(pc.localDescription);
                const encodedAnswer = btoa(answerJson);
                document.getElementById('answerCode').value = encodedAnswer;
                generateQR('qrAnswerContainer', encodedAnswer);
                
                document.getElementById('receiverStep1').classList.add('hidden');
                document.getElementById('receiverStep2').classList.remove('hidden');
            }
        };

        await pc.setRemoteDescription(offerDesc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

    } catch (e) {
        alert("Error processing offer: " + e.message);
    }
}

// --- Data Channel & Transfer ---

function setupDataChannel(channel, isSender) {
    channel.onopen = () => {
        const t = translations[currentLang];
        if(isSender) {
            document.getElementById('senderStep2').classList.add('hidden');
            document.getElementById('senderStep3').classList.remove('hidden');
            document.getElementById('sendStatus').textContent = t.connEstablished;
            sendFile();
        } else {
            document.getElementById('receiverStep2').classList.add('hidden');
            document.getElementById('receiverStep3').classList.remove('hidden');
            document.getElementById('receiveStatus').textContent = t.connEstablished;
        }
    };

    channel.onmessage = handleMessage;
}

async function sendFile() {
    if(!fileToSend || !dataChannel) return;
    
    // 1. Send Metadata
    const meta = {
        type: 'metadata',
        name: fileToSend.name,
        size: fileToSend.size,
        mime: fileToSend.type
    };
    dataChannel.send(JSON.stringify(meta));

    // 2. Send Chunks
    const totalChunks = Math.ceil(fileToSend.size / CHUNK_SIZE);
    let offset = 0;
    
    for(let i = 0; i < totalChunks; i++) {
        if(dataChannel.readyState !== 'open') break;
        
        const slice = fileToSend.slice(offset, offset + CHUNK_SIZE);
        const buffer = await slice.arrayBuffer();
        
        // Flow control: wait if buffer is full
        if (dataChannel.bufferedAmount > 16 * 1024 * 1024) { // 16MB limit
            await new Promise(r => {
                const check = setInterval(() => {
                    if (dataChannel.bufferedAmount < 4 * 1024 * 1024) {
                        clearInterval(check);
                        r();
                    }
                }, 50);
            });
        }

        dataChannel.send(buffer);
        offset += CHUNK_SIZE;
        
        // Update UI
        const percent = (offset / fileToSend.size) * 100;
        document.getElementById('sendProgress').value = Math.min(percent, 100);
        
        // Allow UI to update
        if(i % 100 === 0) await new Promise(r => setTimeout(r, 0));
    }
    
    document.getElementById('sendStatus').textContent = translations[currentLang].transferComplete;
}

function handleMessage(event) {
    const data = event.data;
    
    if (typeof data === 'string') {
        const msg = JSON.parse(data);
        if(msg.type === 'metadata') {
            fileMeta = msg;
            receivedBuffers = [];
            receivedSize = 0;
            expectedSize = msg.size;
            document.getElementById('receiveStatus').textContent = `Recibiendo: ${msg.name}`;
        }
    } else {
        // Binary chunk
        receivedBuffers.push(data);
        receivedSize += data.byteLength;
        
        const percent = (receivedSize / expectedSize) * 100;
        document.getElementById('receiveProgress').value = percent;

        if (receivedSize >= expectedSize) {
            finishReceive();
        }
    }
}

function finishReceive() {
    const t = translations[currentLang];
    document.getElementById('receiveStatus').textContent = t.transferComplete;
    
    const blob = new Blob(receivedBuffers, { type: fileMeta.mime });
    const url = URL.createObjectURL(blob);
    
    const link = document.getElementById('downloadLink');
    link.href = url;
    link.download = fileMeta.name;
    link.textContent = `${t.download} (${formatSize(expectedSize)})`;
    link.classList.remove('hidden');
    
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
        correctLevel : QRCode.CorrectLevel.L
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
            document.getElementById('offerCodeInput').value = code.data;
            document.getElementById('processOfferBtn').disabled = false;
            stopQRScanner();
            // Optional: Auto process? Better to let user click process.
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

// Initialize
init();
