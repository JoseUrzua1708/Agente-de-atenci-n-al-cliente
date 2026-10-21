(function () {
    "use strict";

    const panel = document.getElementById("usuariosPanel");

    // Endpoint documentado en UsuariosController.
const API_USUARIOS = "/admin/usuarios/api";

    const contenedor = document.getElementById("carpetasUsuarios");
    const buscador = document.getElementById("buscarUsuario");
    const contador = document.getElementById("contadorResultados");
    const mensajeError = document.getElementById("mensajeError");

    let usuarios = [];

    const escapar = (valor) => String(valor ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const texto = (valor) => String(valor ?? "").trim();

    function nombreCompleto(usuario) {
        const nombre = [
            usuario.nombre,
            usuario.apellidos
        ].map(texto).filter(Boolean).join(" ");

        return nombre || usuario.nombre_completo || usuario.email || "Usuario sin nombre";
    }

    function rolUsuario(usuario) {
        const rol = texto(
            usuario.rol_nombre ??
            usuario.rol ??
            usuario.nombre_rol ??
            usuario.rol_id
        ).toLowerCase();

        if (rol === "1" || rol.includes("admin")) return "admin";
        if (rol === "2" || rol.includes("recep")) return "recepcion";

        return "otro";
    }

    function estaActivo(usuario) {
        const estado = texto(usuario.estado ?? usuario.status).toUpperCase();

        if (typeof usuario.activo === "boolean") return usuario.activo;
        if (typeof usuario.is_active === "boolean") return usuario.is_active;

        return ![
            "INACTIVO",
            "INACTIVE",
            "BLOQUEADO",
            "BLOCKED",
            "0",
            "FALSE"
        ].includes(estado);
    }

    function iniciales(usuario) {
        return nombreCompleto(usuario)
            .split(/\s+/)
            .slice(0, 2)
            .map(parte => parte.charAt(0))
            .join("")
            .toUpperCase();
    }

    function normalizarBusqueda(valor) {
        return texto(valor)
            .toLocaleLowerCase("es")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }

    function filtrarUsuarios() {
        const busqueda = normalizarBusqueda(buscador.value);

        return usuarios.filter(usuario => {
            const contenido = normalizarBusqueda([
                nombreCompleto(usuario),
                usuario.email,
                usuario.telefono,
                usuario.estado,
                usuario.rol_nombre,
                usuario.rol
            ].join(" "));

            return contenido.includes(busqueda);
        });
    }

    function crearTarjeta(usuario) {
        const nombre = nombreCompleto(usuario);
        const activo = estaActivo(usuario);
        const rol = rolUsuario(usuario);

        const correo = texto(usuario.email) || "Sin correo registrado";
        const telefono = texto(usuario.telefono) || "No registrado";
        const id = texto(usuario.id);

        const avatar = rol === "admin"
            ? "--u-avatar-bg:#eee0cf;--u-avatar-color:#805b38"
            : rol === "recepcion"
                ? "--u-avatar-bg:#e0eee5;--u-avatar-color:#387451"
                : "--u-avatar-bg:#f3e0df;--u-avatar-color:#a54d48";

        return `
            <article class="u-usuario">
                <div class="u-usuario-principal">
                    <div class="u-avatar" style="${avatar}">
                        ${escapar(iniciales(usuario))}
                    </div>

                    <div class="u-identidad">
                        <strong title="${escapar(nombre)}">
                            ${escapar(nombre)}
                        </strong>
                        <small title="${escapar(correo)}">
                            ${escapar(correo)}
                        </small>
                    </div>
                </div>

                <div class="u-usuario-datos">
                    <span>
                        Teléfono
                        <b title="${escapar(telefono)}">
                            ${escapar(telefono)}
                        </b>
                    </span>

                    <span>
                        Identificador
                        <b>#${escapar(id || "—")}</b>
                    </span>
                </div>

                <button
                    type="button"
                    class="u-btn-detalle"
                    data-usuario-id="${escapar(id)}"
                    aria-label="Ver información de ${escapar(nombre)}"
                >
                    Ver información
                    <span aria-hidden="true">↗</span>
                </button>
            </article>
        `;
    }

    function crearCarpeta(configuracion, lista) {
        const { id, titulo, descripcion, icono, fondo, color } = configuracion;

        return `
            <section class="u-carpeta"
                style="--u-folder-bg:${fondo};--u-folder-color:${color}"
            >
                <header class="u-carpeta-cabecera">
                    <div class="u-carpeta-titulo">
                        <div class="u-carpeta-icono">${icono}</div>
                        <div>
                            <h3>${titulo}</h3>
                            <p>${descripcion}</p>
                        </div>
                    </div>

                    <span class="u-carpeta-contador">
                        ${lista.length} ${lista.length === 1 ? "cuenta" : "cuentas"}
                    </span>
                </header>

                <div class="u-lista">
                    ${
                        lista.length
                            ? lista.map(crearTarjeta).join("")
                            : `
                                <div class="u-vacio">
                                    <span class="u-vacio-icono">⌕</span>
                                    <strong>No hay usuarios aquí</strong>
                                    <p>No se encontraron cuentas<br>para esta carpeta.</p>
                                </div>
                            `
                    }
                </div>
            </section>
        `;
    }

    function renderizar() {
        const filtrados = filtrarUsuarios();

        const activos = filtrados.filter(estaActivo);
        const inactivos = filtrados.filter(usuario => !estaActivo(usuario));

        const admins = activos.filter(usuario => rolUsuario(usuario) === "admin");
        const recepcion = activos.filter(usuario => rolUsuario(usuario) === "recepcion");

        // Los inactivos se muestran en su propia carpeta,
        // independientemente de su rol.
        const carpetas = [
            crearCarpeta({
                id: "admins",
                titulo: "Administradores",
                descripcion: "Control y supervisión",
                icono: "♙",
                fondo: "#f4ede5",
                color: "#a17b5c"
            }, admins),

            crearCarpeta({
                id: "recepcion",
                titulo: "Recepción",
                descripcion: "Personal operativo",
                icono: "♧",
                fondo: "#edf4ee",
                color: "#6b9a78"
            }, recepcion),

            crearCarpeta({
                id: "inactivos",
                titulo: "Inactivos / Bloqueados",
                descripcion: "Cuentas sin acceso activo",
                icono: "⊘",
                fondo: "#f9eded",
                color: "#c57670"
            }, inactivos)
        ];

        contenedor.innerHTML = carpetas.join("");

        // Resumen general, sin depender del texto del buscador.
        document.getElementById("totalAdmins").textContent =
            usuarios.filter(u => estaActivo(u) && rolUsuario(u) === "admin").length;

        document.getElementById("totalRecepcion").textContent =
            usuarios.filter(u => estaActivo(u) && rolUsuario(u) === "recepcion").length;

        document.getElementById("totalInactivos").textContent =
            usuarios.filter(u => !estaActivo(u)).length;

        contador.textContent =
            `${filtrados.length} ${filtrados.length === 1 ? "resultado" : "resultados"}`;
    }

    async function cargarUsuarios() {
        try {
            mensajeError.hidden = true;

            const respuesta = await fetch(API_USUARIOS, {
                method: "GET",
                headers: { "Accept": "application/json" },
                credentials: "same-origin"
            });

            if (!respuesta.ok) {
                throw new Error(
                    respuesta.status === 401 || respuesta.status === 403
                        ? "Tu sesión no tiene permiso para consultar estos usuarios."
                        : "No se pudieron cargar los usuarios. Verifica el endpoint de la API."
                );
            }

            const datos = await respuesta.json();

            if (datos.success === false) {
                throw new Error(datos.message || "La API no pudo devolver los usuarios.");
            }

            // Admite las respuestas habituales de Flask:
            // {usuarios: [...]}, {data: [...]}, {success: true, usuarios: [...]}
            const lista = Array.isArray(datos)
                ? datos
                : datos.usuarios ?? datos.data ?? datos.resultados;

            if (!Array.isArray(lista)) {
                throw new Error("La respuesta de la API no contiene una lista de usuarios.");
            }

            usuarios = lista;
            renderizar();

        } catch (error) {
            contenedor.innerHTML = `
                <div class="u-cargando">
                    <span class="u-vacio-icono">⚠</span>
                    <strong>No se pudo cargar el directorio</strong>
                    <p>${escapar(error.message || "Ocurrió un error inesperado.")}</p>
                </div>
            `;

            mensajeError.textContent =
                "Comprueba que la ruta GET /admin/usuarios/api esté registrada y que la sesión siga activa.";
            mensajeError.hidden = false;
            contador.textContent = "Error al cargar";
        }
    }

    buscador.addEventListener("input", renderizar);

    // El modal de detalles se mantiene separado.
    // Este evento permite conectarlo desde otro archivo JS.
    contenedor.addEventListener("click", function (evento) {
        const boton = evento.target.closest("[data-usuario-id]");
        if (!boton) return;

        const id = boton.dataset.usuarioId;
        const usuario = usuarios.find(u => String(u.id) === String(id));

        if (!usuario) return;

        window.dispatchEvent(new CustomEvent("usuario:ver-detalle", {
            detail: { usuario }
        }));
    });

    cargarUsuarios();
})();