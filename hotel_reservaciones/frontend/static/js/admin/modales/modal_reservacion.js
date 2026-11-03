/* ============================================================
   MODAL DE RESERVACIÓN (ADMIN)
   Archivo independiente del JS de la página. Expone:
   window.ReservacionModal = { configurar, cargarClientes,
                               abrirCrear, abrirEditar, confirmar }
   Debe cargarse ANTES de reservaciones.js
   ============================================================ */
(() => {
    "use strict";

    const API = "/admin/reservaciones/api";
    const API_CLIENTES = "/admin/reservaciones/clientes";
    const API_DISPONIBLES = "/admin/reservaciones/disponibles";

    const ETIQUETAS = {
        PENDIENTE: "Pendiente",
        CONFIRMADA: "Confirmada",
        CHECK_IN: "Check-in",
        CHECK_OUT: "Check-out",
        CANCELADA: "Cancelada",
        NO_SHOW: "No show"
    };

    let reservacionEnEdicion = null;
    let guardando = false;
    let consultaDisponibles = 0; // evita que una respuesta lenta pise a una más reciente
    let resolverConfirmacion = null;
    let alGuardar = () => {};

    const $ = (id) => document.getElementById(id);

    const el = {
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
        error: $("resErrorFormulario"),
        guardar: $("btnGuardarReservacion"),
        cancelar: $("btnCancelarModalRes"),

        confirmacion: $("modalConfirmarRes"),
        confirmTitulo: $("resConfirmTitulo"),
        confirmTexto: $("resConfirmTexto"),
        confirmSi: $("btnConfirmarSiRes"),
        confirmNo: $("btnConfirmarNoRes")
    };

    if (!el.modal || !el.formulario) {
        console.error("No se encontró el modal de reservaciones en la página.");
        return;
    }

    // =====================================================
    // UTILIDADES
    // =====================================================

    function parsearFecha(texto) {
        // "2026-10-13" -> fecha local (evita desfases de zona horaria)
        const partes = String(texto ?? "").split("-").map(Number);
        if (partes.length !== 3 || partes.some(Number.isNaN)) return null;
        return new Date(partes[0], partes[1] - 1, partes[2]);
    }

    function formatearMoneda(valor) {
        const numero = Number(valor);
        if (valor === null || valor === undefined || valor === "" || !Number.isFinite(numero)) {
            return "No disponible";
        }
        return numero.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
    }

    function hoyISO() {
        const d = new Date();
        const mes = String(d.getMonth() + 1).padStart(2, "0");
        const dia = String(d.getDate()).padStart(2, "0");
        return `${d.getFullYear()}-${mes}-${dia}`;
    }

    function mostrarError(texto) {
        el.error.textContent = texto;
        el.error.classList.add("is-visible");
    }

    function limpiarError() {
        el.error.textContent = "";
        el.error.classList.remove("is-visible");
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
    // DATOS DEL FORMULARIO
    // =====================================================

    async function cargarClientes(seleccion = "") {
        const anterior = seleccion || el.cliente.value;

        try {
            const data = await obtenerJSON(API_CLIENTES);

            if (!data.success || !Array.isArray(data.clientes)) {
                throw new Error(data.message || "No se pudieron obtener los huéspedes.");
            }

            el.cliente.innerHTML = data.clientes.length
                ? '<option value="">Seleccione un huésped...</option>'
                : '<option value="">No hay huéspedes registrados</option>';

            data.clientes.forEach(c => {
                const opcion = document.createElement("option");
                opcion.value = String(c.id);
                opcion.textContent = `${c.nombre} — ${c.email}`;
                el.cliente.appendChild(opcion);
            });

            if (anterior) el.cliente.value = String(anterior);

            return { ok: true };

        } catch (error) {
            console.error("Error al cargar huéspedes:", error);
            el.cliente.innerHTML = '<option value="">No se pudieron cargar los huéspedes</option>';
            return { ok: false, mensaje: "No se pudieron cargar los huéspedes." };
        }
    }

    async function cargarDisponibles(seleccion = "") {
        const entrada = el.entrada.value;
        const salida = el.salida.value;

        if (!entrada || !salida || salida <= entrada) {
            consultaDisponibles++;
            el.habitacion.disabled = true;
            el.habitacion.innerHTML = '<option value="">Selecciona primero las fechas</option>';
            actualizarResumen();
            return;
        }

        const consulta = ++consultaDisponibles;

        el.habitacion.disabled = true;
        el.habitacion.innerHTML = '<option value="">Buscando habitaciones...</option>';

        try {
            const params = new URLSearchParams({ entrada, salida });
            if (el.id.value) params.set("excluir", el.id.value);

            const data = await obtenerJSON(`${API_DISPONIBLES}?${params.toString()}`);

            if (consulta !== consultaDisponibles) return;

            if (!data.success || !Array.isArray(data.habitaciones)) {
                throw new Error(data.message || "No se pudo consultar la disponibilidad.");
            }

            if (data.habitaciones.length === 0) {
                el.habitacion.innerHTML =
                    '<option value="">No hay habitaciones disponibles en esas fechas</option>';
                actualizarResumen();
                return;
            }

            el.habitacion.innerHTML = '<option value="">Seleccione una habitación...</option>';

            data.habitaciones.forEach(h => {
                const opcion = document.createElement("option");
                opcion.value = String(h.id);
                opcion.textContent =
                    `Hab. ${h.numero} · ${h.tipo} · ${formatearMoneda(h.precio)}/noche`;
                opcion.dataset.precio = String(h.precio);
                el.habitacion.appendChild(opcion);
            });

            el.habitacion.disabled = false;

            if (seleccion) el.habitacion.value = String(seleccion);

            actualizarResumen();

        } catch (error) {
            if (consulta !== consultaDisponibles) return;

            console.error("Error al consultar disponibilidad:", error);
            el.habitacion.innerHTML = '<option value="">No se pudo consultar la disponibilidad</option>';
            mostrarError(error.message);
        }
    }

    function llenarEstados(edicion, estadoActual = "") {
        const permitidos = edicion
            ? ["PENDIENTE", "CONFIRMADA", "CHECK_IN", "CHECK_OUT", "CANCELADA", "NO_SHOW"]
            : ["PENDIENTE", "CONFIRMADA"];

        el.estado.innerHTML =
            '<option value="">Seleccione</option>' +
            permitidos.map(e => `<option value="${e}">${ETIQUETAS[e]}</option>`).join("");

        el.estado.value = estadoActual;
    }

    function actualizarResumen() {
        const entrada = parsearFecha(el.entrada.value);
        const salida = parsearFecha(el.salida.value);
        const opcion = el.habitacion.selectedOptions[0];

        if (!entrada || !salida || salida <= entrada || !el.habitacion.value || !opcion) {
            el.resumen.textContent = "Selecciona fechas y habitación para ver el total estimado.";
            return;
        }

        const noches = Math.round((salida - entrada) / 86400000);

        let precio = Number(opcion.dataset.precio);
        let impuestos = 0;

        // Si se edita sin cambiar de habitación, el servidor respeta el precio pactado
        if (reservacionEnEdicion) {
            impuestos = Number(reservacionEnEdicion.impuestos) || 0;

            if (Number(el.habitacion.value) === Number(reservacionEnEdicion.habitacion_id)) {
                precio = Number(reservacionEnEdicion.precio_noche);
            }
        }

        const descuento = Math.max(0, Number(el.descuento.value) || 0);
        const total = precio * noches + impuestos - descuento;

        el.resumen.textContent =
            `${noches} noche${noches === 1 ? "" : "s"} × ${formatearMoneda(precio)}` +
            (impuestos ? ` + impuestos ${formatearMoneda(impuestos)}` : "") +
            (descuento ? ` − descuento ${formatearMoneda(descuento)}` : "") +
            ` = Total estimado: ${formatearMoneda(Math.max(0, total))}`;
    }

    // =====================================================
    // ABRIR / CERRAR
    // =====================================================

    function abrir() {
        el.modal.classList.add("is-open");
        el.modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        el.cliente.focus();
    }

    function cerrar() {
        if (guardando) return;

        el.modal.classList.remove("is-open");
        el.modal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";

        limpiarError();
    }

    function abrirCrear() {
        el.formulario.reset();

        reservacionEnEdicion = null;
        el.id.value = "";
        el.titulo.textContent = "Nueva reservación";
        el.guardar.textContent = "Guardar reservación";

        limpiarError();

        const hoy = hoyISO();
        el.entrada.min = hoy;
        el.salida.min = hoy;

        // Formulario limpio: sin datos
        llenarEstados(false, "");
        el.origen.value = "";
        el.adultos.value = 0;
        el.ninos.value = 0;
        el.descuento.value = 0;
        el.comentarios.value = "";

        cargarClientes();
        cargarDisponibles();
        abrir();
    }

    function abrirEditar(reservacion) {
        if (!reservacion) return;

        el.formulario.reset();
        limpiarError();

        reservacionEnEdicion = reservacion;

        el.id.value = reservacion.id;
        el.titulo.textContent = `Editar reservación ${reservacion.codigo_reservacion}`;
        el.guardar.textContent = "Guardar cambios";

        el.entrada.removeAttribute("min");
        el.salida.removeAttribute("min");

        llenarEstados(true, String(reservacion.estado || "").toUpperCase());

        el.entrada.value = reservacion.fecha_entrada ?? "";
        el.salida.value = reservacion.fecha_salida ?? "";
        el.adultos.value = reservacion.adultos ?? 0;
        el.ninos.value = reservacion.ninos ?? 0;
        el.descuento.value = reservacion.descuento ?? 0;
        el.origen.value = reservacion.origen || "";
        el.comentarios.value = reservacion.comentarios ?? "";

        cargarClientes(reservacion.cliente_id);
        cargarDisponibles(reservacion.habitacion_id);
        abrir();
    }

    // =====================================================
    // VENTANA DE CONFIRMACIÓN
    // tipo: "peligro" (rojo, para cancelar) u "ok" (verde)
    // =====================================================

    function confirmar({ titulo, texto, textoBoton = "Confirmar", tipo = "peligro" }) {
        return new Promise(resolve => {
            if (resolverConfirmacion) resolverConfirmacion(false);
            resolverConfirmacion = resolve;

            const esOk = tipo === "ok";

            el.confirmTitulo.textContent = titulo;
            el.confirmTexto.textContent = texto;
            el.confirmSi.textContent = textoBoton;

            el.confirmacion.classList.toggle("res-confirm--ok", esOk);
            el.confirmSi.classList.toggle("res-btn-danger", !esOk);
            el.confirmSi.classList.toggle("res-btn-primary", esOk);

            el.confirmacion.classList.add("is-open");
            el.confirmacion.setAttribute("aria-hidden", "false");

            el.confirmNo.focus();
        });
    }

    function cerrarConfirmacion(resultado) {
        el.confirmacion.classList.remove("is-open");
        el.confirmacion.setAttribute("aria-hidden", "true");

        if (resolverConfirmacion) {
            resolverConfirmacion(resultado);
            resolverConfirmacion = null;
        }
    }

    // =====================================================
    // GUARDAR
    // =====================================================

    async function guardar(evento) {
        evento.preventDefault();

        if (guardando) return;

        limpiarError();

        const id = el.id.value;

        const clienteId = Number(el.cliente.value);
        const habitacionId = Number(el.habitacion.value);
        const adultos = Number(el.adultos.value);
        const ninos = Number(el.ninos.value || 0);
        const descuento = Number(el.descuento.value || 0);
        const estado = el.estado.value;
        const origen = el.origen.value;

        if (!Number.isInteger(clienteId) || clienteId <= 0) {
            mostrarError("Selecciona un huésped.");
            return;
        }

        if (!el.entrada.value || !el.salida.value) {
            mostrarError("Indica la fecha de entrada y la fecha de salida.");
            return;
        }

        if (el.salida.value <= el.entrada.value) {
            mostrarError("La fecha de salida debe ser posterior a la de entrada.");
            return;
        }

        if (!Number.isInteger(habitacionId) || habitacionId <= 0) {
            mostrarError("Selecciona una habitación disponible.");
            return;
        }

        if (!Number.isInteger(adultos) || adultos < 1) {
            mostrarError("Indica al menos un adulto.");
            return;
        }

        if (!Number.isInteger(ninos) || ninos < 0) {
            mostrarError("El número de niños no es válido.");
            return;
        }

        if (!estado) {
            mostrarError("Selecciona el estado de la reservación.");
            return;
        }

        if (!origen) {
            mostrarError("Selecciona el origen de la reservación.");
            return;
        }

        if (!Number.isFinite(descuento) || descuento < 0) {
            mostrarError("El descuento debe ser un número mayor o igual a cero.");
            return;
        }

        // Al editar se pide confirmación antes de guardar
        if (id) {
            const confirmado = await confirmar({
                titulo: "¿Guardar cambios?",
                texto: `Se actualizará la reservación ${reservacionEnEdicion?.codigo_reservacion ?? ""}.`,
                textoBoton: "Sí, guardar",
                tipo: "ok"
            });

            if (!confirmado) return;
        }

        const payload = {
            cliente_id: clienteId,
            habitacion_id: habitacionId,
            fecha_entrada: el.entrada.value,
            fecha_salida: el.salida.value,
            adultos,
            ninos,
            descuento,
            estado,
            origen,
            comentarios: el.comentarios.value.trim()
        };

        const url = id ? `${API}/${encodeURIComponent(id)}` : API;
        const metodo = id ? "PUT" : "POST";

        guardando = true;
        el.guardar.disabled = true;
        el.guardar.textContent = "Guardando...";

        try {
            const data = await obtenerJSON(url, {
                method: metodo,
                body: JSON.stringify(payload)
            });

            if (!data.success) {
                throw new Error(data.message || "No se pudo guardar la reservación.");
            }

            guardando = false;
            cerrar();

            await alGuardar(
                data.message ||
                (id ? "Reservación actualizada correctamente."
                    : "Reservación creada correctamente.")
            );

        } catch (error) {
            console.error("Error al guardar reservación:", error);
            mostrarError(error.message);

        } finally {
            guardando = false;
            el.guardar.disabled = false;
            el.guardar.textContent = el.id.value ? "Guardar cambios" : "Guardar reservación";
        }
    }

    // =====================================================
    // EVENTOS
    // =====================================================

    el.cancelar.addEventListener("click", cerrar);
    el.formulario.addEventListener("submit", guardar);

    el.entrada.addEventListener("change", () => {
        if (el.entrada.value) el.salida.min = el.entrada.value;
        cargarDisponibles(el.habitacion.value);
    });

    el.salida.addEventListener("change", () => {
        cargarDisponibles(el.habitacion.value);
    });

    el.habitacion.addEventListener("change", actualizarResumen);
    el.descuento.addEventListener("input", actualizarResumen);

    // Cerrar al pulsar fuera de la ventana
    el.modal.addEventListener("click", evento => {
        if (evento.target === el.modal) cerrar();
    });

    el.confirmSi.addEventListener("click", () => cerrarConfirmacion(true));
    el.confirmNo.addEventListener("click", () => cerrarConfirmacion(false));

    el.confirmacion.addEventListener("click", evento => {
        if (evento.target === el.confirmacion) cerrarConfirmacion(false);
    });

    document.addEventListener("keydown", evento => {
        if (evento.key !== "Escape") return;

        // Si la confirmación está abierta, Escape solo cierra esa ventana
        if (el.confirmacion.classList.contains("is-open")) {
            cerrarConfirmacion(false);
            return;
        }

        if (el.modal.classList.contains("is-open")) {
            cerrar();
        }
    });

    // =====================================================
    // API PÚBLICA
    // =====================================================

    window.ReservacionModal = {
        configurar(opciones = {}) {
            if (typeof opciones.alGuardar === "function") {
                alGuardar = opciones.alGuardar;
            }
        },
        cargarClientes,
        abrirCrear,
        abrirEditar,
        confirmar
    };

})();