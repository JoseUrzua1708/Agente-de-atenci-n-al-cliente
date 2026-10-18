from flask import jsonify, session, url_for
from app.config.database import db
import logging
import traceback

logger = logging.getLogger("HabitacionesController")


class HabitacionesController:

    @staticmethod
    def _verificar_sesion_admin():
        """Valida que el usuario tenga sesión activa y sea Administrador (role_id = 1)."""
        if not session.get("user_id"):
            return jsonify({
                "success": False,
                "message": "Tu sesión ha terminado. Inicia sesión nuevamente.",
                "redirect": url_for("auth.login_view")
            }), 401

        try:
            if int(session.get("role_id", 0)) != 1:
                return jsonify({
                    "success": False,
                    "message": "No tienes permiso para realizar esta acción."
                }), 403
        except (TypeError, ValueError):
            session.clear()
            return jsonify({
                "success": False,
                "message": "La sesión no es válida.",
                "redirect": url_for("auth.login_view")
            }), 401
        
        return None  # Todo OK

    @staticmethod
    def obtener_tipos_habitacion():
        """Obtiene los tipos de habitación activos para llenar el menú desplegable."""
        error_sesion = HabitacionesController._verificar_sesion_admin()
        if error_sesion:
            return error_sesion

        conexion = None
        cursor = None
        try:
            conexion = db.get_connection()
            cursor = conexion.cursor(dictionary=True)
            
            consulta = """
                SELECT id, nombre, descripcion, capacidad_adultos, capacidad_ninos, precio_base, amenidades
                FROM tipos_habitacion
                WHERE estado = 1
            """
            cursor.execute(consulta)
            tipos = cursor.fetchall()

            return jsonify({
                "success": True,
                "tipos": tipos
            }), 200

        except Exception:
            logger.error("Error al consultar tipos de habitación:\n%s", traceback.format_exc())
            return jsonify({"success": False, "message": "Error interno al obtener los tipos de habitación."}), 500
        finally:
            if cursor: cursor.close()
            if conexion: conexion.close()

    @staticmethod
    def listar_habitaciones():
        """Lista todas las habitaciones utilizando la vista existente vw_estado_habitaciones."""
        error_sesion = HabitacionesController._verificar_sesion_admin()
        if error_sesion:
            return error_sesion

        conexion = None
        cursor = None
        try:
            conexion = db.get_connection()
            cursor = conexion.cursor(dictionary=True)
            
            # Usando la vista que ya creaste en tu base de datos
            consulta = """
                SELECT h.id, h.numero, h.piso, th.nombre AS tipo, th.id AS tipo_id, h.precio, h.estado, h.descripcion
                FROM habitaciones h
                INNER JOIN tipos_habitacion th ON th.id = h.tipo_id
            """
            cursor.execute(consulta)
            habitaciones = cursor.fetchall()

            return jsonify({
                "success": True,
                "habitaciones": habitaciones
            }), 200

        except Exception:
            logger.error("Error al listar habitaciones:\n%s", traceback.format_exc())
            return jsonify({"success": False, "message": "Error interno al listar habitaciones."}), 500
        finally:
            if cursor: cursor.close()
            if conexion: conexion.close()

    @staticmethod
    def crear_habitacion(data):
        """Crea una nueva habitación en la base de datos."""
        error_sesion = HabitacionesController._verificar_sesion_admin()
        if error_sesion:
            return error_sesion

        tipo_id = data.get('tipo_id')
        numero = data.get('numero')
        piso = data.get('piso')
        precio = data.get('precio')
        descripcion = data.get('descripcion', '')
        estado = data.get('estado', 'DISPONIBLE')

        if not tipo_id or not numero or not piso or not precio:
            return jsonify({"success": False, "message": "Faltan campos obligatorios."}), 400

        conexion = None
        cursor = None
        try:
            conexion = db.get_connection()
            cursor = conexion.cursor()

            consulta = """
                INSERT INTO habitaciones (tipo_id, numero, piso, precio, descripcion, estado)
                VALUES (%s, %s, %s, %s, %s, %s)
            """
            cursor.execute(consulta, (tipo_id, numero, piso, precio, descripcion, estado))
            conexion.commit()

            return jsonify({
                "success": True,
                "message": "Habitación creada correctamente."
            }), 201

        except Exception as e:
            if conexion: conexion.rollback()
            logger.error("Error al crear habitación:\n%s", traceback.format_exc())
            return jsonify({"success": False, "message": "Error al registrar la habitación (quizá el número ya existe)."}), 500
        finally:
            if cursor: cursor.close()
            if conexion: conexion.close()

    @staticmethod
    def actualizar_habitacion(id, data):
        """Actualiza los datos de una habitación existente."""
        error_sesion = HabitacionesController._verificar_sesion_admin()
        if error_sesion:
            return error_sesion

        tipo_id = data.get('tipo_id')
        numero = data.get('numero')
        piso = data.get('piso')
        precio = data.get('precio')
        descripcion = data.get('descripcion', '')
        estado = data.get('estado')

        if not tipo_id or not numero or not piso or not precio or not estado:
            return jsonify({"success": False, "message": "Faltan campos obligatorios para actualizar."}), 400

        conexion = None
        cursor = None
        try:
            conexion = db.get_connection()
            cursor = conexion.cursor()

            consulta = """
                UPDATE habitaciones 
                SET tipo_id = %s, numero = %s, piso = %s, precio = %s, descripcion = %s, estado = %s
                WHERE id = %s
            """
            cursor.execute(consulta, (tipo_id, numero, piso, precio, descripcion, estado, id))
            conexion.commit()

            return jsonify({
                "success": True,
                "message": f"Habitación {numero} actualizada correctamente."
            }), 200

        except Exception:
            if conexion: conexion.rollback()
            logger.error("Error al actualizar habitación:\n%s", traceback.format_exc())
            return jsonify({"success": False, "message": "Error al actualizar la habitación."}), 500
        finally:
            if cursor: cursor.close()
            if conexion: conexion.close()

    @staticmethod
    def desactivar_habitacion(id):
        """Realiza la baja lógica cambiando el estado a 'INACTIVA' (en lugar de eliminar)."""
        error_sesion = HabitacionesController._verificar_sesion_admin()
        if error_sesion:
            return error_sesion

        conexion = None
        cursor = None
        try:
            conexion = db.get_connection()
            cursor = conexion.cursor()

            consulta = "UPDATE habitaciones SET estado = 'INACTIVA' WHERE id = %s"
            cursor.execute(consulta, (id,))
            conexion.commit()

            return jsonify({
                "success": True,
                "message": "Habitación dada de baja (inactiva) correctamente."
            }), 200

        except Exception:
            if conexion: conexion.rollback()
            logger.error("Error al dar de baja la habitación:\n%s", traceback.format_exc())
            return jsonify({"success": False, "message": "Error al procesar la baja de la habitación."}), 500
        finally:
            if cursor: cursor.close()
            if conexion: conexion.close()