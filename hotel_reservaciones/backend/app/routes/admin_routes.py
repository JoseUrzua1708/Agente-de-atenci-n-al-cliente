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
from app.controllers.huespedes_controller import HuespedesController
from app.config.database import db

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
            or request.path.startswith("/admin/huespedes/")
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


def _verificar_cuenta_admin_activa():
    usuario_id = session.get("user_id")
    conexion = None
    cursor = None

    try:
        conexion = db.get_connection()
        cursor = conexion.cursor(dictionary=True)
        cursor.execute("""
            SELECT id
            FROM usuarios
            WHERE id = %s
              AND rol_id = 1
              AND estado = 'ACTIVO'
            LIMIT 1
        """, (usuario_id,))

        if not cursor.fetchone():
            session.clear()
            return jsonify({
                "success": False,
                "message": "La cuenta no está autorizada o está inactiva.",
                "redirect": url_for("auth.login_view")
            }), 403
    except Exception:
        logger.exception("Error al validar el acceso al módulo de huéspedes.")
        return jsonify({
            "success": False,
            "message": "No fue posible verificar los permisos."
        }), 500
    finally:
        if cursor:
            cursor.close()
        if conexion:
            conexion.close()

    return None


@admin_bp.route("/huespedes", methods=["GET"], endpoint="vista_huespedes")
def vista_huespedes():
    error = _verificar_cuenta_admin_activa()
    if error:
        return error
    return render_template("admin/Menu/huespedes.html")


@admin_bp.route("/huespedes/api", methods=["GET"], endpoint="listar_huespedes")
def listar_huespedes():
    error = _verificar_cuenta_admin_activa()
    if error:
        return error
    return HuespedesController.listar_huespedes()


@admin_bp.route(
    "/huespedes/<int:huesped_id>",
    methods=["GET"],
    endpoint="obtener_huesped"
)
def obtener_huesped(huesped_id):
    error = _verificar_cuenta_admin_activa()
    if error:
        return error
    return HuespedesController.obtener_huesped(huesped_id)


@admin_bp.route("/notificaciones/api", methods=["GET"])
def listar_notificaciones():
    error = _verificar_cuenta_admin_activa()
    if error:
        return error

    conexion = None
    cursor = None
    try:
        conexion = db.get_connection()
        cursor = conexion.cursor(dictionary=True)
        cursor.execute("""
            SELECT n.id, n.reservacion_id, n.asunto, n.mensaje,
                   n.estado, n.fecha_creacion
            FROM notificaciones n
            WHERE n.usuario_id = %s
            ORDER BY n.fecha_creacion DESC, n.id DESC
            LIMIT 30
        """, (session["user_id"],))
        notificaciones = cursor.fetchall()
        for notificacion in notificaciones:
            if notificacion.get("fecha_creacion"):
                notificacion["fecha_creacion"] = notificacion["fecha_creacion"].strftime(
                    "%Y-%m-%d %H:%M"
                )

        cursor.execute("""
            SELECT COUNT(*) AS pendientes
            FROM notificaciones
            WHERE usuario_id = %s AND estado <> 'LEIDA'
        """, (session["user_id"],))
        pendientes = cursor.fetchone()["pendientes"]
        return jsonify({
            "success": True,
            "notificaciones": notificaciones,
            "pendientes": pendientes
        }), 200
    except Exception:
        logger.exception("Error al consultar las notificaciones administrativas.")
        return jsonify({
            "success": False,
            "message": "No fue posible consultar las notificaciones."
        }), 500
    finally:
        if cursor:
            cursor.close()
        if conexion:
            conexion.close()


@admin_bp.route("/notificaciones/api/<int:notificacion_id>/leer", methods=["PATCH"])
def marcar_notificacion_leida(notificacion_id):
    error = _verificar_cuenta_admin_activa()
    if error:
        return error

    conexion = None
    cursor = None
    try:
        conexion = db.get_connection()
        cursor = conexion.cursor()
        cursor.execute("""
            UPDATE notificaciones
            SET estado = 'LEIDA'
            WHERE id = %s AND usuario_id = %s AND estado <> 'LEIDA'
        """, (notificacion_id, session["user_id"]))
        conexion.commit()
        return jsonify({"success": True}), 200
    except Exception:
        if conexion:
            conexion.rollback()
        logger.exception("Error al marcar como leída la notificación %s.", notificacion_id)
        return jsonify({
            "success": False,
            "message": "No fue posible actualizar la notificación."
        }), 500
    finally:
        if cursor:
            cursor.close()
        if conexion:
            conexion.close()


@admin_bp.route("/notificaciones/api/leer-todas", methods=["POST"])
def marcar_todas_notificaciones_leidas():
    error = _verificar_cuenta_admin_activa()
    if error:
        return error

    conexion = None
    cursor = None
    try:
        conexion = db.get_connection()
        cursor = conexion.cursor()
        cursor.execute("""
            UPDATE notificaciones
            SET estado = 'LEIDA'
            WHERE usuario_id = %s AND estado <> 'LEIDA'
        """, (session["user_id"],))
        conexion.commit()
        return jsonify({"success": True}), 200
    except Exception:
        if conexion:
            conexion.rollback()
        logger.exception("Error al marcar todas las notificaciones como leídas.")
        return jsonify({
            "success": False,
            "message": "No fue posible actualizar las notificaciones."
        }), 500
    finally:
        if cursor:
            cursor.close()
        if conexion:
            conexion.close()