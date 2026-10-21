
/* static/js/admin/modales/modal_personal.js */

(() => {
    "use strict";

    const modal = document.getElementById("modalPersonal");
    const formulario = document.getElementById("formCrearPersonal");

    if (!modal || !formulario || modal.dataset.inicializado === "true") {
        return;
    }

    modal.dataset.inicializado = "true";

    const ventana = modal.querySelector(".pm-modal__ventana");
    const contenido = modal.querySelector(".pm-modal__contenido");
    const btnGuardar = document.getElementById("pmBtnGuardar");
    const mensajeFormulario = document.getElementById("pmMensajeFormulario");
    const regionToast = document.getElementById("pmToastRegion");
    const btnAbrir = document.getElementById("btnInsertarPersonal");

    const campoRol = document.getElementById("pmRol");
    const campoNombre = document.getElementById("pmNombre");
    const campoApellidos = document.getElementById("pmApellidos");
    const campoEmail = document.getElementById("pmEmail");
    const campoTelefono = document.getElementById("pmTelefono");
    const campoPassword = document.getElementById("pmPassword");
    const campoConfirmar = document.getElementById("pmConfirmarPassword");

    const URL_ADMIN = modal.dataset.urlAdmin;
    const URL_RECEPCION = modal.dataset.urlRecepcion;

    let modalAbierto = false;
    let enviando = false;
    let temporizadorCierre = null;
    let temporizadoresToast = new Map();
    let elementoAnterior = null;
    let desplazamientoAnterior = 0;

    const iconosToast = {
        exito: `
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m5 12 4 4L19 6"
                    stroke="currentColor" stroke-width="2"
                    stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`,
        error: `
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9"
                    stroke="currentColor" stroke-width="1.8"/>
                <path d="M12 8v5m0 3h.01"
                    stroke="currentColor" stroke-width="2"
                    stroke-linecap="round"/>
            </svg>`
    };

    function abrirModal() {
        if (modalAbierto || enviando) return;

        clearTimeout(temporizadorCierre);
        elementoAnterior = document.activeElement;
        desplazamientoAnterior = window.scrollY;
        modalAbierto = true;

        modal.classList.remove("pm-modal--saliendo");
        modal.classList.add("pm-modal--abierto");
        modal.setAttribute("aria-hidden", "false");

        document.body.classList.add("pm-modal-bloqueado");

        // Evita que la página de fondo siga desplazándose.
        document.body.style.position = "fixed";
        document.body.style.top = `-${desplazamientoAnterior}px`;
        document.body.style.left = "0";
        document.body.style.right = "0";
        document.body.style.width = "100%";

        requestAnimationFrame(() => {
            campoRol.focus({ preventScroll: true });
        });
    }

    function cerrarModal() {
        if (!modalAbierto || enviando) return;

        modalAbierto = false;
        modal.classList.remove("pm-modal--abierto");
        modal.classList.add("pm-modal--saliendo");
        modal.setAttribute("aria-hidden", "true");

        document.body.classList.remove("pm-modal-bloqueado");
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        document.body.style.width = "";

        window.scrollTo(0, desplazamientoAnterior);

        temporizadorCierre = setTimeout(() => {
            modal.classList.remove("pm-modal--saliendo");

            if (elementoAnterior && elementoAnterior.isConnected) {
                elementoAnterior.focus({ preventScroll: true });
            }
        }, 280);
    }

    function limpiarErrores() {
        formulario.querySelectorAll(".pm-campo--error").forEach(campo => {
            campo.classList.remove("pm-campo--error");
        });

        formulario.querySelectorAll("[data-error]").forEach(elemento => {
            elemento.textContent = "";
        });

        mensajeFormulario.hidden = true;
        mensajeFormulario.textContent = "";
    }

    function mostrarErrorCampo(nombre, mensaje) {
        const campo = formulario.elements.namedItem(nombre);

        if (!campo) return;

        const contenedor = campo.closest(".pm-campo");
        const salida = formulario.querySelector(`[data-error="${nombre}"]`);

        if (contenedor) {
            contenedor.classList.add("pm-campo--error");
        }

        if (salida) {
            salida.textContent = mensaje;
        }
    }

    function mostrarErrorFormulario(mensaje) {
        mensajeFormulario.textContent = mensaje;
        mensajeFormulario.hidden = false;
    }

    function mostrarToast(tipo, titulo, mensaje, duracion = 3000) {
        const toast = document.createElement("div");
        const id = `${Date.now()}-${Math.random()}`;

        toast.className = `pm-toast pm-toast--${tipo}`;
        toast.setAttribute("role", tipo === "error" ? "alert" : "status");

        const icono = document.createElement("span");
        icono.className = "pm-toast__icono";
        icono.innerHTML = iconosToast[tipo] || iconosToast.error;

        const texto = document.createElement("div");
        texto.className = "pm-toast__texto";

        const encabezado = document.createElement("strong");
        encabezado.textContent = titulo;

        const descripcion = document.createElement("p");
        descripcion.textContent = mensaje;

        const cerrar = document.createElement("button");
        cerrar.type = "button";
        cerrar.className = "pm-toast__cerrar";
        cerrar.setAttribute("aria-label", "Cerrar notificación");
        cerrar.textContent = "×";

        texto.append(encabezado, descripcion);
        toast.append(icono, texto, cerrar);
        regionToast.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.add("pm-toast--visible");
        });

        function retirarToast() {
            clearTimeout(temporizadoresToast.get(id));
            temporizadoresToast.delete(id);

            toast.classList.remove("pm-toast--visible");
            toast.classList.add("pm-toast--salida");

            setTimeout(() => toast.remove(), 240);
        }

        cerrar.addEventListener("click", retirarToast);

        temporizadoresToast.set(id, setTimeout(retirarToast, duracion));

        return toast;
    }

    function reiniciarFormulario() {
        formulario.reset();
        limpiarErrores();

        // El rol inicial será recepción.
        campoRol.value = "2";

        [campoPassword, campoConfirmar].forEach(campo => {
            campo.type = "password";
        });

        formulario.querySelectorAll("[data-ver-password]").forEach(boton => {
            boton.setAttribute("aria-pressed", "false");
            boton.setAttribute("aria-label", "Mostrar contraseña");
        });

        if (contenido) contenido.scrollTop = 0;
    }

    function validarFormulario() {
        limpiarErrores();

        let primerCampoInvalido = null;

        const nombre = campoNombre.value.trim();
        const email = campoEmail.value.trim();
        const password = campoPassword.value;
        const confirmar = campoConfirmar.value;

        function error(campo, mensaje) {
            mostrarErrorCampo(campo, mensaje);

            if (!primerCampoInvalido) {
                primerCampoInvalido = formulario.elements.namedItem(campo);
            }
        }

        if (!nombre) {
            error("nombre", "Escribe el nombre del usuario.");
        } else if (nombre.length > 100) {
            error("nombre", "El nombre no puede superar 100 caracteres.");
        }

        if (campoApellidos.value.trim().length > 150) {
            error("apellidos", "Los apellidos no pueden superar 150 caracteres.");
        }

        if (!email) {
            error("email", "El correo electrónico es obligatorio.");
        } else if (
            email.length > 150 ||
            !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
        ) {
            error("email", "Escribe un correo electrónico válido.");
        }

        if (campoTelefono.value.trim().length > 25) {
            error("telefono", "El teléfono no puede superar 25 caracteres.");
        }

        if (password.length < 8) {
            error("password", "La contraseña debe tener al menos 8 caracteres.");
        }

        if (password !== confirmar) {
            error("confirmar_password", "Las contraseñas no coinciden.");
        }

        if (primerCampoInvalido) {
            primerCampoInvalido.focus();
            return false;
        }

        return true;
    }

    async function registrarUsuario(evento) {
        evento.preventDefault();

        if (enviando || !validarFormulario()) return;

        const rolId = campoRol.value;

        if (!["1", "2"].includes(rolId)) {
            mostrarErrorFormulario("Selecciona un tipo de cuenta válido.");
            return;
        }

        const endpoint = rolId === "1" ? URL_ADMIN : URL_RECEPCION;

        const datos = {
            nombre: campoNombre.value.trim(),
            apellidos: campoApellidos.value.trim(),
            email: campoEmail.value.trim().toLowerCase(),
            telefono: campoTelefono.value.trim(),
            password: campoPassword.value,
            confirmar_password: campoConfirmar.value
        };

        enviando = true;
        btnGuardar.disabled = true;
        btnGuardar.setAttribute("aria-busy", "true");
        btnGuardar.querySelector("span").textContent = "Registrando...";

        try {
            const respuesta = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                credentials: "same-origin",
                body: JSON.stringify(datos)
            });

            let resultado;

            try {
                resultado = await respuesta.json();
            } catch {
                throw new Error(
                    "El servidor devolvió una respuesta que no se pudo interpretar."
                );
            }

            if (!respuesta.ok || !resultado.success) {
                const mensaje = resultado.message ||
                    "No fue posible registrar la cuenta.";

                if (respuesta.status === 409) {
                    mostrarErrorCampo("email", mensaje);
                    campoEmail.focus();
                } else {
                    mostrarErrorFormulario(mensaje);
                }

                return;
            }

            const tipoUsuario = rolId === "1"
                ? "administrador"
                : "personal de recepción";

            const mensajeExito = resultado.message ||
                `La cuenta de ${tipoUsuario} se creó correctamente.`;

            reiniciarFormulario();

            // Liberamos el estado antes de cerrar el modal.
            enviando = false;
            btnGuardar.disabled = false;
            btnGuardar.removeAttribute("aria-busy");
            btnGuardar.querySelector("span").textContent = "Crear cuenta";

            cerrarModal();

            mostrarToast(
                "exito",
                "Registro completado",
                mensajeExito,
                3000
            );

            /*
             * Actualiza el directorio desde el servidor.
             * Se recarga después de mostrar la notificación.
             */
            setTimeout(() => {
                window.location.reload();
            }, 3200);

        } catch (error) {
            console.error("Error al registrar usuario:", error);

            mostrarErrorFormulario(
                error instanceof TypeError
                    ? "No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo."
                    : error.message || "Ocurrió un error inesperado."
            );
        } finally {
            enviando = false;
            btnGuardar.disabled = false;
            btnGuardar.removeAttribute("aria-busy");
            btnGuardar.querySelector("span").textContent = "Crear cuenta";
        }
    }

    // Botón que ya existe en personal.html.
    btnAbrir?.addEventListener("click", evento => {
        evento.preventDefault();
        reiniciarFormulario();
        abrirModal();
    });

    // Cerrar desde los botones de cancelar y la X.
    modal.querySelectorAll("[data-modal-cerrar]").forEach(boton => {
        boton.addEventListener("click", cerrarModal);
    });

    // No cerramos al pulsar el fondo: evitamos pérdidas accidentales.
    modal.querySelector("[data-modal-fondo]")?.addEventListener("click", evento => {
        evento.preventDefault();
    });

    formulario.addEventListener("submit", registrarUsuario);

    // Limpiar errores individuales al modificar el campo.
    formulario.querySelectorAll("input, select").forEach(campo => {
        campo.addEventListener("input", () => {
            const contenedor = campo.closest(".pm-campo");

            if (contenedor) {
                contenedor.classList.remove("pm-campo--error");
            }

            const salida = formulario.querySelector(
                `[data-error="${campo.name}"]`
            );

            if (salida) salida.textContent = "";

            if (!campoPassword.value || !campoConfirmar.value) return;

            if (
                campo === campoPassword ||
                campo === campoConfirmar
            ) {
                if (campoPassword.value === campoConfirmar.value) {
                    formulario.querySelector(
                        '[data-error="confirmar_password"]'
                    ).textContent = "";

                    campoConfirmar.closest(".pm-campo")
                        .classList.remove("pm-campo--error");
                }
            }
        });
    });

    // Mostrar y ocultar contraseñas.
    formulario.querySelectorAll("[data-ver-password]").forEach(boton => {
        boton.addEventListener("click", () => {
            const campo = document.getElementById(
                boton.dataset.verPassword
            );

            const mostrar = campo.type === "password";

            campo.type = mostrar ? "text" : "password";
            boton.setAttribute("aria-pressed", String(mostrar));
            boton.setAttribute(
                "aria-label",
                mostrar ? "Ocultar contraseña" : "Mostrar contraseña"
            );
        });
    });

    // Escape para cerrar y navegación de teclado dentro del diálogo.
    document.addEventListener("keydown", evento => {
        if (!modalAbierto) return;

        if (evento.key === "Escape") {
            evento.preventDefault();
            cerrarModal();
            return;
        }

        if (evento.key !== "Tab") return;

        const elementos = [
            ...ventana.querySelectorAll(
                'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]'
            )
        ].filter(elemento => elemento.offsetParent !== null);

        if (!elementos.length) {
            evento.preventDefault();
            ventana.focus();
            return;
        }

        const primero = elementos[0];
        const ultimo = elementos[elementos.length - 1];

        if (evento.shiftKey && document.activeElement === primero) {
            evento.preventDefault();
            ultimo.focus();
        } else if (!evento.shiftKey && document.activeElement === ultimo) {
            evento.preventDefault();
            primero.focus();
        }
    });

})();
