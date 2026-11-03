/* ============================================================
   RESERVACIONES (ADMIN) - PÁGINA
   Tabla, búsqueda, filtro, paginación y cancelación.
   El formulario vive en modal_reservacion.js (se carga antes).
   ============================================================ */
(() => {
    "use strict";

    const API = "/admin/reservaciones/api";

    const ACTIVOS = ["PENDIENTE", "CONFIRMADA", "CHECK_IN"];
    const CERRADOS = ["CANCELADA", "CHECK_OUT", "NO_SHOW"];
    const CANCELABLES = ["PENDIENTE", "CONFIRMADA"];

    const ETIQUETAS = {
        PENDIENTE: "Pendiente",
        CONFIRMADA: "Confirmada",
        CHECK_IN: "Check-in",
        CHECK_OUT: "Check-out",
        CANCELADA: "Cancelada",
        NO_SHOW: "No show"
    };

    let reservacionesData = [];
    let paginaActual = 1;

    const $ = (id) => document.getElementById(id);

    const elementos = {
        tabla: $("tablaReservaciones"),
        busqueda: $("buscarReservacion"),
        filtroEstado: $("filtroEstadoReservacion"),
        registros: $("resRegistrosPorPagina"),
        anterior: $("resPaginaAnterior"),
        siguiente: $("resPaginaSiguiente"),
        pagina: $("resPaginaActual"),
        contador: $("contadorReservaciones"),
        thAcciones: $("thAccionesRes")
    };

    // =====================================================
    // UTILIDADES
    // =====================================================

    function escaparHTML(valor) {
        return String(valor ?? "").replace(/[&<>"']/g, caracter => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[caracter]);
    }

    function normalizar(estado) {
        return String(estado ?? "").trim().toUpperCase();
    }

    function parsearFecha(texto) {
        const partes = String(texto ?? "").split("-").map(Number);
        if (partes.length !== 3 || partes.some(Number.isNaN)) return null;
        return new Date(partes[0], partes[1] - 1, partes[2]);
    }

    function formatearFecha(texto) {
        const fecha = parsearFecha(texto);
        if (!fecha) return "—";
        return fecha.toLocaleDateString("es-MX", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    }

    function formatearMoneda(valor) {
        const numero = Number(valor);
        if (valor === null || valor === undefined || valor === "" || !Number.isFinite(numero)) {
            return "No disponible";
        }
        return numero.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
    }

    // Mensaje flotante: confirmaciones, actualizaciones y errores
    function mostrarMensaje(texto, tipo = "success") {
        let contenedor = document.getElementById("resToasts");

        if (!contenedor) {
            contenedor = document.createElement("div");
            contenedor.id = "resToasts";
            contenedor.className = "res-toasts";
            contenedor.setAttribute("aria-live", "polite");
            document.body.appendChild(contenedor);
        }

        const esError = tipo === "error";
        const aviso = document.createElement("div");

        aviso.className = `res-toast ${esError ? "res-toast-error" : "res-toast-success"}`;
        aviso.setAttribute("role", esError ? "alert" : "status");
        aviso.textContent = texto;

        contenedor.appendChild(aviso);

        const quitar = () => {
            aviso.classList.add("is-leaving");
            setTimeout(() => aviso.remove(), 250);
        };

        const temporizador = setTimeout(quitar, esError ? 6500 : 4000);

        // Al hacer clic se cierra antes
        aviso.addEventListener("click", () => {
            clearTimeout(temporizador);
            quitar();
        });
    }

    async function obtenerJSON(url, opciones = {}) {
        const respuesta = await fetch(url, {
            credentials: "same-origin",
            ...opciones,
            headers: {
                Accept: "application/json",
                ...(opciones.body ? { "Content-Type": "application/json" } : {}),
                ...(opciones.headers || {})
            }
        });

        const contenido = await respuesta.text();
        let data;

        try {
            data = contenido ? JSON.parse(contenido) : {};
        } catch {
            throw new Error(
                `El servidor devolvió una respuesta que no es JSON (HTTP ${respuesta.status}).`
            );
        }

        if (!respuesta.ok) {
            if (respuesta.status === 401 && data.redirect) {
                window.location.href = data.redirect;
            }

            throw new Error(
                data.message || data.mensaje || `Error del servidor (HTTP ${respuesta.status}).`
            );
        }

        return data;
    }

    // =====================================================
    // TABLA
    // =====================================================

    // Con el filtro "Cancelada" se oculta la columna Acciones
    function sinColumnaAcciones() {
        return elementos.filtroEstado.value === "CANCELADA";
    }

    function mostrarCarga(texto, conSpinner = true) {
        const columnas = sinColumnaAcciones() ? 7 : 8;

        elementos.tabla.innerHTML = `
            <tr>
                <td colspan="${columnas}" class="hab-empty">
                    ${conSpinner ? '<span class="hab-loading-spinner" aria-hidden="true"></span>' : ""}
                    <strong>${escaparHTML(texto)}</strong>
                </td>
            </tr>
        `;
    }

    function actualizarResumen() {
        const total = reservacionesData.length;

        const activas = reservacionesData.filter(
            r => ACTIVOS.includes(normalizar(r.estado))
        ).length;

        const canceladas = reservacionesData.filter(
            r => normalizar(r.estado) === "CANCELADA"
        ).length;

        $("totalReservaciones").textContent = total;
        $("reservacionesActivas").textContent = activas;
        $("reservacionesCanceladas").textContent = canceladas;
    }

    function icono(accion) {
        if (accion === "editar") {
            return `
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="m14 6 4 4M4 20l4.2-.8L19 8.4a2.1 2.1 0 0 0-3-3L5.2 16.2 4 20Z"
                          stroke="currentColor" stroke-width="1.6"
                          stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
        }

        return `
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.6"/>
                <path d="M9 9l6 6m0-6-6 6" stroke="currentColor"
                      stroke-width="1.6" stroke-linecap="round"/>
            </svg>
        `;
    }

    function renderizar() {
        const busqueda = elementos.busqueda.value.trim().toLocaleLowerCase("es-MX");
        const estadoFiltro = elementos.filtroEstado.value;
        const sinAcciones = sinColumnaAcciones();

        // Columna de acciones: solo se oculta en estado Cancelada
        elementos.thAcciones.hidden = sinAcciones;

        const filtradas = reservacionesData.filter(r => {
            if (estadoFiltro && normalizar(r.estado) !== estadoFiltro) return false;

            const texto = [
                r.codigo_reservacion,
                r.cliente,
                r.habitacion,
                r.tipo_habitacion,
                ETIQUETAS[normalizar(r.estado)],
                r.fecha_entrada,
                r.fecha_salida,
                r.origen
            ].join(" ").toLocaleLowerCase("es-MX");

            return texto.includes(busqueda);
        });

        actualizarResumen();

        const valorSelector = elementos.registros.value;
        const mostrarTodos = valorSelector === "todos";
        const cantidad = mostrarTodos
            ? filtradas.length || 1
            : Math.max(1, Number(valorSelector) || 10);

        const totalPaginas = mostrarTodos
            ? 1
            : Math.max(1, Math.ceil(filtradas.length / cantidad));

        paginaActual = Math.max(1, Math.min(paginaActual, totalPaginas));

        const inicio = mostrarTodos ? 0 : (paginaActual - 1) * cantidad;
        const visibles = mostrarTodos
            ? filtradas
            : filtradas.slice(inicio, inicio + cantidad);

        const desde = filtradas.length > 0 ? inicio + 1 : 0;
        const hasta = mostrarTodos
            ? filtradas.length
            : Math.min(inicio + cantidad, filtradas.length);

        elementos.contador.textContent =
            `Mostrando ${desde}–${hasta} de ${filtradas.length} resultados` +
            (busqueda || estadoFiltro
                ? ` (de ${reservacionesData.length} reservaciones)`
                : "");

        elementos.pagina.textContent = `${paginaActual} / ${totalPaginas}`;
        elementos.anterior.disabled = paginaActual <= 1;
        elementos.siguiente.disabled = paginaActual >= totalPaginas;

        if (filtradas.length === 0) {
            mostrarCarga(
                reservacionesData.length === 0
                    ? "No hay reservaciones registradas."
                    : "No se encontraron reservaciones con esos filtros.",
                false
            );
            return;
        }

        elementos.tabla.innerHTML = visibles.map((r, indice) => {
            const id = Number(r.id);
            if (!Number.isSafeInteger(id) || id < 0) return "";

            const estado = normalizar(r.estado);
            const etiqueta = ETIQUETAS[estado] || estado || "Sin estado";
            const claseEstado = Object.prototype.hasOwnProperty.call(ETIQUETAS, estado)
                ? `res-badge-${estado.toLowerCase()}`
                : "res-badge-no_show";

            const puedeEditar = !CERRADOS.includes(estado);
            const puedeCancelar = CANCELABLES.includes(estado);

            const celdaAcciones = sinAcciones ? "" : `
                <td>
                    <div class="hab-actions">
                        ${puedeEditar ? `
                            <button type="button"
                                class="hab-btn hab-btn-edit hab-icon-btn"
                                data-accion="editar" data-id="${id}"
                                title="Editar reservación"
                                aria-label="Editar reservación ${escaparHTML(r.codigo_reservacion)}">
                                ${icono("editar")}<span>Editar</span>
                            </button>
                        ` : ""}

                        ${puedeCancelar ? `
                            <button type="button"
                                class="hab-btn hab-btn-danger hab-icon-btn"
                                data-accion="cancelar" data-id="${id}"
                                title="Cancelar reservación"
                                aria-label="Cancelar reservación ${escaparHTML(r.codigo_reservacion)}">
                                ${icono("cancelar")}<span>Cancelar</span>
                            </button>
                        ` : ""}
                    </div>
                </td>
            `;

            return `
                <tr style="--fila-index:${indice}">
                    <td><span class="res-folio">${escaparHTML(r.codigo_reservacion)}</span></td>

                    <td>${escaparHTML(r.cliente)}</td>

                    <td>
                        <span class="hab-room-number">${escaparHTML(r.habitacion)}</span>
                        <span class="res-sub">${escaparHTML(r.tipo_habitacion)}</span>
                    </td>

                    <td>${escaparHTML(formatearFecha(r.fecha_entrada))}</td>
                    <td>${escaparHTML(formatearFecha(r.fecha_salida))}</td>

                    <td class="hab-price">${escaparHTML(formatearMoneda(r.total))}</td>

                    <td><span class="res-badge ${claseEstado}">${escaparHTML(etiqueta)}</span></td>

                    ${celdaAcciones}
                </tr>
            `;
        }).join("");

        if (!elementos.tabla.innerHTML.trim()) {
            mostrarCarga("No se pudieron mostrar los registros recibidos.");
        }
    }

    // =====================================================
    // CARGA DE DATOS
    // =====================================================

    async function cargarReservaciones() {
        mostrarCarga("Cargando reservaciones...");

        try {
            const data = await obtenerJSON(API);

            if (!data.success || !Array.isArray(data.reservaciones)) {
                throw new Error(
                    data.message || "La respuesta no contiene la lista de reservaciones."
                );
            }

            reservacionesData = data.reservaciones;
            renderizar();

        } catch (error) {
            console.error("Error al cargar reservaciones:", error);

            reservacionesData = [];
            actualizarResumen();

            elementos.contador.textContent = "No se pudieron cargar los registros.";
            elementos.pagina.textContent = "1 / 1";
            elementos.anterior.disabled = true;
            elementos.siguiente.disabled = true;

            mostrarCarga("Error al cargar reservaciones. Revisa la consola y la ruta de la API.", false);
            mostrarMensaje(error.message, "error");
        }
    }

    // =====================================================
    // ACCIONES
    // =====================================================

    function buscarReservacion(id) {
        return reservacionesData.find(r => Number(r.id) === Number(id));
    }

    async function cancelarReservacion(id) {
        const reservacion = buscarReservacion(id);

        if (!reservacion) {
            mostrarMensaje("No se encontró la reservación seleccionada.", "error");
            return;
        }

        const confirmado = await window.ReservacionModal.confirmar({
            titulo: "¿Cancelar reservación?",
            texto:
                `Vas a cancelar la reservación ${reservacion.codigo_reservacion} ` +
                `de ${reservacion.cliente}. Se conservará su historial.`,
            textoBoton: "Sí, cancelar",
            tipo: "peligro"
        });

        if (!confirmado) return;

        try {
            const data = await obtenerJSON(
                `${API}/${encodeURIComponent(id)}/cancelar`,
                { method: "PATCH" }
            );

            if (!data.success) {
                throw new Error(data.message || "No se pudo cancelar la reservación.");
            }

            mostrarMensaje(data.message || "La reservación se canceló correctamente.");
            await cargarReservaciones();

        } catch (error) {
            console.error("Error al cancelar reservación:", error);
            mostrarMensaje(error.message, "error");
        }
    }

    // =====================================================
    // EVENTOS
    // =====================================================

    $("btnNuevaReservacion").addEventListener("click", () => {
        if (!window.ReservacionModal) {
            mostrarMensaje("No se pudo cargar el formulario de reservaciones.", "error");
            return;
        }

        window.ReservacionModal.abrirCrear();
    });

    elementos.busqueda.addEventListener("input", () => {
        paginaActual = 1;
        renderizar();
    });

    elementos.filtroEstado.addEventListener("change", () => {
        paginaActual = 1;
        renderizar();
    });

    elementos.registros.addEventListener("change", () => {
        paginaActual = 1;
        renderizar();
    });

    elementos.anterior.addEventListener("click", () => {
        if (paginaActual > 1) {
            paginaActual--;
            renderizar();
        }
    });

    elementos.siguiente.addEventListener("click", () => {
        paginaActual++;
        renderizar();
    });

    elementos.tabla.addEventListener("click", evento => {
        const boton = evento.target.closest("button[data-accion]");
        if (!boton) return;

        const id = Number(boton.dataset.id);
        if (!Number.isSafeInteger(id)) return;

        if (boton.dataset.accion === "editar") {
            window.ReservacionModal.abrirEditar(buscarReservacion(id));
        }

        if (boton.dataset.accion === "cancelar") {
            cancelarReservacion(id);
        }
    });

    // =====================================================
    // CARGA INICIAL
    // =====================================================

    async function iniciar() {
        if (!window.ReservacionModal) {
            console.error("Falta cargar modal_reservacion.js antes de reservaciones.js");
            mostrarMensaje("No se pudo cargar el formulario de reservaciones.", "error");
        } else {
            // Después de crear o editar: aviso y recarga de la tabla
            window.ReservacionModal.configurar({
                alGuardar: async (mensaje) => {
                    mostrarMensaje(mensaje);
                    paginaActual = 1;
                    await cargarReservaciones();
                }
            });
        }

        const tareas = [cargarReservaciones()];

        if (window.ReservacionModal) {
            tareas.push(
                window.ReservacionModal.cargarClientes().then(resultado => {
                    if (!resultado.ok) mostrarMensaje(resultado.mensaje, "error");
                })
            );
        }

        await Promise.all(tareas);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    } else {
        iniciar();
    }

})(); 