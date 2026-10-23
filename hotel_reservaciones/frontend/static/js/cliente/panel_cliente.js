
/* MAISON - Panel del cliente */
(() => {
    "use strict";

    const API = {
        habitaciones: "/cliente/api/habitaciones",
        reservaciones: "/cliente/api/reservaciones",
        perfil: "/cliente/api/perfil"
    };

    const $ = selector => document.querySelector(selector);

    const money = value => new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN"
    }).format(Number(value || 0));

    const escapeHTML = value => String(value ?? "").replace(
        /[&<>"']/g,
        char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]
    );

    const dateText = value => {
        if (!value) return "Por definir";

        const date = new Date(`${value}T12:00:00`);

        return Number.isNaN(date.getTime())
            ? value
            : date.toLocaleDateString("es-MX", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            });
    };

    let habitaciones = [];
    let reservaciones = [];
    let habitacionSeleccionada = null;
    let toastTimer;

    async function api(url, options = {}) {
        const response = await fetch(url, {
            credentials: "same-origin",
            ...options,
            headers: {
                "Accept": "application/json",
                ...(options.body
                    ? { "Content-Type": "application/json" }
                    : {}),
                ...(options.headers || {})
            }
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.error || data.mensaje || data.message || `Error ${response.status}`
            );
        }

        return data;
    }

    function toast(message) {
        const node = $("#toast");
        if (!node) return;

        node.textContent = message;
        node.classList.add("show");

        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            node.classList.remove("show");
        }, 3500);
    }

    function showSection(id) {
        const section = document.getElementById(id);
        if (!section) return;

        document.querySelectorAll(".page-section").forEach(item => {
            item.classList.toggle("hidden", item.id !== id);
        });

        document.querySelectorAll(".nav-link[data-section]").forEach(link => {
            link.classList.toggle("active", link.dataset.section === id);
        });

        $("#sidebar")?.classList.remove("open");

        history.replaceState(null, "", `#${id}`);
        window.scrollTo({ top: 0, behavior: "smooth" });

        if (id === "habitaciones") cargarHabitaciones();
        if (id === "reservaciones") cargarReservaciones();
        if (id === "perfil") cargarPerfil();
    }

    function renderHabitaciones(items) {
        const container = $("#listaHabitaciones");
        $("#contadorHabitaciones").textContent =
            `${items.length} resultado(s)`;

        if (!items.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">▣</span>
                    <strong>No encontramos habitaciones disponibles</strong>
                    <p>Prueba con otras fechas o revisa más tarde.</p>
                </div>`;
            return;
        }

        container.innerHTML = items.map(h => {
            const id = Number(h.id);
            const nombre = h.tipo || h.nombre_tipo ||
                h.tipo_habitacion || "Habitación";
            const precio = Number(h.precio ?? h.precio_base ?? 0);
            const capacidad = Number(h.capacidad_adultos || 1) +
                Number(h.capacidad_ninos || 0);

            return `
                <article class="room-card">
                    <div class="room-image" aria-hidden="true">⌂</div>

                    <div class="room-body">
                        <h3>${escapeHTML(nombre)}</h3>
                        <p>${escapeHTML(
                            h.descripcion ||
                            "Un espacio cómodo para disfrutar tu estancia."
                        )}</p>

                        <div class="room-meta">
                            Habitación ${escapeHTML(h.numero || "—")}
                            · Piso ${escapeHTML(h.piso ?? "—")}
                            · Hasta ${capacidad} huésped(es)
                        </div>

                        <p>${escapeHTML(
                            h.amenidades || "Consulta las amenidades en recepción."
                        )}</p>

                        <div class="room-price">
                            ${money(precio)} <small>/ noche</small>
                        </div>

                        <button
                            type="button"
                            class="button button-dark js-reservar"
                            data-id="${id}"
                            data-precio="${precio}"
                            data-nombre="${escapeHTML(nombre)}"
                            data-numero="${escapeHTML(h.numero || "")}"
                        >
                            Elegir habitación
                        </button>
                    </div>
                </article>`;
        }).join("");
    }

    async function cargarHabitaciones() {
        const container = $("#listaHabitaciones");
        container.innerHTML = `
            <div class="empty-state"><p>Consultando disponibilidad...</p></div>`;

        try {
            const params = new URLSearchParams();

            if ($("#fechaEntrada").value) {
                params.set("entrada", $("#fechaEntrada").value);
            }

            if ($("#fechaSalida").value) {
                params.set("salida", $("#fechaSalida").value);
            }

            if ($("#huespedes").value) {
                params.set("huespedes", $("#huespedes").value);
            }

            const data = await api(
                `${API.habitaciones}?${params.toString()}`
            );

            habitaciones = Array.isArray(data)
                ? data
                : (data.habitaciones || []);

            renderHabitaciones(habitaciones);
            $("#totalHabitaciones").textContent = habitaciones.length;

        } catch (error) {
            container.innerHTML = `
                <div class="empty-state">
                    <strong>No se pudieron cargar las habitaciones</strong>
                    <p>${escapeHTML(error.message)}</p>
                </div>`;

            $("#totalHabitaciones").textContent = "—";
        }
    }

    function renderReservaciones(items) {
        const container = $("#listaReservaciones");

        if (!items.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">▦</span>
                    <strong>Todavía no tienes reservaciones</strong>
                    <p>Cuando envíes una solicitud, aparecerá aquí.</p>
                    <a class="text-link" href="#habitaciones"
                       data-ir-seccion="habitaciones">
                        Explorar habitaciones →
                    </a>
                </div>`;
            return;
        }

        container.innerHTML = items.map(r => {
            const estado = String(r.estado || "PENDIENTE").toUpperCase();

            return `
                <article class="reservation-card">
                    <div>
                        <h3>${escapeHTML(
                            r.tipo_habitacion || r.tipo || "Estancia MAISON"
                        )}</h3>
                        <p>
                            Código: ${escapeHTML(r.codigo_reservacion || "—")}
                            <br>
                            Habitación: ${escapeHTML(
                                r.habitacion || r.numero_habitacion || "—"
                            )}
                        </p>
                    </div>

                    <div>
                        <p>
                            Entrada: ${dateText(r.fecha_entrada)}
                            <br>
                            Salida: ${dateText(r.fecha_salida)}
                        </p>
                        <p>
                            <span class="status ${estado.toLowerCase()}">
                                ${escapeHTML(estado.replaceAll("_", " "))}
                            </span>
                        </p>
                    </div>

                    <div class="reservation-total">
                        ${money(r.total)}
                        <p>Total de estancia</p>
                    </div>
                </article>`;
        }).join("");
    }

    async function cargarReservaciones() {
        $("#listaReservaciones").innerHTML = `
            <div class="empty-state"><p>Cargando reservaciones...</p></div>`;

        try {
            const data = await api(API.reservaciones);

            reservaciones = Array.isArray(data)
                ? data
                : (data.reservaciones || []);

            renderReservaciones(reservaciones);

            const activas = reservaciones.filter(r =>
                ["PENDIENTE", "CONFIRMADA", "CHECK_IN"].includes(
                    String(r.estado || "").toUpperCase()
                )
            );

            $("#totalReservaciones").textContent = activas.length;

            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);

            const futuras = activas
                .filter(r => r.fecha_entrada)
                .filter(r => new Date(`${r.fecha_entrada}T12:00:00`) >= hoy)
                .sort((a, b) =>
                    a.fecha_entrada.localeCompare(b.fecha_entrada)
                );

            const proxima = futuras[0];

            $("#proximaLlegada").textContent = proxima
                ? dateText(proxima.fecha_entrada)
                : "Sin viajes";

            $("#proximaReserva").innerHTML = proxima
                ? `
                    <article class="reservation-card">
                        <div>
                            <h3>${escapeHTML(
                                proxima.tipo_habitacion || "Tu estancia MAISON"
                            )}</h3>
                            <p>Código: ${escapeHTML(
                                proxima.codigo_reservacion || "—"
                            )}</p>
                        </div>
                        <div>
                            <p>
                                Entrada: ${dateText(proxima.fecha_entrada)}
                                <br>
                                Salida: ${dateText(proxima.fecha_salida)}
                            </p>
                            <span class="status ${
                                String(proxima.estado).toLowerCase()
                            }">${escapeHTML(proxima.estado)}</span>
                        </div>
                        <div class="reservation-total">
                            ${money(proxima.total)}
                            <p>Total de estancia</p>
                        </div>
                    </article>`
                : `
                    <div class="empty-state">
                        <strong>No tienes una próxima estancia</strong>
                        <p>Tus solicitudes aparecerán aquí.</p>
                    </div>`;

        } catch (error) {
            $("#listaReservaciones").innerHTML = `
                <div class="empty-state">
                    <strong>No se pudieron cargar tus reservaciones</strong>
                    <p>${escapeHTML(error.message)}</p>
                </div>`;
        }
    }

    async function cargarPerfil() {
        try {
            const perfil = await api(API.perfil);

            const nombre = [
                perfil.nombre,
                perfil.apellidos
            ].filter(Boolean).join(" ") || "Mi cuenta";

            const iniciales = nombre
                .split(/\s+/)
                .slice(0, 2)
                .map(parte => parte[0])
                .join("")
                .toUpperCase();

            $("#nombreUsuario").textContent = nombre;
            $("#perfilNombre").textContent = nombre;
            $("#perfilEmail").textContent =
                perfil.email || "Correo no disponible";
            $("#avatarIniciales").textContent = iniciales;
            $("#perfilIniciales").textContent = iniciales;

        } catch (error) {
            $("#perfilNombre").textContent = "No se pudo cargar el perfil";
            $("#perfilEmail").textContent = error.message;
        }
    }

    function abrirReserva(habitacion) {
        habitacionSeleccionada = habitacion;

        $("#resumenHabitacion").textContent =
            `${habitacion.nombre} · Habitación ${habitacion.numero || "—"} · ` +
            `${money(habitacion.precio)} por noche`;

        $("#reservaEntrada").value = $("#fechaEntrada").value;
        $("#reservaSalida").value = $("#fechaSalida").value;
        $("#reservaHuespedes").value = $("#huespedes").value || 1;
        $("#reservaComentarios").value = "";

        calcularTotal();
        $("#dialogReserva").showModal();
    }

    function calcularTotal() {
        if (!habitacionSeleccionada) return;

        const entradaTexto = $("#reservaEntrada").value;
        const salidaTexto = $("#reservaSalida").value;

        if (!entradaTexto || !salidaTexto) {
            $("#totalEstimado").textContent = "Selecciona fechas";
            return;
        }

        const entrada = new Date(`${entradaTexto}T12:00:00`);
        const salida = new Date(`${salidaTexto}T12:00:00`);
        const noches = Math.round((salida - entrada) / 86400000);

        $("#totalEstimado").textContent = noches > 0
            ? `${noches} noche(s) · ${money(
                noches * habitacionSeleccionada.precio
            )}`
            : "La salida debe ser posterior a la entrada";
    }

    async function solicitarReserva(event) {
        event.preventDefault();

        if (!habitacionSeleccionada) {
            toast("Selecciona primero una habitación.");
            return;
        }

        const entrada = $("#reservaEntrada").value;
        const salida = $("#reservaSalida").value;
        const huespedes = Number($("#reservaHuespedes").value);

        if (!entrada || !salida || salida <= entrada) {
            toast("La salida debe ser posterior a la entrada.");
            return;
        }

        if (!Number.isInteger(huespedes) || huespedes < 1 || huespedes > 20) {
            toast("Indica un número válido de huéspedes.");
            return;
        }

        const boton = $("#formReserva").querySelector(
            'button[type="submit"]'
        );

        boton.disabled = true;
        boton.textContent = "Enviando solicitud...";

        const body = {
            habitacion_id: habitacionSeleccionada.id,
            fecha_entrada: entrada,
            fecha_salida: salida,
            numero_huespedes: huespedes,
            adultos: huespedes,
            ninos: 0,
            comentarios: $("#reservaComentarios").value.trim()
        };

        try {
            const result = await api(API.reservaciones, {
                method: "POST",
                body: JSON.stringify(body)
            });

            $("#dialogReserva").close();

            toast(
                result.mensaje ||
                result.message ||
                "Tu solicitud de reservación fue registrada."
            );

            await cargarReservaciones();
            showSection("reservaciones");

        } catch (error) {
            toast(error.message || "No se pudo registrar la solicitud.");
        } finally {
            boton.disabled = false;
            boton.textContent = "Enviar solicitud";
        }
    }

    // Navegación del menú.
    document.querySelectorAll(".nav-link[data-section]").forEach(link => {
        link.addEventListener("click", event => {
            event.preventDefault();
            showSection(link.dataset.section);
        });
    });

    // Navegación desde botones y enlaces del contenido.
    
document.addEventListener("click", event => {
    const enlace = event.target.closest("[data-ir-seccion]");

    if (!enlace) return;

    event.preventDefault();

    const seccion = enlace.dataset.irSeccion;

    if (seccion) {
        showSection(seccion);
    }
    });

    

    $("#mobileMenu").addEventListener("click", () => {
        $("#sidebar").classList.toggle("open");
    });

    $("#formBusqueda").addEventListener("submit", event => {
        event.preventDefault();

        const entrada = $("#fechaEntrada").value;
        const salida = $("#fechaSalida").value;

        if (!entrada || !salida || salida <= entrada) {
            toast("Selecciona fechas válidas para tu estancia.");
            return;
        }

        cargarHabitaciones();
    });

    $("#listaHabitaciones").addEventListener("click", event => {
        const boton = event.target.closest(".js-reservar");
        if (!boton) return;

        const entrada = $("#fechaEntrada").value;
        const salida = $("#fechaSalida").value;

        if (!entrada || !salida || salida <= entrada) {
            toast("Primero selecciona fechas válidas en la búsqueda.");
            return;
        }

        abrirReserva({
            id: Number(boton.dataset.id),
            precio: Number(boton.dataset.precio),
            nombre: boton.dataset.nombre,
            numero: boton.dataset.numero
        });
    });

    $("#cerrarDialogo").addEventListener("click", () => {
        $("#dialogReserva").close();
    });

    $("#reservaEntrada").addEventListener("change", calcularTotal);
    $("#reservaSalida").addEventListener("change", calcularTotal);
    $("#reservaHuespedes").addEventListener("change", calcularTotal);
    $("#formReserva").addEventListener("submit", solicitarReserva);

    // Fecha mínima: hoy.
    const hoy = new Date();
    const fechaLocal = [
        hoy.getFullYear(),
        String(hoy.getMonth() + 1).padStart(2, "0"),
        String(hoy.getDate()).padStart(2, "0")
    ].join("-");

    $("#fechaEntrada").min = fechaLocal;
    $("#fechaSalida").min = fechaLocal;
    $("#reservaEntrada").min = fechaLocal;
    $("#reservaSalida").min = fechaLocal;

    // Abrir la sección indicada en la URL, si existe.
    const seccionInicial = location.hash.slice(1);
    const seccionesValidas = [
        "inicio", "habitaciones", "reservaciones", "perfil", "ayuda"
    ];

    showSection(
        seccionesValidas.includes(seccionInicial)
            ? seccionInicial
            : "inicio"
    );

    cargarReservaciones();
    cargarPerfil();
})();
