// Diálogos de habitación y de respuestas rápidas
const dlgCuarto = document.getElementById("dlgCuarto");
const dlgFaq = document.getElementById("dlgFaq");
const frmFaq = document.getElementById("frmFaq");

document.querySelectorAll("[data-cerrar]").forEach((boton) => {
    boton.addEventListener("click", () => boton.closest("dialog").close());
});

// Habitación: propone el estado actual
document.querySelectorAll(".cuarto:not(:disabled)").forEach((cuarto) => {
    cuarto.addEventListener("click", () => {
        document.getElementById("frmCuarto").action = cuarto.dataset.accion;
        document.getElementById("cuartoTitulo").textContent = `Habitación ${cuarto.dataset.numero}`;
        document.getElementById("cuartoEstado").value = cuarto.dataset.estado;
        dlgCuarto.showModal();
    });
});

// Respuesta rápida: el mismo diálogo sirve para crear y editar
function abrirFaq(titulo, accion, valores) {
    document.getElementById("faqTitulo").textContent = titulo;
    frmFaq.action = accion;
    document.getElementById("faqPregunta").value = valores.pregunta || "";
    document.getElementById("faqRespuesta").value = valores.respuesta || "";
    document.getElementById("faqCategoria").value = valores.categoria || "";
    document.getElementById("faqPalabras").value = valores.palabras || "";
    document.getElementById("faqActiva").checked = valores.activa !== "0";
    dlgFaq.showModal();
}

document.getElementById("btnNuevaFaq").addEventListener("click", () => {
    abrirFaq("Nueva respuesta", frmFaq.dataset.nueva, {});
});

document.querySelectorAll(".btn-editar-faq").forEach((boton) => {
    boton.addEventListener("click", () => abrirFaq("Editar respuesta", boton.dataset.accion, boton.dataset));
});
