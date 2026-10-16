
document.addEventListener("DOMContentLoaded", () => {
    cargarPerfilUsuario();

    const profileButton = document.getElementById("profileButton");

    if (profileButton) {
        profileButton.addEventListener("click", () => {
            // Conserva aquí la función que abre tu modal de perfil.
            if (typeof abrirModalPerfil === "function") {
                abrirModalPerfil();
            }
        });
    }
});

async function cargarPerfilUsuario() {
    const avatar = document.getElementById("topProfileAvatar");
    const nombreElemento = document.getElementById("topProfileName");
    const rolElemento = document.getElementById("topProfileRole");

    if (!avatar || !nombreElemento || !rolElemento) return;

    try {
        const respuesta = await fetch("/admin/perfil/datos", {
            method: "GET",
            headers: {
                "Accept": "application/json"
            },
            credentials: "same-origin"
        });

        const datos = await respuesta.json();

        if (!respuesta.ok || !datos.success) {
            if (respuesta.status === 401 && datos.redirect) {
                window.location.assign(datos.redirect);
                return;
            }

            throw new Error(
                datos.message || "No se pudo cargar el perfil."
            );
        }

        const perfil = datos.perfil;

        const welcomeUserName = document.getElementById("welcomeUserName");

if (welcomeUserName) {
    welcomeUserName.textContent = perfil.nombre?.trim() || "Usuario";
}

        const nombreCompleto =
            perfil.nombre_completo?.trim() || "Usuario";

        const rol = perfil.rol?.trim() || "Sin rol";

        nombreElemento.textContent = nombreCompleto;
        rolElemento.textContent = rol;
        avatar.textContent = obtenerIniciales(nombreCompleto);

    } catch (error) {
        console.error("Error al cargar el perfil:", error);

        nombreElemento.textContent = "Perfil no disponible";
        rolElemento.textContent = "Error de conexión";
        avatar.textContent = "--";
    }
}

function obtenerIniciales(nombreCompleto) {
    return nombreCompleto
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(palabra => palabra.charAt(0).toUpperCase())
        .join("");
}


document.addEventListener("DOMContentLoaded", () => {
    inicializarMenuPerfil();
    cargarPerfilUsuario();
});

function inicializarMenuPerfil() {
    const boton = document.getElementById("profileButton");
    const modal = document.getElementById("profileDropdown");
    const contenedor = document.getElementById("profileMenu");
    const botonCerrarSesion = document.getElementById("logoutButton");

    if (!boton || !modal || !contenedor) return;

    function cambiarEstadoModal(abierto) {
        boton.setAttribute("aria-expanded", String(abierto));
        modal.setAttribute("aria-hidden", String(!abierto));
        modal.classList.toggle("is-open", abierto);
        modal.inert = !abierto;
    }

    boton.addEventListener("click", () => {
        const abierto = boton.getAttribute("aria-expanded") === "true";
        cambiarEstadoModal(!abierto);
    });

    // Cerrar al hacer clic fuera del menú
    document.addEventListener("click", (evento) => {
        if (!contenedor.contains(evento.target)) {
            cambiarEstadoModal(false);
        }
    });

    // Cerrar con Escape
    document.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape") {
            cambiarEstadoModal(false);
            boton.focus();
        }
    });

    // Cerrar el modal al entrar a ver el perfil
    const enlacePerfil = modal.querySelector('a[href="/admin/perfil"]');

    if (enlacePerfil) {
        enlacePerfil.addEventListener("click", () => {
            cambiarEstadoModal(false);
        });
    }

    // Cerrar sesión
    if (botonCerrarSesion) {
        botonCerrarSesion.addEventListener("click", cerrarSesionUsuario);
    }
}

async function cargarPerfilUsuario() {
    try {
        const respuesta = await fetch("/admin/perfil/datos", {
            method: "GET",
            headers: {
                "Accept": "application/json"
            },
            credentials: "same-origin"
        });

        const datos = await respuesta.json();

        if (respuesta.status === 401 && datos.redirect) {
            window.location.assign(datos.redirect);
            return;
        }

        if (!respuesta.ok || !datos.success || !datos.perfil) {
            throw new Error(datos.message || "No se pudo cargar el perfil.");
        }

        const perfil = datos.perfil;
        const nombre = perfil.nombre_completo?.trim() || "Usuario";
        const rol = perfil.rol?.trim() || "Sin rol";
        const iniciales = obtenerIniciales(nombre);

        // Actualizar botón superior
        establecerTexto("topProfileName", nombre);
        establecerTexto("topProfileRole", rol);
        establecerTexto("topProfileAvatar", iniciales);

        // Actualizar modal desplegable
        establecerTexto("dropdownProfileName", nombre);
        establecerTexto("dropdownProfileRole", rol);
        establecerTexto("dropdownProfileAvatar", iniciales);

        // Actualizar saludo, si existe en el panel
        establecerTexto("welcomeUserName", perfil.nombre?.trim() || "Usuario");

    } catch (error) {
        console.error("Error al cargar los datos del perfil:", error);
    }
}

function establecerTexto(id, valor) {
    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.textContent = valor;
    }
}

function obtenerIniciales(nombreCompleto) {
    return nombreCompleto
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(palabra => palabra.charAt(0).toUpperCase())
        .join("");
}

async function cerrarSesionUsuario() {
    const boton = document.getElementById("logoutButton");

    if (!boton || boton.disabled) return;

    boton.disabled = true;

    try {
        const respuesta = await fetch("/admin/cerrar-sesion", {
            method: "POST",
            headers: {
                "Accept": "application/json"
            },
            credentials: "same-origin"
        });

        const datos = await respuesta.json();

        if (!respuesta.ok || !datos.success) {
            throw new Error(datos.message || "No se pudo cerrar la sesión.");
        }

        window.location.assign(datos.redirect || "/login");

    } catch (error) {
        console.error("Error al cerrar sesión:", error);
        alert("No fue posible cerrar la sesión. Inténtalo nuevamente.");
        boton.disabled = false;
    }
}