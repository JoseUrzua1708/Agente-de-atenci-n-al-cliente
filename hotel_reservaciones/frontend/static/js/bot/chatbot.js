// frontend/static/js/chatbot.js
let conversacionId = null;

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('user-input');
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') enviarMensaje();
    });
});

async function enviarMensaje() {
    const input = document.getElementById('user-input');
    const texto = input.value.trim();
    if (!texto) return;

    agregarMensaje(texto, 'user');
    input.value = '';

    const typingId = mostrarTyping();

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                mensaje: texto,
                conversacion_id: conversacionId 
            })
        });

        const data = await response.json();
        eliminarTyping(typingId);

        if (data.error) {
            agregarMensaje("Error: " + data.error, 'bot');
            return;
        }

        conversacionId = data.conversacion_id;
        agregarMensaje(data.respuesta, 'bot');

        if (data.requiere_confirmacion) {
            mostrarBotonesConfirmacion(data.datos_confirmacion);
        }

    } catch (error) {
        eliminarTyping(typingId);
        agregarMensaje("Error de conexión con el servidor.", 'bot');
    }
}

function agregarMensaje(texto, emisor) {
    const chatBox = document.getElementById('chat-box');
    const div = document.createElement('div');
    div.className = `message ${emisor}`;
    div.textContent = texto;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function mostrarTyping() {
    const chatBox = document.getElementById('chat-box');
    const div = document.createElement('div');
    div.className = 'message bot typing';
    div.id = 'typing-indicator';
    div.textContent = 'Escribiendo...';
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
    return 'typing-indicator';
}

function eliminarTyping(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function mostrarBotonesConfirmacion(datos) {
    const chatBox = document.getElementById('chat-box');
    const div = document.createElement('div');
    div.className = 'message bot';
    div.innerHTML = `
        <div style="display:flex; gap:10px; margin-top:10px;">
            <button onclick="confirmarReserva(true)" style="background:#28a745;color:white;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;">Confirmar</button>
            <button onclick="confirmarReserva(false)" style="background:#dc3545;color:white;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;">Cancelar</button>
        </div>
    `;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

async function confirmarReserva(confirmado) {
    const texto = confirmado ? "Sí, confirmo la reservación" : "No, cancelar";
    agregarMensaje(texto, 'user');
    // Aquí puedes llamar a otro endpoint para procesar la reserva final
}