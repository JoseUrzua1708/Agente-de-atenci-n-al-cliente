(() => {
    "use strict";

    const API_HABITACIONES = "/admin/habitaciones/api";
    const API_TIPOS = "/admin/habitaciones/tipos";

    let tiposHabitacionData = [];
    let habitacionesData = [];
    let guardando = false;
    let paginaActual = 1;

    const $ = (id) => document.getElementById(id);

    const elementos = {
        tabla: $("tablaHabitaciones"),
        modal: $("modalHabitacion"),
        formulario: $("formHabitacion"),
        tipo: $("tipoId"),
        numero: $("numero"),
        piso: $("piso"),
        precio: $("precio"),
        estado: $("estado"),
        descripcion: $("descripcion"),
        id: $("habitacionId"),
        titulo: $("modalTitulo"),
        botonGuardar: $("btnGuardarHabitacion"),
        mensaje: $("habMensaje"),
        errorFormulario: $("habErrorFormulario"),
        busqueda: $("buscarHabitacion"),

        // Elementos nuevos de paginación.
        registros: $("habRegistrosPorPagina"),
        anterior: $("habPaginaAnterior"),
        siguiente: $("habPaginaSiguiente"),
        pagina: $("habPaginaActual"),
        contador: $("contadorHabitaciones")
    };

    function escaparHTML(valor) {
        return String(valor ?? "").replace(/[&<>"']/g, caracter => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[caracter]);
    }

    function normalizarEstado(estado) {
        return String(estado ?? "").trim().toUpperCase();
    }

    function mostrarMensaje(texto, tipo = "success") {
        if (!elementos.mensaje) return;

        elementos.mensaje.textContent = texto;

        elementos.mensaje.className =
            "hab-message is-visible " +
            (tipo === "error"
                ? "hab-message-error"
                : "hab-message-success");

        elementos.mensaje.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });
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
                ...(opciones.body
                    ? { "Content-Type": "application/json" }
                    : {}),
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
            throw new Error(
                data.message ||
                data.mensaje ||
                `Error del servidor (HTTP ${respuesta.status}).`
            );
        }

        return data;
    }

    function mostrarCarga(texto) {
        elementos.tabla.innerHTML = `
            <tr>
                <td colspan="7" class="hab-empty">
                    <span class="hab-loading-spinner"
                          aria-hidden="true"></span>
                    <strong>${escaparHTML(texto)}</strong>
                </td>
            </tr>
        `;
    }

    function actualizarResumen() {
        const total = habitacionesData.length;

        const disponibles = habitacionesData.filter(
            h => normalizarEstado(h.estado) === "DISPONIBLE"
        ).length;

        $("totalHabitaciones").textContent = total;
        $("habitacionesDisponibles").textContent = disponibles;
        $("habitacionesNoDisponibles").textContent =
            total - disponibles;
    }

    function obtenerClaseEstado(estado) {
        const valor = normalizarEstado(estado).toLowerCase();

        const permitidos = [
            "disponible",
            "reservada",
            "ocupada",
            "limpieza",
            "mantenimiento",
            "inactiva"
        ];

        return permitidos.includes(valor)
            ? `hab-badge-${valor}`
            : "hab-badge-inactiva";
    }

    function obtenerIconoAccion(accion) {
        if (accion === "editar") {
            return `
                <svg viewBox="0 0 24 24"
                     fill="none"
                     aria-hidden="true">
                    <path
                        d="m14 6 4 4M4 20l4.2-.8L19 8.4a2.1 2.1 0 0 0-3-3L5.2 16.2 4 20Z"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linecap="round"
                        stroke-linejoin="round"/>
                </svg>
            `;
        }

        return `
            <svg viewBox="0 0 24 24"
                 fill="none"
                 aria-hidden="true">
                <path
                    d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"/>
            </svg>
        `;
    }

    function renderizarHabitaciones() {
        const busqueda = elementos.busqueda
            ? elementos.busqueda.value
                .trim()
                .toLocaleLowerCase("es-MX")
            : "";

        const filtradas = habitacionesData.filter(h => {
            const texto = [
                h.numero,
                h.piso,
                h.tipo,
                h.estado,
                h.descripcion,
                h.precio
            ].join(" ").toLocaleLowerCase("es-MX");

            return texto.includes(busqueda);
        });

        actualizarResumen();

        const selectorExiste = Boolean(elementos.registros);
        const valorSelector = selectorExiste
            ? elementos.registros.value
            : "todos";

        const mostrarTodos = valorSelector === "todos";
        const cantidad = mostrarTodos
            ? filtradas.length || 1
            : Math.max(1, Number(valorSelector) || 5);

        const totalPaginas = mostrarTodos
            ? 1
            : Math.max(1, Math.ceil(filtradas.length / cantidad));

        // Evita permanecer en una página que ya no existe.
        paginaActual = Math.max(
            1,
            Math.min(paginaActual, totalPaginas)
        );

        const inicio = mostrarTodos
            ? 0
            : (paginaActual - 1) * cantidad;

        const visibles = mostrarTodos
            ? filtradas
            : filtradas.slice(inicio, inicio + cantidad);

        const desde = filtradas.length > 0 ? inicio + 1 : 0;

        const hasta = mostrarTodos
            ? filtradas.length
            : Math.min(inicio + cantidad, filtradas.length);

        if (elementos.contador) {
            elementos.contador.textContent =
                `Mostrando ${desde}–${hasta} de ${filtradas.length} resultados` +
                (busqueda
                    ? ` (de ${habitacionesData.length} habitaciones)`
                    : "");
        }

        if (elementos.pagina) {
            elementos.pagina.textContent =
                `${paginaActual} / ${totalPaginas}`;
        }

        if (elementos.anterior) {
            elementos.anterior.disabled = paginaActual <= 1;
        }

        if (elementos.siguiente) {
            elementos.siguiente.disabled =
                paginaActual >= totalPaginas;
        }

        if (filtradas.length === 0) {
            mostrarCarga(
                habitacionesData.length === 0
                    ? "No hay habitaciones registradas."
                    : "No se encontraron habitaciones con esa búsqueda."
            );
            return;
        }

        elementos.tabla.innerHTML = visibles.map((h, indice) => {
            const estado = normalizarEstado(h.estado);
            const id = Number(h.id);

            if (!Number.isSafeInteger(id) || id < 0) {
                return "";
            }

            const precio = Number(h.precio);

            const precioTexto = h.precio !== null &&
                h.precio !== undefined &&
                h.precio !== "" &&
                Number.isFinite(precio)
                ? precio.toLocaleString("es-MX", {
                    style: "currency",
                    currency: "MXN"
                })
                : "No disponible";

            return `
                <tr style="--fila-index:${indice}">
                    <td>
                        <span class="hab-room-number">
                            ${escaparHTML(h.numero)}
                        </span>
                    </td>

                    <td>${escaparHTML(h.piso)}</td>

                    <td>${escaparHTML(h.tipo)}</td>

                    <td class="hab-price">
                        ${escaparHTML(precioTexto)}
                    </td>

                    <td>
                        <span class="hab-badge ${obtenerClaseEstado(estado)}">
                            ${escaparHTML(estado || "SIN ESTADO")}
                        </span>
                    </td>

                    <td>
                        <span class="hab-room-description">
                            ${escaparHTML(h.descripcion || "Sin descripción")}
                        </span>
                    </td>

                    <td>
                        <div class="hab-actions">
                            <button
                                type="button"
                                class="hab-btn hab-btn-edit hab-icon-btn"
                                data-accion="editar"
                                data-id="${id}"
                                title="Editar habitación"
                                aria-label="Editar habitación ${escaparHTML(h.numero)}"
                            >
                                ${obtenerIconoAccion("editar")}
                                <span>Editar</span>
                            </button>

                            ${estado !== "INACTIVA" ? `
                                <button
                                    type="button"
                                    class="hab-btn hab-btn-danger hab-icon-btn"
                                    data-accion="inactivar"
                                    data-id="${id}"
                                    title="Inactivar habitación"
                                    aria-label="Inactivar habitación ${escaparHTML(h.numero)}"
                                >
                                    ${obtenerIconoAccion("inactivar")}
                                    <span>Inactivar</span>
                                </button>
                            ` : ""}
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

        if (!elementos.tabla.innerHTML.trim()) {
            mostrarCarga(
                "No se pudieron mostrar los registros recibidos."
            );
        }
    }

    async function cargarTipos() {
        elementos.tipo.innerHTML =
            '<option value="">Cargando tipos...</option>';

        try {
            const data = await obtenerJSON(API_TIPOS);

            if (!data.success || !Array.isArray(data.tipos)) {
                throw new Error(
                    data.message ||
                    "No se pudieron obtener los tipos de habitación."
                );
            }

            tiposHabitacionData = data.tipos;

            elementos.tipo.innerHTML =
                '<option value="">Seleccione un tipo...</option>';

            tiposHabitacionData.forEach(t => {
                const opcion = document.createElement("option");

                opcion.value = String(t.id);
                opcion.textContent =
                    `${t.nombre} (Base: $${t.precio_base})`;

                opcion.dataset.precio =
                    String(t.precio_base ?? "");

                elementos.tipo.appendChild(opcion);
            });

        } catch (error) {
            console.error(
                "Error al cargar tipos de habitación:",
                error
            );

            elementos.tipo.innerHTML =
                '<option value="">No se pudieron cargar los tipos</option>';

            mostrarMensaje(
                "No se pudieron cargar los tipos de habitación. Revisa la ruta de la API.",
                "error"
            );
        }
    }

    async function cargarHabitaciones() {
        mostrarCarga("Cargando habitaciones...");

        try {
            const data = await obtenerJSON(API_HABITACIONES);

            if (!data.success || !Array.isArray(data.habitaciones)) {
                throw new Error(
                    data.message ||
                    "La respuesta no contiene la lista de habitaciones."
                );
            }

            habitacionesData = data.habitaciones;

            renderizarHabitaciones();

        } catch (error) {
            console.error(
                "Error al cargar habitaciones:",
                error
            );

            habitacionesData = [];
            actualizarResumen();

            if (elementos.contador) {
                elementos.contador.textContent =
                    "No se pudieron cargar los registros.";
            }

            if (elementos.pagina) {
                elementos.pagina.textContent = "1 / 1";
            }

            if (elementos.anterior) {
                elementos.anterior.disabled = true;
            }

            if (elementos.siguiente) {
                elementos.siguiente.disabled = true;
            }

            mostrarCarga(
                "Error al cargar habitaciones. Revisa la consola y la ruta de la API."
            );

            mostrarMensaje(error.message, "error");
        }
    }

    function actualizarPrecioBase() {
        const opcion = elementos.tipo.selectedOptions[0];

        if (!opcion || !opcion.dataset.precio) {
            return;
        }

        // Al editar no se sobrescribe el precio guardado.
        if (!elementos.id.value) {
            elementos.precio.value = opcion.dataset.precio;
        }
    }

    function abrirModalCrear() {
        elementos.formulario.reset();

        elementos.id.value = "";
        elementos.titulo.textContent = "Nueva habitación";
        elementos.botonGuardar.textContent = "Guardar habitación";

        limpiarErrorFormulario();
        ocultarMensaje();

        elementos.estado.value = "DISPONIBLE";

        elementos.modal.classList.add("is-open");
        elementos.modal.setAttribute("aria-hidden", "false");

        document.body.style.overflow = "hidden";

        elementos.numero.focus();
    }

    function prepararEditar(id) {
        const habitacion = habitacionesData.find(
            h => Number(h.id) === Number(id)
        );

        if (!habitacion) {
            mostrarMensaje(
                "No se encontró la habitación seleccionada.",
                "error"
            );
            return;
        }

        elementos.formulario.reset();

        limpiarErrorFormulario();
        ocultarMensaje();

        elementos.id.value = habitacion.id;
        elementos.tipo.value = String(habitacion.tipo_id ?? "");
        elementos.numero.value = habitacion.numero ?? "";
        elementos.piso.value = habitacion.piso ?? "";
        elementos.precio.value = habitacion.precio ?? "";
        elementos.estado.value = normalizarEstado(habitacion.estado);
        elementos.descripcion.value = habitacion.descripcion ?? "";

        elementos.titulo.textContent =
            `Editar habitación ${habitacion.numero}`;

        elementos.botonGuardar.textContent = "Guardar cambios";

        elementos.modal.classList.add("is-open");
        elementos.modal.setAttribute("aria-hidden", "false");

        document.body.style.overflow = "hidden";

        elementos.numero.focus();
    }

    function cerrarModal() {
        if (guardando) return;

        elementos.modal.classList.remove("is-open");
        elementos.modal.setAttribute("aria-hidden", "true");

        document.body.style.overflow = "";

        limpiarErrorFormulario();
    }

    async function guardarHabitacion(evento) {
        evento.preventDefault();

        if (guardando) return;

        limpiarErrorFormulario();

        const id = elementos.id.value;

        const tipoId = Number(elementos.tipo.value);
        const piso = Number(elementos.piso.value);
        const precio = Number(elementos.precio.value);

        const numero = elementos.numero.value.trim();

        if (!elementos.formulario.reportValidity()) {
            return;
        }

        if (!Number.isInteger(tipoId) || tipoId <= 0) {
            mostrarErrorFormulario(
                "Selecciona un tipo de habitación válido."
            );
            return;
        }

        if (!numero) {
            mostrarErrorFormulario(
                "El número de habitación es obligatorio."
            );
            return;
        }

        if (!Number.isInteger(piso) || piso < 1) {
            mostrarErrorFormulario(
                "El piso debe ser un número entero mayor que cero."
            );
            return;
        }

        if (!Number.isFinite(precio) || precio < 0) {
            mostrarErrorFormulario(
                "Introduce un precio válido."
            );
            return;
        }

        const payload = {
            tipo_id: tipoId,
            numero: numero,
            piso: piso,
            precio: precio,
            estado: elementos.estado.value,
            descripcion: elementos.descripcion.value.trim()
        };

        const url = id
            ? `${API_HABITACIONES}/${encodeURIComponent(id)}`
            : API_HABITACIONES;

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
                throw new Error(
                    data.message ||
                    "No se pudo guardar la habitación."
                );
            }

            cerrarModal();

            mostrarMensaje(
                data.message ||
                "La habitación se guardó correctamente."
            );

            // Tras guardar, volver a la primera página
            // facilita localizar el resultado actualizado.
            paginaActual = 1;

            await cargarHabitaciones();

        } catch (error) {
            console.error(
                "Error al guardar habitación:",
                error
            );

            mostrarErrorFormulario(error.message);

        } finally {
            guardando = false;

            elementos.botonGuardar.disabled = false;

            elementos.botonGuardar.textContent =
                elementos.id.value
                    ? "Guardar cambios"
                    : "Guardar habitación";
        }
    }

    async function desactivarHabitacion(id) {
        const habitacion = habitacionesData.find(
            h => Number(h.id) === Number(id)
        );

        if (!habitacion) {
            mostrarMensaje(
                "No se encontró la habitación seleccionada.",
                "error"
            );
            return;
        }

        const confirmado = window.confirm(
            `¿Deseas inactivar la habitación ${habitacion.numero}? ` +
            "Se conservará su historial."
        );

        if (!confirmado) return;

        try {
            const data = await obtenerJSON(
                `${API_HABITACIONES}/${encodeURIComponent(id)}/inactivar`,
                { method: "PATCH" }
            );

            if (!data.success) {
                throw new Error(
                    data.message ||
                    "No se pudo inactivar la habitación."
                );
            }

            mostrarMensaje(
                data.message ||
                "La habitación se inactivó correctamente."
            );

            await cargarHabitaciones();

        } catch (error) {
            console.error(
                "Error al inactivar habitación:",
                error
            );

            mostrarMensaje(error.message, "error");
        }
    }

    // =====================================================
    // EVENTOS DE LA INTERFAZ
    // =====================================================

    $("btnNuevaHabitacion").addEventListener(
        "click",
        abrirModalCrear
    );

    $("btnCerrarModal").addEventListener(
        "click",
        cerrarModal
    );

    $("btnCancelarModal").addEventListener(
        "click",
        cerrarModal
    );

    elementos.tipo.addEventListener(
        "change",
        actualizarPrecioBase
    );

    elementos.formulario.addEventListener(
        "submit",
        guardarHabitacion
    );

    // Al buscar, volver a la primera página.
    elementos.busqueda.addEventListener("input", () => {
        paginaActual = 1;
        renderizarHabitaciones();
    });

    // Cambiar cantidad de registros por página.
    if (elementos.registros) {
        elementos.registros.addEventListener("change", () => {
            paginaActual = 1;
            renderizarHabitaciones();
        });
    }

    // Página anterior.
    if (elementos.anterior) {
        elementos.anterior.addEventListener("click", () => {
            if (paginaActual > 1) {
                paginaActual--;
                renderizarHabitaciones();
            }
        });
    }

    // Página siguiente.
    if (elementos.siguiente) {
        elementos.siguiente.addEventListener("click", () => {
            paginaActual++;
            renderizarHabitaciones();
        });
    }

    // Acciones delegadas de la tabla.
    elementos.tabla.addEventListener("click", evento => {
        const boton = evento.target.closest(
            "button[data-accion]"
        );

        if (!boton) return;

        const id = Number(boton.dataset.id);

        if (!Number.isSafeInteger(id)) return;

        if (boton.dataset.accion === "editar") {
            prepararEditar(id);
        }

        if (boton.dataset.accion === "inactivar") {
            desactivarHabitacion(id);
        }
    });

    // Cerrar al pulsar fuera del diálogo.
    elementos.modal.addEventListener("click", evento => {
        if (evento.target === elementos.modal) {
            cerrarModal();
        }
    });

    // Cerrar con Escape.
    document.addEventListener("keydown", evento => {
        if (
            evento.key === "Escape" &&
            elementos.modal.classList.contains("is-open")
        ) {
            cerrarModal();
        }
    });

    // =====================================================
    // CARGA INICIAL: SE EJECUTA UNA SOLA VEZ
    // =====================================================

    async function iniciar() {
        await Promise.all([
            cargarTipos(),
            cargarHabitaciones()
        ]);
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            iniciar,
            { once: true }
        );
    } else {
        iniciar();
    }

})();
