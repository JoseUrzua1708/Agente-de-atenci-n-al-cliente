import logging
from flask import jsonify
from app.config.database import db

logger = logging.getLogger("PagosController")


class PagosController:

    @staticmethod
    def obtener_indicadores():
        conexion = None
        cursor = None

        try:
            conexion = db.get_connection()
            cursor = conexion.cursor(dictionary=True)

            cursor.execute("""
                SELECT COALESCE(SUM(monto), 0) AS total
                FROM pagos
                WHERE estado = 'APROBADO'
                  AND fecha_pago >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
                  AND fecha_pago < DATE_ADD(
                      DATE_FORMAT(CURDATE(), '%Y-%m-01'),
                      INTERVAL 1 MONTH
                  )
            """)

            resultado = cursor.fetchone()

            return jsonify({
                "success": True,
                "total": float(resultado["total"] or 0)
            }), 200

        except Exception:
            logger.exception("Error al obtener indicadores de ingresos")
            return jsonify({
                "success": False,
                "message": "No se pudieron cargar los ingresos."
            }), 500

        finally:
            if cursor:
                cursor.close()
            if conexion:
                conexion.close()
