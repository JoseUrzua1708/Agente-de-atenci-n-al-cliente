
(() => {
    "use strict";

    const modal = document.getElementById("modalDetallePersonal");

    if (!modal || modal.dataset.inicializado === "true") return;
    modal.dataset.inicializado = "true";

    const ventana = modal.querySelector(".pd-modal__ventana");

    const $ = id => document.getElementById(id);

    const campos = {
        avatar: $("pdAvatar"),
        titulo: $("pdTitulo"),
        subtitulo: $("pdSubtitulo"),
        id: $("pdId"),
        rol: $("pdRol"),
        nombre: $("pdNombre"),
        apellidos: $("pdApellidos"),
        email: $("pdEmail"),
        telefono: $("pdTelefono"),
        password: $("pdPassword"),
        estado: $("pdEstado"),
        ultimoAcceso: $("pdUltimoAcceso"),
        fechaCreacion: $("pdFechaCreacion"),
        fechaActualizacion: $("pdFechaActualizacion")
    };

    const btnEditar = $("pdEditar");
    const btnGuardar = $("pdGuardar");
    const btnCancelar = $("pdCancelarEdicion");
    const btnEstado = $("pdCambiarEstado");

    let usuarioActual = null;
    let elementoAnterior = null;
    let editando = false;
    let procesando = false;

    
const confirmacion = $("pdConfirmacion");
const confirmacionTitulo = $("pdConfirmacionTitulo");
const confirmacionTexto = $("pdConfirmacionTexto");
const confirmacionIcono = $("pdConfirmacionIcono");
const confirmacionAceptar = $("pdConfirmacionAceptar");

let resolverConfirmacion = null;

function pedirConfirmacion(activar) {
    return new Promise(resolve => {
        resolverConfirmacion = resolve;

        confirmacionTitulo.textContent = activar
            ? "¿Activar esta cuenta?"
            : "¿Bloquear esta cuenta?";

        confirmacionTexto.textContent = activar
            ? `La cuenta de ${nombreCompleto(usuarioActual)} volverá a estar activa y podrá acceder según sus permisos.`
            : `La cuenta de ${nombreCompleto(usuarioActual)} quedará inactiva y no podrá acceder mientras permanezca bloqueada.`;

        confirmacionIcono.classList.toggle("pd-confirmacion__icono--activar", activar);
        confirmacionAceptar.classList.toggle("pd-confirmacion__aceptar--activar", activar);

        confirmacionAceptar.textContent = activar
            ? "Sí, activar cuenta"
            : "Sí, bloquear cuenta";

        confirmacion.setAttribute("aria-hidden", "false");
        confirmacionAceptar.disabled = false;

        confirmacion.querySelector(".pd-confirmacion__caja").focus();
    });
}

function resolverDialogo(resultado) {
    if (!resolverConfirmacion) return;

    const resolver = resolverConfirmacion;
    resolverConfirmacion = null;

    confirmacion.setAttribute("aria-hidden", "true");
    resolver(resultado);
}

    const API_USUARIOS = "/admin/usuarios";

    function valor(dato) {
        return dato == null || dato === "" ? "No disponible" : String(dato);
    }

    function nombreCompleto(usuario) {
        return [
            usuario.nombre,
            usuario.apellidos
        ].filter(Boolean).join(" ").trim()
            || usuario.nombre_completo
            || usuario.email
            || "Usuario sin nombre";
    }

    function obtenerRol(usuario) {
        const rol = String(
            usuario.rol_nombre ??
            usuario.rol ??
            usuario.nombre_rol ??
            usuario.rol_id ??
            ""
        ).toLowerCase();

        if (rol === "1" || rol.includes("admin")) return "Administrador";
        if (rol === "2" || rol.includes("recep")) return "Recepcionista";

        return "Sin rol identificado";
    }

    function estaActivo(usuario) {
        const estado = String(usuario.estado ?? usuario.status ?? "").toUpperCase();

        if (typeof usuario.activo === "boolean") return usuario.activo;
        if (typeof usuario.is_active === "boolean") return usuario.is_active;

        return !["INACTIVO", "INACTIVE", "BLOQUEADO", "BLOCKED", "0", "FALSE"]
            .includes(estado);
    }

    function mostrarMensaje(mensaje) {
        window.alert(mensaje);
    }

    function mostrarBotones() {
        const recepcionista = obtenerRol(usuarioActual) === "Recepcionista";
        const activo = estaActivo(usuarioActual);

        btnEditar.hidden = !recepcionista || editando;
        btnGuardar.hidden = !editando;
        btnCancelar.hidden = !editando;
        btnEstado.hidden = editando;

        btnEstado.textContent = activo ? "Bloquear cuenta" : "Activar cuenta";
        btnEstado.classList.toggle("pd-btn-estado--activar", !activo);
    }

    function ponerCampoEditable(campo, nombre, valorInicial) {
        campo.textContent = "";

        const input = document.createElement("input");
        input.type = nombre === "email" ? "email" : "text";
        input.name = nombre;
        input.dataset.editField = nombre;
        input.value = valorInicial ?? "";
        input.required = nombre !== "telefono";
        input.maxLength = nombre === "nombre" ? 100
            : nombre === "apellidos" ? 150
            : nombre === "telefono" ? 25
            : 254;

        campo.appendChild(input);
    }

    function ponerCamposPassword() {
    campos.password.textContent = "";

    const contenedor = document.createElement("div");
    contenedor.className = "pd-password-edicion";

    function crearCampoPassword(etiqueta, nombre) {
        const grupo = document.createElement("div");
        grupo.className = "pd-password-edicion__grupo";

        const label = document.createElement("label");
        label.textContent = etiqueta;

        const fila = document.createElement("div");
        fila.className = "pd-password-edicion__fila";

        const input = document.createElement("input");
        input.type = "password";
        input.name = nombre;
        input.dataset.editField = nombre;
        input.autocomplete = "new-password";
        input.minLength = 8;
        input.maxLength = 128;
        input.placeholder = "Mínimo 8 caracteres";

        const boton = document.createElement("button");
boton.type = "button";
boton.className = "pd-password-edicion__ojo";
boton.setAttribute("aria-label", "Mostrar contraseña");
boton.title = "Mostrar contraseña";

boton.innerHTML = `
    <svg viewBox="0 0 24 24"
         width="19"
         height="19"
         fill="none"
         stroke="currentColor"
         stroke-width="1.8"
         stroke-linecap="round"
         stroke-linejoin="round"
         aria-hidden="true">
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/>
        <circle cx="12" cy="12" r="3"/>
    </svg>
`;
        boton.setAttribute("aria-label", `Mostrar u ocultar ${etiqueta.toLowerCase()}`);

        boton.addEventListener("click", () => {
    const visible = input.type === "password";

    input.type = visible ? "text" : "password";

    boton.setAttribute(
        "aria-label",
        visible ? "Ocultar contraseña" : "Mostrar contraseña"
    );

    boton.title = visible ? "Ocultar contraseña" : "Mostrar contraseña";

    boton.innerHTML = visible
        ? `<svg viewBox="0 0 24 24" width="19" height="19"
             fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round"
             aria-hidden="true">
             <path d="M3 3l18 18"/>
             <path d="M10.6 10.7a2 2 0 002.7 2.7"/>
             <path d="M9.9 5.2A10.8 10.8 0 0112 5c6.4 0 10 7 10 7a15 15 0 01-3.1 3.8"/>
             <path d="M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7a10 10 0 004-.8"/>
           </svg>`
        : `<svg viewBox="0 0 24 24" width="19" height="19"
             fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round"
             aria-hidden="true">
             <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/>
             <circle cx="12" cy="12" r="3"/>
           </svg>`;
});

        label.htmlFor = nombre;
        input.id = nombre;

        fila.append(input, boton);
        grupo.append(label, fila);
        contenedor.appendChild(grupo);
    }

    crearCampoPassword("Nueva contraseña", "password");
    crearCampoPassword("Confirmar contraseña", "confirmar_password");

    const ayuda = document.createElement("small");
    ayuda.textContent = "Déjalos vacíos si no deseas cambiar la contraseña.";

    contenedor.appendChild(ayuda);
    campos.password.appendChild(contenedor);
}

    function iniciarEdicion() {
        if (!usuarioActual || obtenerRol(usuarioActual) !== "Recepcionista") return;

        editando = true;

        ponerCampoEditable(campos.nombre, "nombre", usuarioActual.nombre);
        ponerCampoEditable(campos.apellidos, "apellidos", usuarioActual.apellidos);
        ponerCampoEditable(campos.email, "email", usuarioActual.email);
        ponerCampoEditable(campos.telefono, "telefono", usuarioActual.telefono);
        ponerCamposPassword();

        btnGuardar.disabled = false;
        mostrarBotones();

        modal.querySelector('[data-edit-field="nombre"]')?.focus();
    }

    function cancelarEdicion() {
        editando = false;
        pintarUsuario(usuarioActual);
    }

    function leerEdicion() {
    const datos = {};

    ["nombre", "apellidos", "email", "telefono"].forEach(nombre => {
        const input = modal.querySelector(`[data-edit-field="${nombre}"]`);
        datos[nombre] = input ? input.value.trim() : "";
    });

    if (!datos.nombre) throw new Error("El nombre es obligatorio.");
    if (!datos.apellidos) throw new Error("Los apellidos son obligatorios.");
    if (!datos.email) throw new Error("El correo electrónico es obligatorio.");

    const password = modal.querySelector('[data-edit-field="password"]').value;
    const confirmar = modal.querySelector('[data-edit-field="confirmar_password"]').value;

    if (password || confirmar) {
        if (password.length < 8) {
            throw new Error("La nueva contraseña debe tener al menos 8 caracteres.");
        }

        if (password !== confirmar) {
            throw new Error("Las contraseñas no coinciden.");
        }

        datos.password = password;
        datos.confirmar_password = confirmar;
    }

    return datos;
}

    async function enviar(url, metodo, datos) {
        const respuesta = await fetch(url, {
            method: metodo,
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(datos)
        });

        const resultado = await respuesta.json().catch(() => ({}));

        if (!respuesta.ok || resultado.success === false) {
            throw new Error(
                resultado.message ||
                resultado.mensaje ||
                `No se pudo completar la operación (${respuesta.status}).`
            );
        }

        return resultado;
    }

    function notificarActualizacion() {
        window.dispatchEvent(new CustomEvent("usuario:actualizado", {
            detail: { usuario: { ...usuarioActual } }
        }));
    }

    async function guardarEdicion() {
        if (!usuarioActual || procesando) return;

        let datos;

        try {
            datos = leerEdicion();
        } catch (error) {
            mostrarMensaje(error.message);
            return;
        }

        function mostrarToast(titulo, mensaje, duracion = 3500) {
    const toast = $("pdToast");
    const toastTitulo = $("pdToastTitulo");
    const toastTexto = $("pdToastTexto");

    if (!toast || !toastTitulo || !toastTexto) {
        console.error("No se encontró el mensaje de confirmación del modal.");
        return;
    }

    clearTimeout(window.temporizadorToastDetalle);

    toastTitulo.textContent = titulo;
    toastTexto.textContent = mensaje;

    toast.setAttribute("aria-hidden", "false");

    window.temporizadorToastDetalle = setTimeout(() => {
        toast.setAttribute("aria-hidden", "true");
    }, duracion);
}

        procesando = true;
        btnGuardar.disabled = true;

        try {
            const resultado = await enviar(
                `${API_USUARIOS}/${encodeURIComponent(usuarioActual.id)}`,
                "PUT",
                datos
            );

            const { password, confirmar_password, ...datosUsuario } = datos;

usuarioActual = {
    ...usuarioActual,
    ...datosUsuario
};

            editando = false;
            pintarUsuario(usuarioActual);
            notificarActualizacion();

            mostrarToast(
    "¡Datos actualizados!",
    "La información del recepcionista se guardó correctamente."
);
        } catch (error) {
            mostrarMensaje(error.message || "No se pudieron guardar los cambios.");
        } finally {
            procesando = false;
            btnGuardar.disabled = false;
        }
    }

    

async function cambiarEstado() {
    if (!usuarioActual || procesando) return;

    const activar = !estaActivo(usuarioActual);
    const confirmado = await pedirConfirmacion(activar);

    // Si cancela, deja abierto el modal de información.
    if (!confirmado) return;

    procesando = true;
    btnEstado.disabled = true;
    confirmacionAceptar.disabled = true;

    try {
        const nuevoEstado = activar ? "ACTIVO" : "INACTIVO";

        const resultado = await enviar(
            `${API_USUARIOS}/${encodeURIComponent(usuarioActual.id)}/estado`,
            "PATCH",
            { estado: nuevoEstado }
        );

        // Actualizar los datos del usuario.
        usuarioActual = {
            ...usuarioActual,
            estado: resultado.estado || nuevoEstado,
            activo: activar
        };

        pintarUsuario(usuarioActual);

        // Actualizar el directorio general.
        notificarActualizacion();

        // Cerrar la confirmación y el modal de detalles.
        confirmacion.setAttribute("aria-hidden", "true");

        procesando = false;
        cerrar();

        // Mostrar la notificación en PERSONAL, fuera de los modales.
        if (typeof window.mostrarNotificacionPersonal === "function") {
            window.mostrarNotificacionPersonal(
                "exito",
                activar ? "Cuenta activada" : "Cuenta bloqueada",
                activar
                    ? "La cuenta se ha activado correctamente. El usuario ya puede acceder al sistema."
                    : "La cuenta se ha bloqueado correctamente. El usuario ya no podrá acceder al sistema."
            );
        } else {
            console.error(
                "No se encontró el sistema global de notificaciones de Personal."
            );
        }

    } catch (error) {
        confirmacion.setAttribute("aria-hidden", "true");

        // Si falla el servidor, mostrar el error sin cerrar los detalles.
        if (typeof window.mostrarNotificacionPersonal === "function") {
            window.mostrarNotificacionPersonal(
                "error",
                "No se pudo actualizar la cuenta",
                error.message || "Ocurrió un error al cambiar el estado de la cuenta."
            );
        } else {
            mostrarMensaje(
                error.message || "No se pudo cambiar el estado de la cuenta."
            );
        }

    } finally {
        procesando = false;
        btnEstado.disabled = false;
        confirmacionAceptar.disabled = false;
    }
}

    function pintarUsuario(usuario) {
        if (!usuario) return;

        campos.avatar.textContent = nombreCompleto(usuario)
            .split(/\s+/)
            .slice(0, 2)
            .map(parte => parte.charAt(0))
            .join("")
            .toUpperCase();

        campos.titulo.textContent = nombreCompleto(usuario);
        campos.subtitulo.textContent = "Información de la cuenta";
        campos.id.textContent = valor(usuario.id);
        campos.rol.textContent = obtenerRol(usuario);
        campos.estado.textContent = String(usuario.estado ?? usuario.status ?? "DESCONOCIDO");
        campos.estado.dataset.estado = campos.estado.textContent.toLowerCase();

        campos.ultimoAcceso.textContent = valor(usuario.ultimo_acceso);
        campos.fechaCreacion.textContent = valor(usuario.fecha_creacion);
        campos.fechaActualizacion.textContent = valor(usuario.fecha_actualizacion);
        campos.password.textContent = usuario.password_hash || "No disponible";

        if (editando) {
            editando = false;
        }

        campos.nombre.textContent = valor(usuario.nombre);
        campos.apellidos.textContent = valor(usuario.apellidos);
        campos.email.textContent = valor(usuario.email);
        campos.telefono.textContent = valor(usuario.telefono);

        mostrarBotones();
    }

    function abrir(usuario) {
        usuarioActual = { ...usuario };
        elementoAnterior = document.activeElement;

        pintarUsuario(usuarioActual);

        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        ventana.focus();
    }

    function cerrar() {
        if (procesando || modal.getAttribute("aria-hidden") === "true") return;

        editando = false;
        modal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";

        if (elementoAnterior?.isConnected) elementoAnterior.focus();
    }

    window.addEventListener("usuario:ver-detalle", evento => {
        if (evento.detail?.usuario) abrir(evento.detail.usuario);
    });

    btnEditar.addEventListener("click", iniciarEdicion);
    btnGuardar.addEventListener("click", guardarEdicion);
    btnCancelar.addEventListener("click", cancelarEdicion);
    btnEstado.addEventListener("click", cambiarEstado);

    
    modal.querySelectorAll("[data-detalle-cerrar]").forEach(boton => {
        boton.addEventListener("click", cerrar);
    });

    // Confirmar bloqueo o activación.
    confirmacionAceptar.addEventListener("click", () => {
        resolverDialogo(true);
    });

    // Cancelar mediante los botones o el fondo del diálogo.
    confirmacion.querySelectorAll("[data-confirmacion-cancelar]").forEach(boton => {
        boton.addEventListener("click", () => {
            resolverDialogo(false);
        });
    });

    // Escape cancela la confirmación sin modificar la cuenta.
    document.addEventListener("keydown", evento => {
        if (
            evento.key === "Escape" &&
            confirmacion.getAttribute("aria-hidden") === "false"
        ) {
            evento.preventDefault();
            evento.stopPropagation();
            resolverDialogo(false);
            return;
        }

        if (
            evento.key === "Escape" &&
            modal.getAttribute("aria-hidden") === "false"
        ) {
            cerrar();
        }
    });
})();
