(() => {
    "use strict";

    const elementos = {
        modal: document.getElementById("modalHuesped"),
        dialogo: document.querySelector("#modalHuesped .huesped-modal__dialog"),
        titulo: document.getElementById("huespedModalTitulo"),
        descripcion: document.getElementById("huespedModalDescripcion"),
        contenido: document.getElementById("huespedModalContenido"),
        tabla: document.getElementById("tablaHuespedes")
    };

    let solicitudActual = 0;
    let elementoEnFoco = null;

    function formatearFecha(valor) {
        if (!valor) return "No disponible";
        const [anio, mes, dia] = String(valor).slice(0, 10).split("-").map(Number);
        if (!anio || !mes || !dia) return "No disponible";
        return new Date(anio, mes - 1, dia).toLocaleDateString("es-MX", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    }

    async function obtenerHuesped(id) {
        const respuesta = await fetch(`/admin/huespedes/${encodeURIComponent(id)}`, {
            method: "GET",
            credentials: "same-origin",
            headers: { Accept: "application/json" }
        });
        const datos = await respuesta.json().catch(() => ({}));

        if (respuesta.status === 401 && datos.redirect) {
            window.location.assign(datos.redirect);
        }
        if (!respuesta.ok || !datos.success) {
            throw new Error(datos.message || `Error del servidor (HTTP ${respuesta.status}).`);
        }
        return datos.huesped;
    }

    function agregarDato(etiqueta, valor) {
        const fila = document.createElement("div");
        fila.className = "huesped-modal__field";

        const nombreCampo = document.createElement("span");
        nombreCampo.className = "huesped-modal__label";
        nombreCampo.textContent = etiqueta;

        const dato = document.createElement("strong");
        dato.className = "huesped-modal__value";
        dato.textContent = valor || "No disponible";

        fila.append(nombreCampo, dato);
        elementos.contenido.append(fila);
    }

    function abrir() {
        elementoEnFoco = document.activeElement;
        elementos.contenido.replaceChildren();
        elementos.titulo.textContent = "Cargando huésped...";
        elementos.descripcion.textContent = "Consultando información actualizada.";
        elementos.modal.classList.add("is-open");
        elementos.modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("huesped-modal-active");
        elementos.dialogo.focus();
    }

    function cerrar() {
        solicitudActual += 1;
        elementos.modal.classList.remove("is-open");
        elementos.modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("huesped-modal-active");
        elementos.contenido.replaceChildren();
        elementos.titulo.textContent = "Detalle del huésped";
        elementos.descripcion.textContent = "Información del huésped seleccionado.";
        if (elementoEnFoco?.isConnected) elementoEnFoco.focus();
    }

    async function consultar(id) {
        const solicitud = ++solicitudActual;
        abrir();

        const indicador = document.createElement("p");
        indicador.className = "huesped-modal__loading";
        indicador.textContent = "Cargando información...";
        elementos.contenido.append(indicador);

        try {
            const huesped = await obtenerHuesped(id);
            if (solicitud !== solicitudActual) return;

            const nombre = `${huesped.nombre || ""} ${huesped.apellidos || ""}`.trim();
            elementos.titulo.textContent = nombre || "Detalle del huésped";
            elementos.descripcion.textContent = "Información del huésped seleccionado.";
            elementos.contenido.replaceChildren();
            agregarDato("Nombre completo", nombre);
            agregarDato("Correo electrónico", huesped.email);
            agregarDato("Teléfono", huesped.telefono);
            agregarDato(
                "Habitación",
                huesped.numero_habitacion
                    ? `${huesped.numero_habitacion} · ${huesped.tipo_habitacion || "Tipo no disponible"}`
                    : "Sin habitación asignada"
            );
            agregarDato("Fecha de registro", formatearFecha(huesped.fecha_registro));
            agregarDato("Estado", "Activo");
        } catch (error) {
            if (solicitud !== solicitudActual) return;
            elementos.titulo.textContent = "No se pudo consultar";
            elementos.descripcion.textContent = "La información no está disponible.";
            elementos.contenido.replaceChildren();
            const mensaje = document.createElement("p");
            mensaje.className = "huesped-modal__error";
            mensaje.textContent = error.message || "Error al recuperar la información.";
            elementos.contenido.append(mensaje);
        }

        if (elementos.modal.classList.contains("is-open")) elementos.dialogo.focus();
    }

    elementos.tabla.addEventListener("click", evento => {
        const boton = evento.target.closest("button[data-huesped-consultar]");
        if (boton) consultar(boton.dataset.huespedConsultar);
    });

    elementos.modal.addEventListener("click", evento => {
        if (evento.target === elementos.modal || evento.target.closest("[data-huesped-modal-cerrar]")) {
            cerrar();
        }
    });

    document.addEventListener("keydown", evento => {
        if (evento.key === "Escape" && elementos.modal.classList.contains("is-open")) {
            cerrar();
        }
    });
})();