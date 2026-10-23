(() => {
    "use strict";

    const API = "/admin/reservaciones/api";
    const API_CLIENTES = "/admin/reservaciones/clientes";
    const API_DISPONIBLES = "/admin/reservaciones/disponibles";

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
    let reservacionEnEdicion = null;
    let guardando = false;
    let paginaActual = 1;
    let consultaDisponibles = 0; // evita que una respuesta lenta pise a una más reciente

    const $ = (id) => document.getElementById(id);

    const elementos = {
        tabla: $("tablaReservaciones"),
        mensaje: $("resMensaje"),
        busqueda: $("buscarReservacion"),
        filtroEstado: $("filtroEstadoReservacion"),
        registros: $("resRegistrosPorPagina"),
        anterior: $("resPaginaAnterior"),
        siguiente: $("resPaginaSiguiente"),
        pagina: $("resPaginaActual"),
        contador: $("contadorReservaciones"),

        // Modal
        modal: $("modalReservacion"),
        formulario: $("formReservacion"),
        titulo: $("resModalTitulo"),
        id: $("resId"),
        cliente: $("resCliente"),
        entrada: $("resEntrada"),
        salida: $("resSalida"),
        habitacion: $("resHabitacion"),
        adultos: $("resAdultos"),
        ninos: $("resNinos"),
        descuento: $("resDescuento"),
        estado: $("resEstado"),
        origen: $("resOrigen"),
        comentarios: $("resComentarios"),
        resumen: $("resResumen"),
        errorFormulario: $("resErrorFormulario"),
        botonGuardar: $("btnGuardarReservacion"),

        // Ventana de confirmación
        confirmacion: $("modalConfirmarRes"),
        confirmTitulo: $("resConfirmTitulo"),
        confirmTexto: $("resConfirmTexto"),
        confirmSi: $("btnConfirmarSiRes"),
        confirmNo: $("btnConfirmarNoRes")
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
        // "2026-10-13" -> fecha local (evita desfases de zona horaria)
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
        return numero.toLocaleString("es-MX", {
            style: "currency",
            currency: "MXN"
        });
    }

    function hoyISO() {
        const d = new Date();
        const mes = String(d.getMonth() + 1).padStart(2, "0");
        const dia = String(d.getDate()).padStart(2, "0");
        return `${d.getFullYear()}-${mes}-${dia}`;
    }

    function mostrarMensaje(texto, tipo = "success") {
        if (!elementos.mensaje) return;

        elementos.mensaje.textContent = texto;
        elementos.mensaje.className =
            "hab-message is-visible " +
            (tipo === "error" ? "hab-message-error" : "hab-message-success");

        elementos.mensaje.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function ocultarMensaje() {
        if (!elementos.mensaje) return;
        elementos.mensaje.textContent = "";
        elementos.mensaje.className = "hab-message";
    }

    function mostrarErrorFormulario(texto) {
        elementos.errorFormulario.textContent = texto;
        elementos.errorFormulario.classList.add("is-visible");
    }

    function limpiarErrorFormulario() {
        elementos.errorFormulario.textContent = "";
        elementos.errorFormulario.classList.remove("is-visible");
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
            // Sesión terminada: volver al login
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

    function mostrarCarga(texto, conSpinner = true) {
        elementos.tabla.innerHTML = `
            <tr>
                <td colspan="8" class="hab-empty">
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

            return `
                <tr data-reservacion-id="${id}" style="--fila-index:${indice}">
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

            const reservacionSolicitada = new URLSearchParams(location.search)
                .get("reservacion_id");
            const reservacion = reservacionesData.find(
                r => String(r.id) === reservacionSolicitada
            );
            if (reservacion) {
                elementos.busqueda.value = reservacion.codigo_reservacion;
                paginaActual = 1;
                renderizar();
                requestAnimationFrame(() => {
                    const fila = elementos.tabla.querySelector(
                        `tr[data-reservacion-id="${Number(reservacion.id)}"]`
                    );
                    fila?.classList.add("res-notification-target");
                    fila?.scrollIntoView({ behavior: "smooth", block: "center" });
                });
            }

        } catch (error) {
            console.error("Error al cargar reservaciones:", error);

            reservacionesData = [];
            actualizarResumen();

            elementos.contador.textContent = "No se pudieron cargar los registros.";
            elementos.pagina.textContent = "1 / 1";
            elementos.anterior.disabled = true;
            elementos.siguiente.disabled = true;

            mostrarCarga("Error al cargar reservaciones. Revisa la consola y la ruta de la API.");
            mostrarMensaje(error.message, "error");
        }
    }

    async function cargarClientes() {
        elementos.cliente.innerHTML = '<option value="">Cargando huéspedes...</option>';

        try {
            const data = await obtenerJSON(API_CLIENTES);

            if (!data.success || !Array.isArray(data.clientes)) {
                throw new Error(data.message || "No se pudieron obtener los huéspedes.");
            }

            elementos.cliente.innerHTML = data.clientes.length
                ? '<option value="">Seleccione un huésped...</option>'
                : '<option value="">No hay huéspedes registrados</option>';

            data.clientes.forEach(c => {
                const opcion = document.createElement("option");
                opcion.value = String(c.id);
                opcion.textContent = `${c.nombre} — ${c.email}`;
                elementos.cliente.appendChild(opcion);
            });

        } catch (error) {
            console.error("Error al cargar huéspedes:", error);
            elementos.cliente.innerHTML = '<option value="">No se pudieron cargar los huéspedes</option>';
            mostrarMensaje("No se pudieron cargar los huéspedes.", "error");
        }
    }

    async function cargarDisponibles(seleccion = "") {
        const entrada = elementos.entrada.value;
        const salida = elementos.salida.value;

        if (!entrada || !salida || salida <= entrada) {
            consultaDisponibles++;
            elementos.habitacion.disabled = true;
            elementos.habitacion.innerHTML = '<option value="">Selecciona primero las fechas</option>';
            actualizarResumenModal();
            return;
        }

        const consulta = ++consultaDisponibles;

        elementos.habitacion.disabled = true;
        elementos.habitacion.innerHTML = '<option value="">Buscando habitaciones...</option>';

        try {
            const params = new URLSearchParams({ entrada, salida });
            if (elementos.id.value) params.set("excluir", elementos.id.value);

            const data = await obtenerJSON(`${API_DISPONIBLES}?${params.toString()}`);

            if (consulta !== consultaDisponibles) return;

            if (!data.success || !Array.isArray(data.habitaciones)) {
                throw new Error(data.message || "No se pudo consultar la disponibilidad.");
            }

            if (data.habitaciones.length === 0) {
                elementos.habitacion.innerHTML =
                    '<option value="">No hay habitaciones disponibles en esas fechas</option>';
                actualizarResumenModal();
                return;
            }

            elementos.habitacion.innerHTML = '<option value="">Seleccione una habitación...</option>';

            data.habitaciones.forEach(h => {
                const opcion = document.createElement("option");
                opcion.value = String(h.id);
                opcion.textContent =
                    `Hab. ${h.numero} · ${h.tipo} · ${formatearMoneda(h.precio)}/noche`;
                opcion.dataset.precio = String(h.precio);
                elementos.habitacion.appendChild(opcion);
            });

            elementos.habitacion.disabled = false;

            if (seleccion) elementos.habitacion.value = String(seleccion);

            actualizarResumenModal();

        } catch (error) {
            if (consulta !== consultaDisponibles) return;

            console.error("Error al consultar disponibilidad:", error);
            elementos.habitacion.innerHTML = '<option value="">No se pudo consultar la disponibilidad</option>';
            mostrarErrorFormulario(error.message);
        }
    }

    // =====================================================
    // MODAL
    // =====================================================

    function llenarEstados(edicion, estadoActual = "PENDIENTE") {
        const permitidos = edicion
            ? ["PENDIENTE", "CONFIRMADA", "CHECK_IN", "CHECK_OUT", "CANCELADA", "NO_SHOW"]
            : ["PENDIENTE", "CONFIRMADA"];

        elementos.estado.innerHTML = permitidos
            .map(e => `<option value="${e}">${ETIQUETAS[e]}</option>`)
            .join("");

        elementos.estado.value = estadoActual;
    }

    function actualizarResumenModal() {
        const entrada = parsearFecha(elementos.entrada.value);
        const salida = parsearFecha(elementos.salida.value);
        const opcion = elementos.habitacion.selectedOptions[0];

        if (!entrada || !salida || salida <= entrada || !elementos.habitacion.value || !opcion) {
            elementos.resumen.textContent =
                "Selecciona fechas y habitación para ver el total estimado.";
            return;
        }

        const noches = Math.round((salida - entrada) / 86400000);

        let precio = Number(opcion.dataset.precio);
        let impuestos = 0;

        // Si se edita sin cambiar de habitación, el backend respeta el precio pactado
        if (reservacionEnEdicion) {
            impuestos = Number(reservacionEnEdicion.impuestos) || 0;

            if (Number(elementos.habitacion.value) === Number(reservacionEnEdicion.habitacion_id)) {
                precio = Number(reservacionEnEdicion.precio_noche);
            }
        }

        const descuento = Math.max(0, Number(elementos.descuento.value) || 0);
        const total = precio * noches + impuestos - descuento;

        elementos.resumen.textContent =
            `${noches} noche${noches === 1 ? "" : "s"} × ${formatearMoneda(precio)}` +
            (impuestos ? ` + impuestos ${formatearMoneda(impuestos)}` : "") +
            (descuento ? ` − descuento ${formatearMoneda(descuento)}` : "") +
            ` = Total estimado: ${formatearMoneda(Math.max(0, total))}`;
    }

    function abrirModal() {
        elementos.modal.classList.add("is-open");
        elementos.modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        elementos.cliente.focus();
    }

    function abrirModalCrear() {
        elementos.formulario.reset();

        reservacionEnEdicion = null;
        elementos.id.value = "";
        elementos.titulo.textContent = "Nueva reservación";
        elementos.botonGuardar.textContent = "Guardar reservación";

        limpiarErrorFormulario();
        ocultarMensaje();

        elementos.entrada.min = hoyISO();
        elementos.salida.min = hoyISO();

        llenarEstados(false, "CONFIRMADA");
        elementos.origen.value = "RECEPCION";
        elementos.adultos.value = 1;
        elementos.ninos.value = 0;
        elementos.descuento.value = 0;

        cargarDisponibles();
        abrirModal();
    }

    function prepararEditar(id) {
        const reservacion = reservacionesData.find(r => Number(r.id) === Number(id));

        if (!reservacion) {
            mostrarMensaje("No se encontró la reservación seleccionada.", "error");
            return;
        }

        elementos.formulario.reset();
        limpiarErrorFormulario();
        ocultarMensaje();

        reservacionEnEdicion = reservacion;

        elementos.id.value = reservacion.id;
        elementos.titulo.textContent = `Editar reservación ${reservacion.codigo_reservacion}`;
        elementos.botonGuardar.textContent = "Guardar cambios";

        elementos.entrada.removeAttribute("min");
        elementos.salida.removeAttribute("min");

        llenarEstados(true, normalizar(reservacion.estado));

        elementos.cliente.value = String(reservacion.cliente_id ?? "");
        elementos.entrada.value = reservacion.fecha_entrada ?? "";
        elementos.salida.value = reservacion.fecha_salida ?? "";
        elementos.adultos.value = reservacion.adultos ?? 1;
        elementos.ninos.value = reservacion.ninos ?? 0;
        elementos.descuento.value = reservacion.descuento ?? 0;
        elementos.origen.value = reservacion.origen || "RECEPCION";
        elementos.comentarios.value = reservacion.comentarios ?? "";

        cargarDisponibles(reservacion.habitacion_id);
        abrirModal();
    }

    function cerrarModal() {
        if (guardando) return;

        elementos.modal.classList.remove("is-open");
        elementos.modal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";

        limpiarErrorFormulario();
    }

    // =====================================================
    // VENTANA DE CONFIRMACIÓN
    // =====================================================

    let resolverConfirmacion = null;

    function confirmarAccion({ titulo, texto, textoBoton = "Confirmar" }) {
        return new Promise(resolve => {
            resolverConfirmacion = resolve;

            elementos.confirmTitulo.textContent = titulo;
            elementos.confirmTexto.textContent = texto;
            elementos.confirmSi.textContent = textoBoton;

            elementos.confirmacion.classList.add("is-open");
            elementos.confirmacion.setAttribute("aria-hidden", "false");

            elementos.confirmNo.focus();
        });
    }

    function cerrarConfirmacion(resultado) {
        elementos.confirmacion.classList.remove("is-open");
        elementos.confirmacion.setAttribute("aria-hidden", "true");

        if (resolverConfirmacion) {
            resolverConfirmacion(resultado);
            resolverConfirmacion = null;
        }
    }

    // =====================================================
    // ACCIONES
    // =====================================================

    async function guardarReservacion(evento) {
        evento.preventDefault();

        if (guardando) return;

        limpiarErrorFormulario();

        if (!elementos.formulario.reportValidity()) return;

        const id = elementos.id.value;

        const clienteId = Number(elementos.cliente.value);
        const habitacionId = Number(elementos.habitacion.value);
        const adultos = Number(elementos.adultos.value);
        const ninos = Number(elementos.ninos.value || 0);
        const descuento = Number(elementos.descuento.value || 0);

        if (!Number.isInteger(clienteId) || clienteId <= 0) {
            mostrarErrorFormulario("Selecciona un huésped.");
            return;
        }

        if (!elementos.entrada.value || !elementos.salida.value
            || elementos.salida.value <= elementos.entrada.value) {
            mostrarErrorFormulario("La fecha de salida debe ser posterior a la de entrada.");
            return;
        }

        if (!Number.isInteger(habitacionId) || habitacionId <= 0) {
            mostrarErrorFormulario("Selecciona una habitación disponible.");
            return;
        }

        if (!Number.isInteger(adultos) || adultos < 1 || !Number.isInteger(ninos) || ninos < 0) {
            mostrarErrorFormulario("Indica al menos un adulto y un número de niños válido.");
            return;
        }

        if (!Number.isFinite(descuento) || descuento < 0) {
            mostrarErrorFormulario("El descuento debe ser un número mayor o igual a cero.");
            return;
        }

        const payload = {
            cliente_id: clienteId,
            habitacion_id: habitacionId,
            fecha_entrada: elementos.entrada.value,
            fecha_salida: elementos.salida.value,
            adultos,
            ninos,
            descuento,
            estado: elementos.estado.value,
            origen: elementos.origen.value,
            comentarios: elementos.comentarios.value.trim()
        };

        const url = id ? `${API}/${encodeURIComponent(id)}` : API;
        const metodo = id ? "PUT" : "POST";

        guardando = true;
        elementos.botonGuardar.disabled = true;
        elementos.botonGuardar.textContent = "Guardando...";

        try {
            const data = await obtenerJSON(url, {
                method: metodo,
                body: JSON.stringify(payload)
            });

            if (!data.success) {
                throw new Error(data.message || "No se pudo guardar la reservación.");
            }

            guardando = false;
            cerrarModal();

            mostrarMensaje(data.message || "La reservación se guardó correctamente.");

            paginaActual = 1;
            await cargarReservaciones();

        } catch (error) {
            console.error("Error al guardar reservación:", error);
            mostrarErrorFormulario(error.message);

        } finally {
            guardando = false;
            elementos.botonGuardar.disabled = false;
            elementos.botonGuardar.textContent =
                elementos.id.value ? "Guardar cambios" : "Guardar reservación";
        }
    }

    async function cancelarReservacion(id) {
        const reservacion = reservacionesData.find(r => Number(r.id) === Number(id));

        if (!reservacion) {
            mostrarMensaje("No se encontró la reservación seleccionada.", "error");
            return;
        }

        const confirmado = await confirmarAccion({
            titulo: "¿Cancelar reservación?",
            texto:
                `Vas a cancelar la reservación ${reservacion.codigo_reservacion} ` +
                `de ${reservacion.cliente}. Se conservará su historial.`,
            textoBoton: "Sí, cancelar"
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

            ocultarMensaje();
            await cargarReservaciones();

        } catch (error) {
            console.error("Error al cancelar reservación:", error);
            mostrarMensaje(error.message, "error");
        }
    }

    // =====================================================
    // EVENTOS
    // =====================================================

    $("btnNuevaReservacion").addEventListener("click", abrirModalCrear);
    $("btnCerrarModalRes").addEventListener("click", cerrarModal);
    $("btnCancelarModalRes").addEventListener("click", cerrarModal);

    elementos.formulario.addEventListener("submit", guardarReservacion);

    elementos.entrada.addEventListener("change", () => {
        if (elementos.entrada.value) elementos.salida.min = elementos.entrada.value;
        cargarDisponibles(elementos.habitacion.value);
    });

    elementos.salida.addEventListener("change", () => {
        cargarDisponibles(elementos.habitacion.value);
    });

    elementos.habitacion.addEventListener("change", actualizarResumenModal);
    elementos.descuento.addEventListener("input", actualizarResumenModal);

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

        if (boton.dataset.accion === "editar") prepararEditar(id);
        if (boton.dataset.accion === "cancelar") cancelarReservacion(id);
    });

    elementos.modal.addEventListener("click", evento => {
        if (evento.target === elementos.modal) cerrarModal();
    });

    elementos.confirmSi.addEventListener("click", () => cerrarConfirmacion(true));
    elementos.confirmNo.addEventListener("click", () => cerrarConfirmacion(false));

    elementos.confirmacion.addEventListener("click", evento => {
        if (evento.target === elementos.confirmacion) cerrarConfirmacion(false);
    });

    document.addEventListener("keydown", evento => {
        if (evento.key !== "Escape") return;

        // Si la confirmación está abierta, Escape solo cierra esa ventana
        if (elementos.confirmacion.classList.contains("is-open")) {
            cerrarConfirmacion(false);
            return;
        }

        if (elementos.modal.classList.contains("is-open")) {
            cerrarModal();
        }
    });

    // =====================================================
    // CARGA INICIAL
    // =====================================================

    async function iniciar() {
        await Promise.all([
            cargarClientes(),
            cargarReservaciones()
        ]);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    } else {
        iniciar();
    }

})();