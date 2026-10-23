(() => {
    "use strict";

    const API = "/admin/huespedes/api";
    const elementos = {
        tabla: document.getElementById("tablaHuespedes"),
        busqueda: document.getElementById("buscarHuesped"),
        contador: document.getElementById("contadorHuespedes"),
        registros: document.getElementById("huespedesRegistrosPorPagina"),
        anterior: document.getElementById("huespedPaginaAnterior"),
        siguiente: document.getElementById("huespedPaginaSiguiente"),
        pagina: document.getElementById("huespedPaginaActual"),
        modal: document.getElementById("modalHuesped"),
        dialogo: document.querySelector(".huesped-modal__dialog"),
        titulo: document.getElementById("huespedModalTitulo"),
        descripcion: document.getElementById("huespedModalDescripcion"),
        contenidoModal: document.getElementById("huespedModalContenido")
    };

    let huespedes = [];
    let paginaActual = 1;
    let solicitudDetalle = 0;
    let elementoEnFoco = null;

    function escaparHTML(valor) {
        return String(valor ?? "").replace(/[&<>"']/g, caracter => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[caracter]);
    }

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

    function mostrarEstadoTabla(texto, tipo = "info") {
        elementos.tabla.innerHTML = `
            <tr>
                <td colspan="8" class="hab-empty huespedes-empty huespedes-empty--${tipo}">
                    <strong>${escaparHTML(texto)}</strong>
                </td>
            </tr>
        `;
    }

    function actualizarControles(totalPaginas, totalFiltrado) {
        elementos.pagina.textContent = `${paginaActual} / ${totalPaginas}`;
        elementos.anterior.disabled = paginaActual <= 1;
        elementos.siguiente.disabled = paginaActual >= totalPaginas;
        elementos.contador.textContent = totalFiltrado === huespedes.length
            ? `${huespedes.length} huésped${huespedes.length === 1 ? "" : "es"} activo${huespedes.length === 1 ? "" : "s"}`
            : `${totalFiltrado} de ${huespedes.length} huéspedes activos`;
    }

    function renderizar() {
        const termino = elementos.busqueda.value.trim().toLocaleLowerCase("es-MX");
        const filtrados = huespedes.filter(huesped => {
            const texto = [
                huesped.id,
                huesped.nombre,
                huesped.apellidos,
                huesped.email,
                huesped.telefono,
                huesped.numero_habitacion,
                huesped.tipo_habitacion
            ].join(" ").toLocaleLowerCase("es-MX");
            return texto.includes(termino);
        });

        if (!filtrados.length) {
            paginaActual = 1;
            elementos.contador.textContent = huespedes.length
                ? "No se encontraron huéspedes con esa búsqueda."
                : "No hay huéspedes activos registrados.";
            elementos.pagina.textContent = "1 / 1";
            elementos.anterior.disabled = true;
            elementos.siguiente.disabled = true;
            mostrarEstadoTabla(
                huespedes.length
                    ? "No hay resultados para la búsqueda."
                    : "No hay huéspedes activos registrados."
            );
            return;
        }

        const limite = elementos.registros.value === "todos"
            ? filtrados.length
            : Number(elementos.registros.value);
        const totalPaginas = Math.max(1, Math.ceil(filtrados.length / limite));
        paginaActual = Math.min(paginaActual, totalPaginas);
        const inicio = (paginaActual - 1) * limite;
        const pagina = filtrados.slice(inicio, inicio + limite);

        elementos.tabla.innerHTML = pagina.map(huesped => {
            const nombre = `${huesped.nombre || ""} ${huesped.apellidos || ""}`.trim();
            return `
                <tr>
                    <td><span class="huesped-id">#${escaparHTML(huesped.id)}</span></td>
                    <td><strong class="huesped-name">${escaparHTML(nombre || "Sin nombre")}</strong></td>
                    <td>${escaparHTML(huesped.email || "No disponible")}</td>
                    <td>${escaparHTML(huesped.telefono || "No disponible")}</td>
                    <td>
                        <strong class="huesped-room-number">${escaparHTML(huesped.numero_habitacion || "Sin habitación asignada")}</strong>
                        ${huesped.tipo_habitacion ? `<span class="huesped-room-type">${escaparHTML(huesped.tipo_habitacion)}</span>` : ""}
                    </td>
                    <td>${escaparHTML(formatearFecha(huesped.fecha_registro))}</td>
                    <td><span class="huesped-status">Activo</span></td>
                    <td>
                        <button
                            class="hab-btn hab-btn-secondary hab-icon-btn huesped-view-btn"
                            type="button"
                            data-huesped-consultar="${escaparHTML(huesped.id)}"
                            aria-label="Consultar detalles de ${escaparHTML(nombre)}"
                            title="Consultar detalles"
                        >
                            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" stroke-width="1.6"/>
                                <circle cx="12" cy="12" r="2.7" stroke="currentColor" stroke-width="1.6"/>
                            </svg>
                            <span>Ver</span>
                        </button>
                    </td>
                </tr>
            `;
        }).join("");

        actualizarControles(totalPaginas, filtrados.length);
    }

    async function obtenerJSON(url) {
        const respuesta = await fetch(url, {
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
        return datos;
    }

    async function cargarHuespedes() {
        try {
            const datos = await obtenerJSON(API);
            if (!Array.isArray(datos.huespedes)) {
                throw new Error("El servidor devolvió una lista no válida.");
            }
            huespedes = datos.huespedes;
            renderizar();
        } catch (error) {
            elementos.contador.textContent = "No fue posible cargar los huéspedes.";
            mostrarEstadoTabla(error.message || "Error al recuperar la información.", "error");
        }
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
        elementos.contenidoModal.append(fila);
    }

    function abrirModal() {
        elementoEnFoco = document.activeElement;
        elementos.contenidoModal.replaceChildren();
        elementos.titulo.textContent = "Cargando huésped...";
        elementos.descripcion.textContent = "Consultando información actualizada.";
        elementos.modal.classList.add("is-open");
        elementos.modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("huesped-modal-active");
        elementos.dialogo.focus();
    }

    function cerrarModal() {
        solicitudDetalle += 1;
        elementos.modal.classList.remove("is-open");
        elementos.modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("huesped-modal-active");
        elementos.contenidoModal.replaceChildren();
        elementos.titulo.textContent = "Detalle del huésped";
        elementos.descripcion.textContent = "Información del huésped seleccionado.";
        if (elementoEnFoco?.isConnected) elementoEnFoco.focus();
    }

    async function consultarHuesped(id, boton) {
        const solicitud = ++solicitudDetalle;
        abrirModal();
        const indicador = document.createElement("p");
        indicador.className = "huesped-modal__loading";
        indicador.textContent = "Cargando información...";
        elementos.contenidoModal.append(indicador);

        try {
            const datos = await obtenerJSON(`/admin/huespedes/${encodeURIComponent(id)}`);
            if (solicitud !== solicitudDetalle) return;

            const huesped = datos.huesped;
            const nombre = `${huesped.nombre || ""} ${huesped.apellidos || ""}`.trim();
            elementos.titulo.textContent = nombre || "Detalle del huésped";
            elementos.descripcion.textContent = `Huésped #${huesped.id}`;
            elementos.contenidoModal.replaceChildren();
            agregarDato("Identificador", `#${huesped.id}`);
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
            if (solicitud !== solicitudDetalle) return;
            elementos.titulo.textContent = "No se pudo consultar";
            elementos.descripcion.textContent = "La información no está disponible.";
            elementos.contenidoModal.replaceChildren();
            const mensaje = document.createElement("p");
            mensaje.className = "huesped-modal__error";
            mensaje.textContent = error.message || "Error al recuperar la información.";
            elementos.contenidoModal.append(mensaje);
        }

        if (boton && elementos.modal.classList.contains("is-open")) {
            elementos.dialogo.focus();
        }
    }

    elementos.busqueda.addEventListener("input", () => {
        paginaActual = 1;
        renderizar();
    });
    elementos.registros.addEventListener("change", () => {
        paginaActual = 1;
        renderizar();
    });
    elementos.anterior.addEventListener("click", () => {
        if (paginaActual > 1) {
            paginaActual -= 1;
            renderizar();
        }
    });
    elementos.siguiente.addEventListener("click", () => {
        paginaActual += 1;
        renderizar();
    });
    elementos.tabla.addEventListener("click", evento => {
        const boton = evento.target.closest("button[data-huesped-consultar]");
        if (boton) consultarHuesped(boton.dataset.huespedConsultar, boton);
    });
    elementos.modal.addEventListener("click", evento => {
        if (evento.target === elementos.modal || evento.target.closest("[data-huesped-modal-cerrar]")) {
            cerrarModal();
        }
    });
    document.addEventListener("keydown", evento => {
        if (evento.key === "Escape" && elementos.modal.classList.contains("is-open")) {
            cerrarModal();
        }
    });

    cargarHuespedes();
})();