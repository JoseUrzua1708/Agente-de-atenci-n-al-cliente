import logging
import re

from flask import request, jsonify
from werkzeug.security import generate_password_hash
from mysql.connector import Error

from app.config.database import db


logger = logging.getLogger("SecurityAuditor")


class UsuariosController:

    # =========================================================
    # FUNCIONES AUXILIARES
    # =========================================================

    @staticmethod
    def _respuesta(mensaje, status=400, **datos):
        return jsonify({
            "success": False,
            "message": mensaje,
            **datos
        }), status

    @staticmethod
    def _validar_correo(email):
        patron = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
        return bool(re.match(patron, email))

    @staticmethod
    def _validar_datos(data, es_creacion=True):
        nombre = data.get("nombre", "").strip()
        apellidos = data.get("apellidos", "").strip()
        email = data.get("email", "").strip().lower()
        telefono = data.get("telefono", "").strip()

        if not nombre:
            return None, "El nombre es obligatorio."

        if len(nombre) > 100:
            return None, "El nombre no puede superar 100 caracteres."

        if len(apellidos) > 150:
            return None, "Los apellidos no pueden superar 150 caracteres."

        if len(telefono) > 25:
            return None, "El teléfono no puede superar 25 caracteres."

        if not email:
            return None, "El correo electrónico es obligatorio."

        if len(email) > 150 or not UsuariosController._validar_correo(email):
            return None, "Ingresa un correo electrónico válido."

        if es_creacion:
            password = data.get("password", "")
            confirmar = data.get("confirmar_password", "")

            if not isinstance(password, str) or len(password) < 8:
                return None, "La contraseña debe tener al menos 8 caracteres."

            if password != confirmar:
                return None, "Las contraseñas no coinciden."

        return {
            "nombre": nombre,
            "apellidos": apellidos or None,
            "email": email,
            "telefono": telefono or None
        }, None

    @staticmethod
    def _conexion():
        return db.get_connection()

    # =========================================================
    # LISTAR ADMINISTRADORES Y RECEPCIONISTAS
    # GET /admin/usuarios/api
    # =========================================================

    @staticmethod
    def listar_usuarios():
        conexion = None
        cursor = None

        try:
            conexion = UsuariosController._conexion()
            cursor = conexion.cursor(dictionary=True)

            cursor.execute("""
                SELECT
                    u.id,
                    u.nombre,
                    u.apellidos,
                    u.email,
                    u.telefono,
                    u.estado,
                    u.ultimo_acceso,
                    u.fecha_creacion,
                    u.fecha_actualizacion,
                    r.id AS rol_id,
                    r.nombre AS rol
                FROM usuarios u
                INNER JOIN roles r ON r.id = u.rol_id
                WHERE u.rol_id IN (1, 2)
                ORDER BY
                    u.rol_id ASC,
                    CASE WHEN u.estado = 'ACTIVO' THEN 0 ELSE 1 END,
                    u.nombre ASC
            """)

            usuarios = cursor.fetchall()

            for usuario in usuarios:
                for campo in (
                    "ultimo_acceso",
                    "fecha_creacion",
                    "fecha_actualizacion"
                ):
                    if usuario.get(campo):
                        usuario[campo] = usuario[campo].strftime(
                            "%Y-%m-%d %H:%M:%S"
                        )

            return jsonify({
                "success": True,
                "usuarios": usuarios
            }), 200

        except Error:
            logger.exception("Error al consultar usuarios administrativos.")
            return UsuariosController._respuesta(
                "No fue posible consultar los usuarios.",
                500
            )

        finally:
            if cursor:
                cursor.close()
            if conexion:
                conexion.close()

    # =========================================================
    # CREAR RECEPCIONISTA O ADMINISTRADOR
    # POST /recepcionistas
    # POST /administradores
    # =========================================================

    @staticmethod
    def crear_usuario(rol_id):
        conexion = None
        cursor = None

        try:
            data = request.get_json(silent=True)

            if not isinstance(data, dict):
                return UsuariosController._respuesta(
                    "Los datos enviados no son válidos."
                )

            datos, error = UsuariosController._validar_datos(
                data,
                es_creacion=True
            )

            if error:
                return UsuariosController._respuesta(error)

            conexion = UsuariosController._conexion()
            cursor = conexion.cursor(dictionary=True)

            # Comprobar que el correo no esté registrado.
            cursor.execute(
                "SELECT id FROM usuarios WHERE email = %s LIMIT 1",
                (datos["email"],)
            )

            if cursor.fetchone():
                return UsuariosController._respuesta(
                    "El correo electrónico ya está registrado.",
                    409
                )

            # Verificar que el rol exista y esté activo.
            cursor.execute("""
                SELECT id
                FROM roles
                WHERE id = %s AND estado = 1
                LIMIT 1
            """, (rol_id,))

            if not cursor.fetchone():
                return UsuariosController._respuesta(
                    "El rol seleccionado no está disponible.",
                    400
                )

            password_hash = generate_password_hash(
                data["password"]
            )

            cursor.execute("""
                INSERT INTO usuarios (
                    rol_id,
                    nombre,
                    apellidos,
                    email,
                    password_hash,
                    telefono,
                    estado
                )
                VALUES (%s, %s, %s, %s, %s, %s, 'ACTIVO')
            """, (
                rol_id,
                datos["nombre"],
                datos["apellidos"],
                datos["email"],
                password_hash,
                datos["telefono"]
            ))

            usuario_id = cursor.lastrowid
            conexion.commit()

            return jsonify({
                "success": True,
                "message": (
                    "Recepcionista creado correctamente."
                    if rol_id == 2
                    else "Administrador creado correctamente."
                ),
                "usuario_id": usuario_id
            }), 201

        except Error as error:
            if conexion:
                conexion.rollback()

            # MySQL: clave duplicada.
            if getattr(error, "errno", None) == 1062:
                return UsuariosController._respuesta(
                    "El correo electrónico ya está registrado.",
                    409
                )

            logger.exception("Error al crear usuario administrativo.")
            return UsuariosController._respuesta(
                "No fue posible crear la cuenta.",
                500
            )

        except Exception:
            if conexion:
                conexion.rollback()

            logger.exception("Error inesperado al crear usuario.")
            return UsuariosController._respuesta(
                "Ocurrió un error al crear la cuenta.",
                500
            )

        finally:
            if cursor:
                cursor.close()
            if conexion:
                conexion.close()

    # =========================================================
    # EDITAR RECEPCIONISTA
    # PUT /admin/usuarios/<id>
    # =========================================================

    @staticmethod
    def editar_recepcionista(usuario_id):
        conexion = None
        cursor = None

        try:
            data = request.get_json(silent=True)

            if not isinstance(data, dict):
                return UsuariosController._respuesta(
                    "Los datos enviados no son válidos."
                )

            datos, error = UsuariosController._validar_datos(
                data,
                es_creacion=False
            )

            if error:
                return UsuariosController._respuesta(error)

            conexion = UsuariosController._conexion()
            cursor = conexion.cursor(dictionary=True)

            cursor.execute("""
                SELECT id, rol_id
                FROM usuarios
                WHERE id = %s
                LIMIT 1
            """, (usuario_id,))

            usuario = cursor.fetchone()

            if not usuario:
                return UsuariosController._respuesta(
                    "El usuario no existe.",
                    404
                )

            if usuario["rol_id"] != 2:
                return UsuariosController._respuesta(
                    "Esta operación solo permite editar recepcionistas.",
                    403
                )

            cursor.execute("""
                SELECT id
                FROM usuarios
                WHERE email = %s AND id <> %s
                LIMIT 1
            """, (datos["email"], usuario_id))

            if cursor.fetchone():
                return UsuariosController._respuesta(
                    "El correo electrónico ya pertenece a otra cuenta.",
                    409
                )

            password = data.get("password", "")
            confirmar = data.get("confirmar_password", "")

            if password or confirmar:
                if not isinstance(password, str) or len(password) < 8:
                    return UsuariosController._respuesta(
                        "La nueva contraseña debe tener al menos 8 caracteres."
                    )

                if password != confirmar:
                    return UsuariosController._respuesta(
                        "Las contraseñas no coinciden."
                    )

                cursor.execute("""
                    UPDATE usuarios
                    SET nombre = %s,
                        apellidos = %s,
                        email = %s,
                        telefono = %s,
                        password_hash = %s
                    WHERE id = %s AND rol_id = 2
                """, (
                    datos["nombre"],
                    datos["apellidos"],
                    datos["email"],
                    datos["telefono"],
                    generate_password_hash(password),
                    usuario_id
                ))
            else:
                cursor.execute("""
                    UPDATE usuarios
                    SET nombre = %s,
                        apellidos = %s,
                        email = %s,
                        telefono = %s
                    WHERE id = %s AND rol_id = 2
                """, (
                    datos["nombre"],
                    datos["apellidos"],
                    datos["email"],
                    datos["telefono"],
                    usuario_id
                ))

            conexion.commit()

            return jsonify({
                "success": True,
                "message": "Recepcionista actualizado correctamente."
            }), 200

        except Error as error:
            if conexion:
                conexion.rollback()

            if getattr(error, "errno", None) == 1062:
                return UsuariosController._respuesta(
                    "El correo electrónico ya está registrado.",
                    409
                )

            logger.exception("Error al editar recepcionista.")
            return UsuariosController._respuesta(
                "No fue posible actualizar la cuenta.",
                500
            )

        except Exception:
            if conexion:
                conexion.rollback()

            logger.exception("Error inesperado al editar recepcionista.")
            return UsuariosController._respuesta(
                "Ocurrió un error al actualizar la cuenta.",
                500
            )

        finally:
            if cursor:
                cursor.close()
            if conexion:
                conexion.close()

    # =========================================================
    # INACTIVAR O REACTIVAR CUENTA
    # PATCH /admin/usuarios/<id>/estado
    # =========================================================

    @staticmethod
    def cambiar_estado(usuario_id):
        conexion = None
        cursor = None

        try:
            data = request.get_json(silent=True)

            if not isinstance(data, dict):
                return UsuariosController._respuesta(
                    "Los datos enviados no son válidos."
                )

            estado = data.get("estado")

            if estado not in ("ACTIVO", "INACTIVO"):
                return UsuariosController._respuesta(
                    "El estado debe ser ACTIVO o INACTIVO."
                )

            from flask import session

            try:
                administrador_actual = int(session["user_id"])
            except (KeyError, TypeError, ValueError):
                return UsuariosController._respuesta(
                    "La sesión no es válida.",
                    401
                )

            if administrador_actual == int(usuario_id) and estado == "INACTIVO":
                return UsuariosController._respuesta(
                    "No puedes inactivar tu propia cuenta.",
                    403
                )

            conexion = UsuariosController._conexion()
            cursor = conexion.cursor(dictionary=True)

            # Bloquear la fila del usuario durante la comprobación.
            cursor.execute("""
                SELECT id, rol_id, estado
                FROM usuarios
                WHERE id = %s AND rol_id IN (1, 2)
                FOR UPDATE
            """, (usuario_id,))

            usuario = cursor.fetchone()

            if not usuario:
                return UsuariosController._respuesta(
                    "No se encontró la cuenta administrativa.",
                    404
                )

            # No permitir dejar el sistema sin administradores activos.
            if usuario["rol_id"] == 1 and estado == "INACTIVO":
                cursor.execute("""
                    SELECT COUNT(*) AS total
                    FROM usuarios
                    WHERE rol_id = 1
                      AND estado = 'ACTIVO'
                """)

                resultado = cursor.fetchone()

                if resultado["total"] <= 1 and usuario["estado"] == "ACTIVO":
                    return UsuariosController._respuesta(
                        "No puedes inactivar al último administrador activo.",
                        409
                    )

            cursor.execute("""
                UPDATE usuarios
                SET estado = %s
                WHERE id = %s AND rol_id IN (1, 2)
            """, (estado, usuario_id))

            conexion.commit()

            mensaje = (
                "Cuenta activada correctamente."
                if estado == "ACTIVO"
                else "Cuenta inactivada correctamente."
            )

            return jsonify({
                "success": True,
                "message": mensaje,
                "estado": estado
            }), 200

        except Error:
            if conexion:
                conexion.rollback()

            logger.exception("Error al cambiar estado de usuario.")
            return UsuariosController._respuesta(
                "No fue posible cambiar el estado de la cuenta.",
                500
            )

        except Exception:
            if conexion:
                conexion.rollback()

            logger.exception("Error inesperado al cambiar estado.")
            return UsuariosController._respuesta(
                "Ocurrió un error al cambiar el estado.",
                500
            )

        finally:
            if cursor:
                cursor.close()
            if conexion:
                conexion.close()
