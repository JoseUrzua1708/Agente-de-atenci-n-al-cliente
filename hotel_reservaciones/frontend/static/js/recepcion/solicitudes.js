// Diálogos de nueva solicitud y de atención
const dlgNueva = document.getElementById("dlgNueva");
const dlgAtender = document.getElementById("dlgAtender");

document.getElementById("btnNueva").addEventListener("click", () => dlgNueva.showModal());

document.querySelectorAll("[data-cerrar]").forEach((boton) => {
    boton.addEventListener("click", () => boton.closest("dialog").close());
});

// Llena el diálogo con los datos de la fila
document.querySelectorAll(".btn-atender").forEach((boton) => {
    boton.addEventListener("click", () => {
        const d = boton.dataset;
        document.getElementById("frmAtender").action = d.accion;
        document.getElementById("atenderTitulo").textContent = `#${d.id} · ${d.asunto}`;
        document.getElementById("atenderMensaje").textContent = d.mensaje;
        document.getElementById("atenderAtendio").textContent = d.atendio ? `Atiende: ${d.atendio}` : "";
        document.getElementById("atenderEstado").value = d.estado;
        document.getElementById("atenderPrioridad").value = d.prioridad;
        document.getElementById("atenderRespuesta").value = d.respuesta;
        exigirRespuesta();
        dlgAtender.showModal();
    });
});

// Al resolver o cerrar, la respuesta es obligatoria
const estado = document.getElementById("atenderEstado");
const respuesta = document.getElementById("atenderRespuesta");
const exigirRespuesta = () => { respuesta.required = ["RESUELTA", "CERRADA"].includes(estado.value); };
estado.addEventListener("change", exigirRespuesta);
