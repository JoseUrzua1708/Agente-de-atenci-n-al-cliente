// Monitor de chats: scroll al último mensaje, revisión y refresco automático
const mensajes = document.getElementById("mensajes");
if (mensajes) mensajes.scrollTop = mensajes.scrollHeight;

const dlgRevision = document.getElementById("dlgRevision");

document.querySelectorAll(".btn-revisar").forEach((boton) => {
    boton.addEventListener("click", () => {
        document.getElementById("frmRevision").action = boton.dataset.accion;
        // Se propone marcada; desmarcar quita la revisión
        document.getElementById("revIncorrecto").checked = true;
        document.getElementById("revNota").value = boton.dataset.nota;
        dlgRevision.showModal();
    });
});

document.querySelector("[data-cerrar]").addEventListener("click", () => dlgRevision.close());

document.querySelectorAll("form[data-confirmar]").forEach((form) => {
    form.addEventListener("submit", (evento) => {
        if (!confirm(form.dataset.confirmar)) evento.preventDefault();
    });
});

// Recarga cada 15 s, salvo que estés escribiendo o con un diálogo abierto
const respuesta = document.getElementById("respuesta");
setInterval(() => {
    const escribiendo = respuesta && respuesta.value.trim() !== "";
    if (!escribiendo && !dlgRevision.open) window.location.reload();
}, 15000);
