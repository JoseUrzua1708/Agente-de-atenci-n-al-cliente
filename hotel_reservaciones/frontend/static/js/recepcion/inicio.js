// Fecha del día (solo en el inicio) y año del pie de página
const fechaActual = document.getElementById("currentDate");
if (fechaActual) {
    fechaActual.textContent = new Date().toLocaleDateString("es-MX", {
        weekday: "long", day: "numeric", month: "long"
    });
}
document.getElementById("footerYear").textContent = new Date().getFullYear();

// Los avisos se ocultan solos
document.querySelectorAll(".alerta").forEach((alerta) => setTimeout(() => alerta.remove(), 4000));

// Menú lateral en móvil
const sidebar = document.getElementById("sidebar");
const backdrop = document.getElementById("sidebarBackdrop");
const menuButton = document.getElementById("mobileMenuButton");

function toggleMenu(abrir) {
    sidebar.classList.toggle("open", abrir);
    backdrop.classList.toggle("visible", abrir);
    menuButton.setAttribute("aria-expanded", String(abrir));
}

menuButton.addEventListener("click", () => toggleMenu(!sidebar.classList.contains("open")));
backdrop.addEventListener("click", () => toggleMenu(false));

const reservacionDialog = document.getElementById("dlgReservacionRecepcion");
if (reservacionDialog) {
    const reservacionForm = document.getElementById("formReservacionRecepcion");
    const clienteSelect = document.getElementById("clienteReservacionRecepcion");
    const entradaInput = document.getElementById("entradaReservacionRecepcion");
    const salidaInput = document.getElementById("salidaReservacionRecepcion");
    const habitacionSelect = document.getElementById("habitacionReservacionRecepcion");
    const errorReservacion = document.getElementById("errorReservacionRecepcion");
    const botonGuardar = document.getElementById("guardarReservacionRecepcion");
    const mensajeReservacion = document.getElementById("mensajeReservacionRecepcion");
    let consultaDisponibilidad = 0;

    function fechaLocal(fecha) {
        return [
            fecha.getFullYear(),
            String(fecha.getMonth() + 1).padStart(2, "0"),
            String(fecha.getDate()).padStart(2, "0")
        ].join("-");
    }

    async function apiRecepcion(url, opciones = {}) {
        const respuesta = await fetch(url, {
            credentials: "same-origin",
            ...opciones,
            headers: {
                Accept: "application/json",
                ...(opciones.body ? { "Content-Type": "application/json" } : {})
            }
        });
        const datos = await respuesta.json().catch(() => ({}));
        if (!respuesta.ok || !datos.success) {
            throw new Error(datos.message || `Error del servidor (HTTP ${respuesta.status}).`);
        }
        return datos;
    }

    async function cargarClientesRecepcion() {
        clienteSelect.disabled = true;
        clienteSelect.innerHTML = '<option value="">Cargando huéspedes...</option>';
        try {
            const datos = await apiRecepcion("/recepcion/reservaciones/clientes");
            clienteSelect.innerHTML = datos.clientes.length
                ? '<option value="">Selecciona un huésped...</option>'
                : '<option value="">No hay huéspedes registrados</option>';
            datos.clientes.forEach(cliente => {
                const opcion = document.createElement("option");
                opcion.value = String(cliente.id);
                opcion.textContent = `${cliente.nombre} · ${cliente.email}`;
                clienteSelect.append(opcion);
            });
            clienteSelect.disabled = datos.clientes.length === 0;
        } catch (error) {
            clienteSelect.innerHTML = '<option value="">No se pudieron cargar huéspedes</option>';
            errorReservacion.textContent = error.message;
        }
    }

    async function cargarHabitacionesRecepcion() {
        const entrada = entradaInput.value;
        const salida = salidaInput.value;
        const consulta = ++consultaDisponibilidad;
        habitacionSelect.disabled = true;
        habitacionSelect.innerHTML = '<option value="">Selecciona fechas válidas primero</option>';
        if (!entrada || !salida || salida <= entrada) return;

        habitacionSelect.innerHTML = '<option value="">Consultando disponibilidad...</option>';
        errorReservacion.textContent = "";
        try {
            const parametros = new URLSearchParams({ entrada, salida });
            const datos = await apiRecepcion(
                `/recepcion/reservaciones/disponibles?${parametros.toString()}`
            );
            if (consulta !== consultaDisponibilidad) return;
            habitacionSelect.innerHTML = datos.habitaciones.length
                ? '<option value="">Selecciona una habitación...</option>'
                : '<option value="">No hay habitaciones disponibles</option>';
            datos.habitaciones.forEach(habitacion => {
                const opcion = document.createElement("option");
                opcion.value = String(habitacion.id);
                opcion.textContent = `Hab. ${habitacion.numero} · ${habitacion.tipo} · $${Number(habitacion.precio).toFixed(2)}/noche`;
                habitacionSelect.append(opcion);
            });
            habitacionSelect.disabled = datos.habitaciones.length === 0;
        } catch (error) {
            if (consulta !== consultaDisponibilidad) return;
            habitacionSelect.innerHTML = '<option value="">No se pudo consultar disponibilidad</option>';
            errorReservacion.textContent = error.message;
        }
    }

    document.getElementById("btnNuevaReservacionRecepcion").addEventListener("click", () => {
        reservacionForm.reset();
        errorReservacion.textContent = "";
        const hoy = new Date();
        const manana = new Date(hoy);
        manana.setDate(manana.getDate() + 1);
        entradaInput.min = fechaLocal(hoy);
        salidaInput.min = fechaLocal(hoy);
        entradaInput.value = fechaLocal(hoy);
        salidaInput.value = fechaLocal(manana);
        habitacionSelect.disabled = true;
        habitacionSelect.innerHTML = '<option value="">Selecciona fechas válidas primero</option>';
        reservacionDialog.showModal();
        cargarClientesRecepcion();
        cargarHabitacionesRecepcion();
    });

    entradaInput.addEventListener("change", () => {
        salidaInput.min = entradaInput.value || fechaLocal(new Date());
        cargarHabitacionesRecepcion();
    });
    salidaInput.addEventListener("change", cargarHabitacionesRecepcion);

    document.getElementById("cerrarReservacionRecepcion").addEventListener("click", () => {
        reservacionDialog.close();
    });
    document.getElementById("cancelarReservacionRecepcion").addEventListener("click", () => {
        reservacionDialog.close();
    });
    reservacionDialog.addEventListener("click", evento => {
        if (evento.target === reservacionDialog) reservacionDialog.close();
    });

    reservacionForm.addEventListener("submit", async evento => {
        evento.preventDefault();
        if (!reservacionForm.reportValidity()) return;
        errorReservacion.textContent = "";
        botonGuardar.disabled = true;
        botonGuardar.textContent = "Guardando...";
        try {
            const datos = await apiRecepcion("/recepcion/reservaciones/api", {
                method: "POST",
                body: JSON.stringify({
                    cliente_id: Number(clienteSelect.value),
                    habitacion_id: Number(habitacionSelect.value),
                    fecha_entrada: entradaInput.value,
                    fecha_salida: salidaInput.value,
                    adultos: Number(document.getElementById("adultosReservacionRecepcion").value),
                    ninos: Number(document.getElementById("ninosReservacionRecepcion").value),
                    comentarios: document.getElementById("comentariosReservacionRecepcion").value.trim()
                })
            });
            reservacionDialog.close();
            mensajeReservacion.textContent = datos.message || "La reservación se registró correctamente.";
            mensajeReservacion.className = "alerta alerta-exito";
            mensajeReservacion.hidden = false;
        } catch (error) {
            errorReservacion.textContent = error.message;
        } finally {
            botonGuardar.disabled = false;
            botonGuardar.textContent = "Guardar reservación";
        }
    });
}
