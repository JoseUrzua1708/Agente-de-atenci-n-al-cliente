
from flask import jsonify, session, url_for
from app.config.database import db
import logging
import traceback

logger = logging.getLogger("SecurityAuditor")


class PerfilController:

    @staticmethod
    def obtener_perfil():
        """Consulta los datos del administrador que inició sesión."""

        # Comprobar que exista una sesión
        if not session.get("user_id"):
            return jsonify({
                "success": False,
                "message": "Tu sesión ha terminado. Inicia sesión nuevamente.",
                "redirect": url_for("auth.login_view")
            }), 401

        # Solo permitir el acceso al administrador
        try:
            if int(session.get("role_id", 0)) != 1:
                return jsonify({
                    "success": False,
                    "message": "No tienes permiso para consultar este perfil."
                }), 403
        except (TypeError, ValueError):
            session.clear()
            return jsonify({
                "success": False,
                "message": "La sesión no es válida.",
                "redirect": url_for("auth.login_view")
            }), 401

        conexion = None
        cursor = None

        try:
            # Conectar con MySQL
            conexion = db.get_connection()
            cursor = conexion.cursor(dictionary=True)

            # Consultar los datos del usuario y su rol
            consulta = """
                SELECT
                    u.id,
                    u.nombre,
                    u.apellidos,
                    u.email,
                    u.telefono,
                    r.nombre AS nombre_rol
                FROM usuarios AS u
                INNER JOIN roles AS r ON r.id = u.rol_id
                WHERE u.id = %s
                  AND u.rol_id = %s
                  AND u.estado = 'ACTIVO'
                  AND r.estado = 1
                LIMIT 1
            """

            cursor.execute(
                consulta,
                (session["user_id"], 1)
            )

            usuario = cursor.fetchone()

            # Si la cuenta ya no está activa, terminar la sesión
            if not usuario:
                session.clear()

                return jsonify({
                    "success": False,
                    "message": "La cuenta no está disponible.",
                    "redirect": url_for("auth.login_view")
                }), 401

            # Preparar únicamente la información necesaria para el frontend
            nombre = usuario.get("nombre") or ""
            apellidos = usuario.get("apellidos") or ""

            return jsonify({
                "success": True,
                "perfil": {
                    "id": usuario["id"],
                    "nombre": nombre,
                    "apellidos": apellidos,
                    "nombre_completo": f"{nombre} {apellidos}".strip(),
                    "correo": usuario.get("email") or "",
                    "telefono": usuario.get("telefono") or "",
                    "rol": usuario.get("nombre_rol") or "ADMINISTRADOR"
                }
            }), 200

        except Exception:
            logger.error(
                "Error al consultar el perfil:\n%s",
                traceback.format_exc()
            )

            return jsonify({
                "success": False,
                "message": "No fue posible consultar el perfil."
            }), 500

        finally:
            if cursor is not None:
                try:
                    cursor.close()
                except Exception:
                    logger.exception("Error al cerrar el cursor del perfil.")

            if conexion is not None:
                try:
                    conexion.close()
                except Exception:
                    logger.exception("Error al cerrar la conexión del perfil.")

    @staticmethod
    def cerrar_sesion():
        """Cierra la sesión actual del administrador."""

        session.clear()

        return jsonify({
            "success": True,
            "message": "Sesión cerrada correctamente.",
            "redirect": url_for("auth.login_view")
        }), 200
