from app.config.database import db
from app.controllers.reservaciones_controller import ReservacionesController
from datetime import date
from flask import jsonify, request, session


def obtener_conexion():
    return db.get_connection()

def listar_habitaciones():
    entrada = request.args.get("entrada")
    salida = request.args.get("salida")
    huespedes = request.args.get("huespedes", type=int, default=1)

    if huespedes < 1 or huespedes > 20:
        return jsonify({"error": "Número de huéspedes no válido."}), 400
    if bool(entrada) != bool(salida):
        return jsonify({"error": "Indica las fechas de entrada y salida."}), 400
    if entrada and salida:
        try:
            fecha_entrada, fecha_salida = date.fromisoformat(entrada), date.fromisoformat(salida)
        except ValueError:
            return jsonify({"error": "Formato de fecha no válido."}), 400
        if fecha_salida <= fecha_entrada:
            return jsonify({"error": "La salida debe ser posterior a la entrada."}), 400

    try:
        conn = obtener_conexion()
        cursor = conn.cursor(dictionary=True)
        sql = """
            SELECT h.id, h.numero, h.piso, h.descripcion, h.precio, h.estado,
                   th.nombre AS tipo, th.capacidad_adultos, th.capacidad_ninos,
                   th.amenidades
            FROM habitaciones h
            INNER JOIN tipos_habitacion th ON th.id = h.tipo_id
            WHERE h.estado NOT IN ('MANTENIMIENTO', 'INACTIVA')
              AND th.estado = 1
              AND (th.capacidad_adultos + th.capacidad_ninos) >= %s
        """
        params = [huespedes]
        if entrada and salida:
            sql += """
              AND NOT EXISTS (
                SELECT 1 FROM reservaciones r
                WHERE r.habitacion_id = h.id
                  AND r.estado IN ('PENDIENTE', 'CONFIRMADA', 'CHECK_IN')
                  AND r.fecha_entrada < %s AND r.fecha_salida > %s
              )
            """
            params.extend([salida, entrada])
        else:
            sql += " AND h.estado = 'DISPONIBLE'"
        sql += " ORDER BY h.precio ASC"
        cursor.execute(sql, params)
        resultado = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(resultado)
    except NotImplementedError as exc:
        return jsonify({"error": str(exc)}), 501
    except Exception:
        return jsonify({"error": "No fue posible consultar las habitaciones."}), 500


def obtener_mis_reservaciones():
    # Ajusta esta clave a la sesión que realmente establece el login del proyecto.
    usuario_id = session.get("user_id")
    if not usuario_id:
        return jsonify({"error": "Inicia sesión para consultar tus reservaciones."}), 401
    try:
        conn = obtener_conexion()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT r.codigo_reservacion, r.fecha_entrada, r.fecha_salida,
                   r.total, r.estado, h.numero AS habitacion,
                   th.nombre AS tipo_habitacion
            FROM reservaciones r
            INNER JOIN clientes c ON c.id = r.cliente_id
            INNER JOIN habitaciones h ON h.id = r.habitacion_id
            INNER JOIN tipos_habitacion th ON th.id = h.tipo_id
            WHERE c.usuario_id = %s
            ORDER BY r.fecha_reservacion DESC
        """, (usuario_id,))
        resultado = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(resultado)
    except NotImplementedError as exc:
        return jsonify({"error": str(exc)}), 501
    except Exception:
        return jsonify({"error": "No fue posible consultar tus reservaciones."}), 500


def obtener_perfil():
    usuario_id = session.get("user_id")
    if not usuario_id:
        return jsonify({"error": "Inicia sesión para consultar tu perfil."}), 401
    try:
        conn = obtener_conexion()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT u.nombre, u.apellidos, u.email, u.telefono
            FROM usuarios u
            WHERE u.id = %s AND u.rol_id = 3 AND u.estado = 'ACTIVO'
            LIMIT 1
        """, (usuario_id,))
        perfil = cursor.fetchone()
        cursor.close()
        conn.close()
        if not perfil:
            return jsonify({"error": "No se encontró el perfil del cliente."}), 404
        return jsonify(perfil)
    except NotImplementedError as exc:
        return jsonify({"error": str(exc)}), 501
    except Exception:
        return jsonify({"error": "No fue posible consultar el perfil."}), 500


def crear_reservacion():
    usuario_id = session.get("user_id")
    if not usuario_id:
        return jsonify({"error": "Inicia sesión para realizar una reservación."}), 401
    data = request.get_json(silent=True) or {}
    return ReservacionesController.crear_reservacion(data, origen_forzado="WEB")
