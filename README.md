# P2PTransfer
> **La forma más rápida, segura y privada de compartir archivos.**
> *Sin servidores. Sin límites. Sin registros.*

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![WebRTC](https://img.shields.io/badge/tech-WebRTC-orange) ![Status](https://img.shields.io/badge/status-Production%20Ready-green)

---

## ¿Qué es P2PTransfer?

**P2PTransfer** redefiniendo el intercambio de archivos. Olvida las limitaciones de correo electrónico, la compresión de WhatsApp o la lentitud de subir a la nube para luego bajar.

Nuestra tecnología conecta directamente tu dispositivo con el destinatario creando un túnel **WebRTC** encriptado. El archivo viaja de tu disco al suyo a la máxima velocidad que permita vuestra red WiFi o 5G.

**Tus datos nunca tocan nuestros servidores.** Privacidad absoluta por diseño.

---

## Características Principales

### **Velocidad Extrema**
Transferencia peer-to-peer (P2P) directa. Sin intermediarios que ralenticen el proceso. Aprovecha todo el ancho de banda de tu red local o internet.

### **Privacidad Total**
El servidor de señalización solo conecta a los usuarios. Una vez establecida la conexión, los datos fluyen directamente entre dispositivos. Nadie (ni nosotros) puede ver tus archivos.

### **Multi-Plataforma y Responsive**
Diseñado con una interfaz *Apple-style* moderna y minimalista. Funciona perfectamente en:
- PC / Mac / Linux
- iPhone / Android
- 平板 Tablets

### **Ingeniería de Precisión**
- **Smart Buffering**: Algoritmos de control de flujo para evitar saturación de memoria.
- **Estadísticas en Vivo**: Visualiza velocidad real (MB/s), tiempo restante (ETA) y progreso exacto.
- **Verificación de Entrega**: Confirmación criptográfica de que el archivo ha llegado y se ha descargado.

### **Experiencia de Usuario (UX) Premium**
- **Drag & Drop**: Arrastra archivos intuitivamente.
- **Conexión QR**: Escanea y conecta en segundos sin teclear códigos.
- **Modo Oscuro**: Integrado y persistente.
- **Internacionalización**: Soporte nativo ES/EN.

---

## Cómo Empezar

No necesitas instalar nada. Es una **Web App Progresiva** que vive en tu navegador.

1. **Abrir**: Inicia la aplicación en dos dispositivos.
2. **Conectar**: El emisor comparte un código de 6 dígitos (o muestra un QR).
3. **Transferir**: Selecciona el archivo y observa cómo vuela.

### Para Desarrolladores (Instalación Local)

```bash
# Clonar el repositorio
git clone https://github.com/tu-usuario/p2p-transfer.git

# Entrar al directorio
cd p2p-transfer

# Ejecutar con cualquier servidor estático (ej. Live Server, Python, Node)
# Ejemplo con Python:
python -m http.server 8000
```

> **Nota**: Para probar entre dispositivos distintos (PC <-> Móvil), necesitas servir la app bajo **HTTPS** (o usar localhost si es el mismo dispositivo) debido a las restricciones de seguridad de WebRTC y la Cámara.

---

## Tecnologías

Este proyecto está construido sobre el estándar del futuro de la web:

*   **HTML5 / CSS3**: Variables CSS, Flexbox/Grid, Glassmorphism UI.
*   **Vanilla JavaScript (ES6+)**: Sin frameworks pesados. Rendimiento puro.
*   **WebRTC (PeerJS)**: Protocolo de comunicación en tiempo real.
*   **QR Code Integration**: Generación y escaneo nativo en el navegador.

---

## Roadmap

- [x] Transferencia de archivos grandes (>1GB)
- [x] Soporte Móvil y QR
- [x] Estadísticas en tiempo real
- [ ] Transferencia de múltiples archivos (Batch)
- [x] Chat de texto encriptado durante la transferencia
- [ ] Versión Desktop (Electron)

---

<div align="center">
  <sub>Construido con ❤️ para la web descentralizada.</sub>
</div>

