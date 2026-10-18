// Detalle de la reserva: copia su plantilla al diálogo
const dlgDetalle = document.getElementById("dlgDetalle");
const contenido = document.getElementById("detalleContenido");

document.querySelectorAll(".btn-detalle").forEach((boton) => {
    boton.addEventListener("click", () => {
        const plantilla = document.getElementById(boton.dataset.plantilla);
        contenido.replaceChildren(plantilla.content.cloneNode(true));
        dlgDetalle.showModal();
    });
});

document.querySelector("[data-cerrar]").addEventListener("click", () => dlgDetalle.close());

// Confirmación antes de mover la reserva
document.querySelectorAll(".form-movimiento").forEach((form) => {
    form.addEventListener("submit", (evento) => {
        if (!confirm(`¿Confirmar ${form.dataset.confirmar}?`)) evento.preventDefault();
    });
});
