import logging

from flask import jsonify
from app.config.database import db


logger = logging.getLogger("HuespedesController")


class HuespedesController:
    @staticmethod
    def listar_huespedes():
        conexion = None
        cursor = None

        try:
            conexion = db.get_connection()
            cursor = conexion.cursor(dictionary=True)
            cursor.execute("""
                SELECT
                    c.id,
                    c.nombre,
                    c.apellidos,
                    c.email,
                    c.telefono,
                    c.fecha_registro,
                    u.estado
                FROM clientes c
                INNER JOIN usuarios u ON u.id = c.usuario_id
                WHERE u.rol_id = 3
                  AND u.estado = 'ACTIVO'
                ORDER BY c.apellidos ASC, c.nombre ASC, c.id ASC
            """)

            huespedes = cursor.fetchall()
            for huesped in huespedes:
                if huesped.get("fecha_registro"):
                    huesped["fecha_registro"] = huesped["fecha_registro"].strftime(
                        "%Y-%m-%d %H:%M"
                    )

            return jsonify({"success": True, "huespedes": huespedes}), 200

        except Exception:
            logger.exception("Error al consultar huéspedes activos.")
            return jsonify({
                "success": False,
                "message": "No fue posible consultar los huéspedes."
            }), 500
        finally:
            if cursor:
                cursor.close()
            if conexion:
                conexion.close()

    @staticmethod
    def obtener_huesped(huesped_id):
        conexion = None
        cursor = None

        try:
            conexion = db.get_connection()
            cursor = conexion.cursor(dictionary=True)
            cursor.execute("""
                SELECT
                    c.id,
                    c.nombre,
                    c.apellidos,
                    c.email,
                    c.telefono,
                    c.fecha_registro,
                    u.estado
                FROM clientes c
                INNER JOIN usuarios u ON u.id = c.usuario_id
                WHERE c.id = %s
                  AND u.rol_id = 3
                  AND u.estado = 'ACTIVO'
                LIMIT 1
            """, (huesped_id,))

            huesped = cursor.fetchone()
            if not huesped:
                return jsonify({
                    "success": False,
                    "message": "El huésped no existe o no está activo."
                }), 404

            if huesped.get("fecha_registro"):
                huesped["fecha_registro"] = huesped["fecha_registro"].strftime(
                    "%Y-%m-%d %H:%M"
                )

            return jsonify({"success": True, "huesped": huesped}), 200

        except Exception:
            logger.exception("Error al consultar el detalle del huésped %s.", huesped_id)
            return jsonify({
                "success": False,
                "message": "No fue posible consultar el huésped."
            }), 500
        finally:
            if cursor:
                cursor.close()
            if conexion:
                conexion.close()
