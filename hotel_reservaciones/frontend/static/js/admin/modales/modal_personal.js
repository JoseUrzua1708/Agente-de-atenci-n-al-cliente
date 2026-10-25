(() => {
    "use strict";

    const modal = document.getElementById("modalPersonal");
    const formulario = document.getElementById("formCrearPersonal");

    if (!modal || !formulario || modal.dataset.inicializado === "true") {
        return;
    }

    modal.dataset.inicializado = "true";

    const ventana = modal.querySelector(".pm-modal__ventana");
    const btnAbrir = document.getElementById("btnInsertarPersonal");
    const btnGuardar = document.getElementById("pmBtnGuardar");
    const btnCancelar = modal.querySelector("[data-modal-cerrar]");
    const textoGuardar = btnGuardar?.querySelector(".pm-btn__texto");
    const indicadorGuardar = btnGuardar?.querySelector(".pm-btn__cargando");

    const campoRol = document.getElementById("pmRol");
    const campoNombre = document.getElementById("pmNombre");
    const campoApellidos = document.getElementById("pmApellidos");
    const campoEmail = document.getElementById("pmEmail");
    const campoTelefono = document.getElementById("pmTelefono");
    const campoPassword = document.getElementById("pmPassword");
    const campoConfirmacion = document.getElementById("pmConfirmarPassword");

    const mensajeFormulario = document.getElementById("pmMensajeFormulario");
    const regionToast = document.getElementById("pmToastRegion");
    const indicadorSeguridad = document.getElementById("pmSeguridadPassword");
    const estadoPassword = document.getElementById("pmEstadoPassword");

    const URL_ADMIN = modal.dataset.urlAdmin;
    const URL_RECEPCION = modal.dataset.urlRecepcion;

    let enviando = false;
    let temporizadorMensaje = null;
    let temporizadoresToast = new WeakMap();

    // =========================================
    // MENSAJES TEMPORALES
    // =========================================

    function mostrarMensaje(texto, tipo = "error") {
        if (temporizadorMensaje) {
            clearTimeout(temporizadorMensaje);
        }

        mensajeFormulario.textContent = texto;
        mensajeFormulario.classList.toggle(
            "pm-mensaje--exito",
            tipo === "exito"
        );
        mensajeFormulario.hidden = false;

        temporizadorMensaje = setTimeout(() => {
            mensajeFormulario.hidden = true;
            mensajeFormulario.textContent = "";
        }, 3000);
    }

    function mostrarToast(texto, tipo = "exito") {
        const toast = document.createElement("div");
        toast.className = `pm-toast pm-toast--${tipo}`;
        toast.setAttribute("role", tipo === "error" ? "alert" : "status");
        toast.textContent = texto;

        regionToast.appendChild(toast);

        const temporizador = setTimeout(() => {
            toast.classList.add("pm-toast--salida");

            setTimeout(() => toast.remove(), 260);
        }, 3000);

        temporizadoresToast.set(toast, temporizador);
    }

    function limpiarMensaje() {
        if (temporizadorMensaje) {
            clearTimeout(temporizadorMensaje);
            temporizadorMensaje = null;
        }

        mensajeFormulario.hidden = true;
        mensajeFormulario.textContent = "";
        mensajeFormulario.classList.remove("pm-mensaje--exito");
    }

    // =========================================
    // APERTURA Y CIERRE DEL MODAL
    // =========================================

    function abrirModal() {
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";

        requestAnimationFrame(() => {
            campoRol.focus();
        });
    }

    function cerrarModal() {
        if (enviando) return;

        modal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";

        if (btnAbrir) {
            btnAbrir.focus();
        }
    }

    btnAbrir?.addEventListener("click", evento => {
        evento.preventDefault();

        if (enviando) return;

        reiniciarFormulario();
        abrirModal();
    });

    btnCancelar?.addEventListener("click", cerrarModal);

    modal.querySelector("[data-modal-fondo]")?.addEventListener(
        "click",
        cerrarModal
    );

    document.addEventListener("keydown", evento => {
        if (
            evento.key === "Escape" &&
            modal.getAttribute("aria-hidden") === "false"
        ) {
            cerrarModal();
        }
    });

    // =========================================
    // MOSTRAR / OCULTAR CONTRASEÑA
    // =========================================

    modal.querySelectorAll("[data-toggle-password]").forEach(boton => {
        boton.addEventListener("click", () => {
            const idCampo = boton.dataset.togglePassword;
            const campo = document.getElementById(idCampo);

            if (!campo) return;

            const mostrar = campo.type === "password";

            campo.type = mostrar ? "text" : "password";
            boton.setAttribute("aria-pressed", String(mostrar));

            boton.setAttribute(
                "aria-label",
                mostrar ? "Ocultar contraseña" : "Mostrar contraseña"
            );

            campo.animate(
                [
                    { opacity: 0.7, transform: "scale(0.99)" },
                    { opacity: 1, transform: "scale(1)" }
                ],
                { duration: 180, easing: "ease-out" }
            );
        });
    });

    // =========================================
    // VALIDACIÓN DE CONTRASEÑA
    // =========================================

    function evaluarPassword(password) {
        const reglas = [
            password.length >= 8,
            /[A-Z]/.test(password),
            /[a-z]/.test(password),
            /[0-9]/.test(password),
            /[^A-Za-z0-9]/.test(password)
        ];

        const cumplidas = reglas.filter(Boolean).length;

        return {
            reglas,
            segura: reglas.every(Boolean),
            nivel: password.length === 0
                ? 0
                : cumplidas <= 2
                    ? 1
                    : cumplidas === 3
                        ? 2
                        : cumplidas === 4
                            ? 3
                            : 4
        };
    }

    function actualizarSeguridadPassword() {
        const resultado = evaluarPassword(campoPassword.value);

        indicadorSeguridad.dataset.nivel = String(resultado.nivel);

        if (!campoPassword.value) {
            estadoPassword.textContent = "Escribe una contraseña segura.";
        } else if (!resultado.segura) {
            const faltantes = [];

            if (!resultado.reglas[0]) faltantes.push("8 caracteres");
            if (!resultado.reglas[1]) faltantes.push("una mayúscula");
            if (!resultado.reglas[2]) faltantes.push("una minúscula");
            if (!resultado.reglas[3]) faltantes.push("un número");
            if (!resultado.reglas[4]) faltantes.push("un símbolo");

            estadoPassword.textContent =
                "Falta: " + faltantes.join(", ") + ".";
        } else {
            estadoPassword.textContent = "Contraseña segura.";
        }
    }

    campoPassword.addEventListener("input", actualizarSeguridadPassword);

    // =========================================
    // VALIDAR CAMPOS
    // =========================================

    function validarFormulario() {
        const campos = [
            campoRol,
            campoNombre,
            campoApellidos,
            campoEmail,
            campoTelefono,
            campoPassword,
            campoConfirmacion
        ];

        campos.forEach(campo => campo.classList.remove("pm-invalido"));

        for (const campo of campos) {
            if (!campo.value.trim()) {
                campo.classList.add("pm-invalido");
                campo.focus();

                mostrarMensaje(
                    `El campo "${campo.labels?.[0]?.textContent.replace("*", "").trim() || campo.name}" es obligatorio.`
                );

                return false;
            }
        }

        if (!campoEmail.validity.valid) {
            campoEmail.classList.add("pm-invalido");
            campoEmail.focus();
            mostrarMensaje("Ingresa un correo electrónico válido.");
            return false;
        }

        const password = campoPassword.value;
        const resultado = evaluarPassword(password);

        if (!resultado.segura) {
            campoPassword.classList.add("pm-invalido");
            campoPassword.focus();

            mostrarMensaje(
                "La contraseña debe tener al menos 8 caracteres, mayúscula, minúscula, número y símbolo."
            );

            return false;
        }

        if (password.length > 128) {
            campoPassword.classList.add("pm-invalido");
            campoPassword.focus();
            mostrarMensaje("La contraseña no puede superar 128 caracteres.");
            return false;
        }

        if (password !== campoConfirmacion.value) {
            campoConfirmacion.classList.add("pm-invalido");
            campoConfirmacion.focus();
            mostrarMensaje("Las contraseñas no coinciden.");
            return false;
        }

        return true;
    }

    // =========================================
    // BLOQUEAR CONTROLES DURANTE EL REGISTRO
    // =========================================

    function establecerEstadoEnvio(activo) {
        enviando = activo;

        formulario.querySelectorAll("input, select").forEach(campo => {
            campo.disabled = activo;
        });

        modal.querySelectorAll("[data-toggle-password]").forEach(boton => {
            boton.disabled = activo;
        });

        if (btnCancelar) {
            btnCancelar.disabled = activo;
        }

        if (btnGuardar) {
            btnGuardar.disabled = activo;
        }

        if (textoGuardar) {
            textoGuardar.textContent = activo
                ? "Creando usuario..."
                : "Crear usuario";
        }

        if (indicadorGuardar) {
            indicadorGuardar.hidden = !activo;
        }
    }

    // =========================================
    // CREAR USUARIO EN FLASK
    // =========================================

    async function registrarUsuario(evento) {
        evento.preventDefault();

        if (enviando || !validarFormulario()) return;

        limpiarMensaje();

        const rol = campoRol.value;
        const endpoint = rol === "1" ? URL_ADMIN : URL_RECEPCION;

        if (!endpoint) {
            mostrarMensaje("No se encontró la dirección para crear la cuenta.");
            return;
        }

        const datos = {
            nombre: campoNombre.value.trim(),
            apellidos: campoApellidos.value.trim(),
            email: campoEmail.value.trim(),
            telefono: campoTelefono.value.trim(),
            password: campoPassword.value,
            confirmar_password: campoConfirmacion.value
        };

        establecerEstadoEnvio(true);

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

            const resultado = await respuesta.json().catch(() => null);

            if (!respuesta.ok || !resultado?.success) {
                mostrarMensaje(
                    resultado?.message ||
                    "No fue posible crear la cuenta. Inténtalo nuevamente."
                );

                return;
            }

            mostrarToast(
                resultado.message || "Usuario creado correctamente.",
                "exito"
            );

            modal.setAttribute("aria-hidden", "true");
            document.body.style.overflow = "";

            formulario.reset();
            actualizarSeguridadPassword();

            // Recargar el directorio para mostrar al usuario recién creado.
            setTimeout(() => {
                window.location.reload();
            }, 3000);

        } catch (error) {
            console.error("Error al crear usuario:", error);

            mostrarMensaje(
                "No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo nuevamente."
            );
        } finally {
            establecerEstadoEnvio(false);
        }
    }

    formulario.addEventListener("submit", registrarUsuario);

    // =========================================
    // RESTABLECER FORMULARIO
    // =========================================

    function reiniciarFormulario() {
        formulario.reset();
        limpiarMensaje();

        formulario.querySelectorAll(".pm-invalido").forEach(campo => {
            campo.classList.remove("pm-invalido");
        });

        modal.querySelectorAll("[data-toggle-password]").forEach(boton => {
            boton.setAttribute("aria-pressed", "false");
            boton.setAttribute("aria-label", "Mostrar contraseña");
        });

        actualizarSeguridadPassword();
    }

    actualizarSeguridadPassword();
})();
