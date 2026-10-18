
"use strict";

/* ========================================
   INICIALIZACIÓN DEL PANEL DE ADMINISTRACIÓN
======================================== */

document.addEventListener("DOMContentLoaded", () => {
    inicializarMenuPerfil();
    inicializarModalCerrarSesion();
    cargarPerfilUsuario();
});


/* ========================================
   CARGAR LOS DATOS DEL ADMINISTRADOR
======================================== */

async function cargarPerfilUsuario() {
    const avatar = document.getElementById("topProfileAvatar");
    const nombreElemento = document.getElementById("topProfileName");
    const rolElemento = document.getElementById("topProfileRole");

    try {
        const respuesta = await fetch("/admin/perfil/datos", {
            method: "GET",
            headers: {
                "Accept": "application/json"
            },
            credentials: "same-origin"
        });

        const datos = await respuesta.json();

        // Si la sesión expiró, regresar al login.
        if (respuesta.status === 401 && datos.redirect) {
            window.location.assign(datos.redirect);
            return;
        }

        if (!respuesta.ok || !datos.success || !datos.perfil) {
            throw new Error(
                datos.message || "No se pudo cargar el perfil."
            );
        }

        const perfil = datos.perfil;

        const nombreCompleto =
            perfil.nombre_completo?.trim() || "Usuario";

        const nombre =
            perfil.nombre?.trim() || nombreCompleto;

        const rol =
            perfil.rol?.trim() || "Sin rol";

        const iniciales = obtenerIniciales(nombreCompleto);

        // Actualizar el botón superior del perfil.
        establecerTexto("topProfileName", nombreCompleto);
        establecerTexto("topProfileRole", rol);
        establecerTexto("topProfileAvatar", iniciales);

        // Actualizar el menú desplegable.
        establecerTexto("dropdownProfileName", nombreCompleto);
        establecerTexto("dropdownProfileRole", rol);
        establecerTexto("dropdownProfileAvatar", iniciales);

        // Actualizar el saludo del panel.
        establecerTexto("welcomeUserName", nombre);

        // Actualizar la sección Mi perfil.
        establecerTexto("perfilAvatar", iniciales);
        establecerTexto("perfilNombre", nombreCompleto);
        establecerTexto(
            "perfilCorreo",
            perfil.correo || "Correo no disponible"
        );
        establecerTexto("perfilRol", rol);
        establecerTexto("perfilNombreDetalle", nombreCompleto);
        establecerTexto(
            "perfilCorreoDetalle",
            perfil.correo || "No disponible"
        );

    } catch (error) {
        console.error("Error al cargar el perfil:", error);

        if (nombreElemento) {
            nombreElemento.textContent = "Perfil no disponible";
        }

        if (rolElemento) {
            rolElemento.textContent = "Error de conexión";
        }

        if (avatar) {
            avatar.textContent = "--";
        }
    }
}


/* ========================================
   ACTUALIZAR TEXTO DE UN ELEMENTO
======================================== */

function establecerTexto(id, valor) {
    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.textContent = valor;
    }
}


/* ========================================
   OBTENER INICIALES DEL ADMINISTRADOR
======================================== */

function obtenerIniciales(nombreCompleto) {
    return (nombreCompleto || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(palabra => palabra.charAt(0).toUpperCase())
        .join("");
}


/* ========================================
   MENÚ DESPLEGABLE DEL PERFIL
======================================== */

function inicializarMenuPerfil() {
    const boton = document.getElementById("profileButton");
    const menu = document.getElementById("profileDropdown");
    const contenedor = document.getElementById("profileMenu");

    if (!boton || !menu || !contenedor) {
        console.warn("No se encontró el menú del perfil.");
        return;
    }

    function cambiarEstadoMenu(abierto) {
        boton.setAttribute("aria-expanded", String(abierto));
        menu.setAttribute("aria-hidden", String(!abierto));

        menu.classList.toggle("is-open", abierto);
        menu.inert = !abierto;
    }

    // Abrir o cerrar el menú.
    boton.addEventListener("click", evento => {
        evento.stopPropagation();

        const abierto =
            boton.getAttribute("aria-expanded") === "true";

        cambiarEstadoMenu(!abierto);
    });

    // Cerrar el menú al hacer clic fuera.
    document.addEventListener("click", evento => {
        if (!contenedor.contains(evento.target)) {
            cambiarEstadoMenu(false);
        }
    });

    // Cerrar el menú con Escape.
    document.addEventListener("keydown", evento => {
        if (
            evento.key === "Escape" &&
            boton.getAttribute("aria-expanded") === "true"
        ) {
            cambiarEstadoMenu(false);
        }
    });

    // Cerrar el menú al entrar a la sección de perfil.
    const enlacePerfil = menu.querySelector(
        'a[href="/admin/perfil"]'
    );

    if (enlacePerfil) {
        enlacePerfil.addEventListener("click", () => {
            cambiarEstadoMenu(false);
        });
    }

    // El botón de cerrar sesión abre el modal.
    // No cerrar la sesión directamente desde este menú.
}


/* ========================================
   BLOQUEAR Y RESTAURAR EL SCROLL
======================================== */

// Guardar la posición original de la página.
let posicionScrollAnterior = 0;
let scrollBloqueado = false;

function bloquearScrollModal() {
    // Evitar bloquear dos veces.
    if (scrollBloqueado) return;

    scrollBloqueado = true;

    // Guardar la posición vertical actual.
    posicionScrollAnterior = window.scrollY;

    // Compensar el ancho de la barra de desplazamiento
    // para evitar que el contenido se mueva horizontalmente.
    const anchoBarraScroll =
        window.innerWidth - document.documentElement.clientWidth;

    document.documentElement.classList.add("logout-modal-active");
    document.body.classList.add("logout-modal-active");

    document.body.dataset.scrollAnterior =
        String(posicionScrollAnterior);

    document.body.style.top =
        `-${posicionScrollAnterior}px`;

    if (anchoBarraScroll > 0) {
        document.body.style.paddingRight =
            `${anchoBarraScroll}px`;
    }
}

function restaurarScrollModal() {
    if (!scrollBloqueado) return;

    // Quitar el bloqueo de scroll.
    document.documentElement.classList.remove("logout-modal-active");
    document.body.classList.remove("logout-modal-active");

    // Restaurar los estilos originales.
    document.body.style.top = "";
    document.body.style.paddingRight = "";
    delete document.body.dataset.scrollAnterior;

    // Recuperar la posición anterior sin animación.
    window.scrollTo({
        top: posicionScrollAnterior,
        left: window.scrollX,
        behavior: "instant"
    });

    scrollBloqueado = false;
}


/* ========================================
   MODAL DE CONFIRMACIÓN DE CIERRE DE SESIÓN
======================================== */

function inicializarModalCerrarSesion() {
    const botonCerrarSesion =
        document.getElementById("logoutButton");

    const modal =
        document.getElementById("logoutModal");

    const botonCancelar =
        document.getElementById("cancelLogout");

    const botonConfirmar =
        document.getElementById("confirmLogout");

    const tarjeta =
        modal?.querySelector(".logout-modal");

    if (
        !botonCerrarSesion ||
        !modal ||
        !botonCancelar ||
        !botonConfirmar ||
        !tarjeta
    ) {
        console.warn(
            "No se encontró el modal de confirmación de cierre de sesión."
        );
        return;
    }

    let cerrandoSesion = false;
    let elementoAnterior = null;

    // El modal empieza cerrado.
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    modal.inert = true;

    /* ------------------------------------
       ABRIR EL MODAL
    ------------------------------------ */

    function abrirModalCerrarSesion() {
        if (cerrandoSesion || modal.classList.contains("is-open")) {
            return;
        }

        // Guardar el elemento que tenía el foco.
        elementoAnterior = document.activeElement;

        // Bloquear el scroll antes de mostrar el modal.
        bloquearScrollModal();

        // Mostrar el modal.
        modal.inert = false;
        modal.setAttribute("aria-hidden", "false");
        modal.classList.add("is-open");

        // Evitar que los botones queden deshabilitados
        // si se vuelve a abrir después de un error.
        botonConfirmar.disabled = false;
        botonCancelar.disabled = false;

        const textoBoton = botonConfirmar.querySelector("span");

        if (textoBoton) {
            textoBoton.textContent = "Cerrar sesión";
        }

        // Llevar el foco al cuadro de confirmación.
        tarjeta.focus({ preventScroll: true });
    }

    /* ------------------------------------
       CERRAR EL MODAL SIN SALIR
    ------------------------------------ */

    function cancelarCierreSesion() {
        if (cerrandoSesion) return;

        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        modal.inert = true;

        // Restaurar el scroll y la posición exacta.
        restaurarScrollModal();

        // Restaurar el foco sin provocar otro desplazamiento.
        if (
            elementoAnterior &&
            typeof elementoAnterior.focus === "function"
        ) {
            elementoAnterior.focus({ preventScroll: true });
        }
    }

    /* ------------------------------------
       CONFIRMAR CIERRE DE SESIÓN
    ------------------------------------ */

    async function confirmarCierreSesion() {
        if (cerrandoSesion) return;

        cerrandoSesion = true;

        botonConfirmar.disabled = true;
        botonCancelar.disabled = true;

        const textoBoton = botonConfirmar.querySelector("span");

        if (textoBoton) {
            textoBoton.textContent = "Cerrando sesión...";
        }

        try {
            // Mantener la ruta Flask existente.
            const respuesta = await fetch("/admin/cerrar-sesion", {
                method: "POST",
                headers: {
                    "Accept": "application/json"
                },
                credentials: "same-origin"
            });

            let datos = {};

            try {
                datos = await respuesta.json();
            } catch {
                throw new Error(
                    "El servidor no devolvió una respuesta válida."
                );
            }

            if (!respuesta.ok || !datos.success) {
                throw new Error(
                    datos.message ||
                    "No se pudo cerrar la sesión."
                );
            }

            // Redirigir solamente si Flask confirma el cierre.
            window.location.assign(datos.redirect || "/login");

        } catch (error) {
            console.error("Error al cerrar la sesión:", error);

            cerrandoSesion = false;

            botonConfirmar.disabled = false;
            botonCancelar.disabled = false;

            if (textoBoton) {
                textoBoton.textContent = "Cerrar sesión";
            }

            alert(
                error.message ||
                "No fue posible cerrar la sesión. Inténtalo nuevamente."
            );

            // Mantener el modal abierto y el scroll bloqueado
            // para que el usuario pueda volver a intentarlo.
        }
    }

    /* ------------------------------------
       EVENTOS DEL MODAL
    ------------------------------------ */

    // Abrir confirmación, sin cerrar sesión directamente.
    botonCerrarSesion.addEventListener("click", evento => {
        evento.preventDefault();
        evento.stopPropagation();

        abrirModalCerrarSesion();
    });

    // Cancelar mantiene la sesión activa.
    botonCancelar.addEventListener(
        "click",
        cancelarCierreSesion
    );

    // Únicamente este botón realiza el cierre real.
    botonConfirmar.addEventListener(
        "click",
        confirmarCierreSesion
    );

    // Cerrar al hacer clic fuera de la tarjeta.
    modal.addEventListener("click", evento => {
        if (evento.target === modal) {
            cancelarCierreSesion();
        }
    });

    // Escape cancela la confirmación.
    document.addEventListener("keydown", evento => {
        if (
            evento.key === "Escape" &&
            modal.classList.contains("is-open")
        ) {
            evento.preventDefault();
            cancelarCierreSesion();
        }
    });
}
