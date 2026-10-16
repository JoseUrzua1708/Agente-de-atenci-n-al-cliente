
document.addEventListener("DOMContentLoaded", inicializarPerfil);

async function inicializarPerfil() {
    const estado = document.getElementById("profileStatus");
    const anio = document.getElementById("footerYear");

    if (anio) {
        anio.textContent = new Date().getFullYear();
    }

    if (!estado) {
        console.error("No se encontró profileStatus en el HTML.");
        return;
    }

    estado.hidden = false;
    estado.textContent = "Consultando información de tu cuenta...";

    try {
        const respuesta = await fetch("/admin/perfil/datos", {
            method: "GET",
            headers: {
                "Accept": "application/json"
            },
            credentials: "same-origin",
            cache: "no-store"
        });

        const datos = await respuesta.json();

        if (respuesta.status === 401) {
            window.location.replace(datos.redirect || "/login");
            return;
        }

        if (respuesta.status === 403) {
            estado.textContent =
                datos.message || "No tienes permiso para ver este perfil.";
            return;
        }

        if (!respuesta.ok || !datos.success || !datos.perfil) {
            throw new Error(
                datos.message || "No se pudieron cargar los datos."
            );
        }

        const perfil = datos.perfil;

        mostrarDato("profileName", perfil.nombre);
        mostrarDato("profileLastName", perfil.apellidos);
        mostrarDato("profileEmail", perfil.correo);
        mostrarDato("profilePhone", perfil.telefono);
        mostrarDato("profileState", perfil.estado);
        mostrarDato("profileLastAccess", perfil.ultimo_acceso);
        mostrarDato("profileCreated", perfil.fecha_creacion);
        mostrarDato("profileUpdated", perfil.fecha_actualizacion);

        estado.textContent = "Perfil cargado correctamente.";
        estado.hidden = true;

    } catch (error) {
        console.error("Error al cargar el perfil:", error);

        estado.hidden = false;
        estado.textContent =
            "No se pudo cargar el perfil. " + error.message;
    }
}

function mostrarDato(id, valor) {
    const elemento = document.getElementById(id);

    if (!elemento) {
        console.warn("Falta el elemento HTML:", id);
        return;
    }

    elemento.textContent =
        valor !== null &&
        valor !== undefined &&
        String(valor).trim() !== ""
            ? String(valor).trim()
            : "No registrado";
}
