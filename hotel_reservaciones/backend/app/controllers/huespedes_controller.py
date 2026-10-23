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
                                        u.estado,
                                        h.numero AS numero_habitacion,
                                        th.nombre AS tipo_habitacion
                FROM clientes c
                INNER JOIN usuarios u ON u.id = c.usuario_id
                                LEFT JOIN reservaciones r ON r.id = (
                                        SELECT r2.id
                                        FROM reservaciones r2
                                        WHERE r2.cliente_id = c.id
                                            AND r2.estado = 'CHECK_IN'
                                            AND CURDATE() >= r2.fecha_entrada
                                            AND CURDATE() <= r2.fecha_salida
                                        ORDER BY r2.fecha_reservacion DESC, r2.id DESC
                                        LIMIT 1
                                )
                                LEFT JOIN habitaciones h ON h.id = r.habitacion_id
                                LEFT JOIN tipos_habitacion th ON th.id = h.tipo_id
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
                    u.estado,
                    h.numero AS numero_habitacion,
                    th.nombre AS tipo_habitacion
                FROM clientes c
                INNER JOIN usuarios u ON u.id = c.usuario_id
                LEFT JOIN reservaciones r ON r.id = (
                    SELECT r2.id
                    FROM reservaciones r2
                    WHERE r2.cliente_id = c.id
                      AND r2.estado = 'CHECK_IN'
                      AND CURDATE() >= r2.fecha_entrada
                                            AND CURDATE() <= r2.fecha_salida
                    ORDER BY r2.fecha_reservacion DESC, r2.id DESC
                    LIMIT 1
                )
                LEFT JOIN habitaciones h ON h.id = r.habitacion_id
                LEFT JOIN tipos_habitacion th ON th.id = h.tipo_id
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
