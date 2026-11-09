from flask import (
    Blueprint,
    render_template,
    jsonify,
    url_for,
    session
)

from app.controllers.huespedes_controller import HuespedesController
from app.config.database import db

import logging

logger = logging.getLogger("SecurityAuditor")

huespedes_bp = Blueprint(
    "huespedes",
    __name__,
    url_prefix="/admin/huespedes"
)


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


@huespedes_bp.route("", methods=["GET"])
def vista_huespedes():
    error = _verificar_cuenta_admin_activa()

    if error:
        return error

    return render_template("admin/Menu/huespedes.html")


@huespedes_bp.route("/api", methods=["GET"])
def listar_huespedes():
    error = _verificar_cuenta_admin_activa()

    if error:
        return error

    return HuespedesController.listar_huespedes()


@huespedes_bp.route("/indicadores", methods=["GET"])
def indicadores_huespedes():
    error = _verificar_cuenta_admin_activa()

    if error:
        return error

    return HuespedesController.obtener_indicadores()


@huespedes_bp.route("/<int:huesped_id>", methods=["GET"])
def obtener_huesped(huesped_id):
    error = _verificar_cuenta_admin_activa()

    if error:
        return error

    return HuespedesController.obtener_huesped(huesped_id)

@huespedes_bp.before_request
def proteger_huespedes():
    try:
        role_id = int(session.get("role_id", 0))
    except (TypeError, ValueError):
        role_id = 0

    if not session.get("user_id") or role_id != 1:
        return jsonify({
            "success": False,
            "message": "Tu sesión ha terminado o no tienes autorización.",
            "redirect": url_for("auth.login_view")
        }), 401