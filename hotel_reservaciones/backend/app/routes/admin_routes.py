from flask import (
    Blueprint,
    render_template,
    session,
    jsonify,
    url_for,
    request,
)

from app.controllers.auth_controller import AuthController
from app.controllers.perfil_controller import PerfilController

import logging

logger = logging.getLogger("SecurityAuditor")

admin_bp = Blueprint(
    "admin",
    __name__,
    url_prefix="/admin"
)


# ============================================================
# SEGURIDAD: PROTEGER TODAS LAS RUTAS ADMINISTRATIVAS
# ============================================================
@admin_bp.before_request
def protect_admin_section():
    """
    Verifica que exista una sesión autenticada y que el usuario
    tenga el rol de administrador antes de acceder a /admin.
    """

    # Validar el rol de forma segura para evitar errores de conversión
    try:
        role_id = int(session.get("role_id", 0))
    except (TypeError, ValueError):
        role_id = 0

    # Verificar sesión y privilegios administrativos
    if not session.get("user_id") or role_id != 1:

        logger.warning(
            "Intento de acceso no autorizado a la sección administrativa."
        )

        # Las solicitudes AJAX/API reciben JSON para poder redirigir
        # al login desde el JavaScript.
        if (
            request.path.endswith("/perfil/datos")
            or request.path.endswith("/cerrar-sesion")
        ):
            return jsonify({
                "success": False,
                "message": (
                    "Tu sesión ha terminado o no tienes autorización. "
                    "Inicia sesión nuevamente."
                ),
                "redirect": url_for("auth.login_view")
            }), 401

        # Para las páginas administrativas se conserva el comportamiento
        # de tu código original.
        return render_template("login.html"), 403


# ============================================================
# PANEL PRINCIPAL
# ============================================================
@admin_bp.route("/panel", methods=["GET"])
def admin_panel_view():
    """Muestra el panel principal del administrador."""

    return AuthController.render_admin_panel()


# ============================================================
# PERFIL: OBTENER DATOS DEL ADMINISTRADOR
# ============================================================
@admin_bp.route("/perfil/datos", methods=["GET"])
def obtener_datos_perfil():
    """Devuelve los datos del administrador autenticado."""

    return PerfilController.obtener_perfil()


# ============================================================
# AUTENTICACIÓN: CERRAR SESIÓN
# ============================================================
@admin_bp.route("/cerrar-sesion", methods=["POST"])
def cerrar_sesion():
    """Cierra la sesión del administrador."""

    return PerfilController.cerrar_sesion()

# ============================================================
# INICIO: RESUMEN GENERAL DEL ADMINISTRADOR
# ============================================================
@admin_bp.route("/inicio", methods=["GET"])
def admin_inicio_view():
    """Muestra el resumen general del administrador."""

    return AuthController.render_admin_panel()