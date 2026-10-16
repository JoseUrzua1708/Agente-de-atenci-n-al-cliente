from flask import render_template, session, redirect, url_for
from app.config.database import db
import logging

logger = logging.getLogger("SecurityAuditor")

# Coincide con roles.id en la base de datos
ROL_RECEPCIONISTA = 2


class RecepcionController:

    @staticmethod
    def render_inicio():
        """Muestra el inicio de recepción con los indicadores del día."""
        return render_template(
            "recepcion/inicio.html",
            usuario=RecepcionController._obtener_usuario(),
            indicadores=RecepcionController._obtener_indicadores()
        )

    @staticmethod
    def cerrar_sesion():
        """Cierra la sesión y regresa al login."""
        session.clear()
        return redirect(url_for("auth.login_view"))

    @staticmethod
    def _consultar(consulta, parametros=(), uno=False):
        """Ejecuta una consulta de lectura y libera la conexión siempre."""
        conexion = db.get_connection()
        cursor = conexion.cursor(dictionary=True)
        try:
            cursor.execute(consulta, parametros)
            return cursor.fetchone() if uno else cursor.fetchall()
        finally:
            cursor.close()
            conexion.close()

    @staticmethod
    def _ejecutar(consulta, parametros=()):
        """Ejecuta una escritura con commit; regresa las filas afectadas."""
        conexion = db.get_connection()
        cursor = conexion.cursor()
        try:
            cursor.execute(consulta, parametros)
            conexion.commit()
            return cursor.rowcount
        except Exception:
            conexion.rollback()
            raise
        finally:
            cursor.close()
            conexion.close()

    @staticmethod
    def _obtener_usuario():
        """Nombre de la recepcionista para el encabezado."""
        try:
            usuario = RecepcionController._consultar(
                "SELECT nombre, apellidos FROM usuarios WHERE id = %s LIMIT 1",
                (session["user_id"],),
                uno=True
            ) or {}
        except Exception:
            logger.exception("Error al consultar el usuario de recepción.")
            usuario = {}

        nombre = usuario.get("nombre") or "Recepción"
        apellidos = usuario.get("apellidos") or ""
        return {
            "nombre": nombre,
            "nombre_completo": f"{nombre} {apellidos}".strip(),
            "iniciales": (nombre[:1] + apellidos[:1]).upper() or "RE"
        }

    @staticmethod
    def _obtener_indicadores():
        """Conteos del día; si la BD falla se muestra '--' sin romper la vista."""
        consulta = """
            SELECT
                (SELECT COUNT(*) FROM solicitudes
                  WHERE estado IN ('ABIERTA', 'EN_PROCESO')) AS solicitudes,
                (SELECT COUNT(*) FROM reservaciones
                  WHERE fecha_entrada = CURDATE()
                    AND estado IN ('PENDIENTE', 'CONFIRMADA')) AS llegadas,
                (SELECT COUNT(*) FROM reservaciones
                  WHERE fecha_salida = CURDATE()
                    AND estado = 'CHECK_IN') AS salidas,
                (SELECT COUNT(*) FROM habitaciones
                  WHERE estado = 'DISPONIBLE') AS disponibles,
                (SELECT COUNT(*) FROM habitaciones
                  WHERE estado IN ('LIMPIEZA', 'MANTENIMIENTO')) AS en_servicio
        """
        try:
            return RecepcionController._consultar(consulta, uno=True)
        except Exception:
            logger.exception("Error al consultar los indicadores de recepción.")
            return {}
