from datetime import date, datetime
from decimal import Decimal, InvalidOperation
import logging
import secrets
import traceback

from flask import jsonify, session, url_for

from app.config.database import db

logger = logging.getLogger("ReservacionesController")

# Valores del ENUM de la tabla reservaciones
ESTADOS = ("PENDIENTE", "CONFIRMADA", "CHECK_IN", "CHECK_OUT", "CANCELADA", "NO_SHOW")
ESTADOS_ACTIVOS = ("PENDIENTE", "CONFIRMADA", "CHECK_IN")   # ocupan la habitación
ESTADOS_CERRADOS = ("CANCELADA", "CHECK_OUT", "NO_SHOW")    # ya no se pueden modificar
ESTADOS_CANCELABLES = ("PENDIENTE", "CONFIRMADA")
ORIGENES = ("WEB", "RECEPCION", "CHATBOT", "TELEFONO")


class ErrorNegocio(Exception):
    """Error de validación o regla de negocio que se devuelve al usuario."""

    def __init__(self, mensaje, codigo=400):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.codigo = codigo


class ReservacionesController:

    # ------------------------------------------------------------
    # SESIÓN
    # ------------------------------------------------------------
    @staticmethod
    def _verificar_sesion_admin():
        """Valida que exista sesión activa y que el usuario sea Administrador (role_id = 1)."""
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

    # ------------------------------------------------------------
    # UTILIDADES
    # ------------------------------------------------------------
    @staticmethod
    def _parsear_fecha(valor):
        try:
            return datetime.strptime(str(valor), "%Y-%m-%d").date()
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _decimal_opcional(valor, nombre):
        """None si no se envió; ErrorNegocio si es inválido o negativo."""
        if valor is None or valor == "":
            return None
        try:
            numero = Decimal(str(valor))
        except InvalidOperation:
            raise ErrorNegocio(f"El campo {nombre} no es un número válido.") from None
        if not numero.is_finite() or numero < 0:
            raise ErrorNegocio(f"El campo {nombre} debe ser un número mayor o igual a cero.")
        return numero

    @staticmethod
    def _serializar(fila):
        """Convierte fechas y decimales a tipos que JSON entiende."""
        for campo in ("fecha_entrada", "fecha_salida"):
            if fila.get(campo) is not None:
                fila[campo] = fila[campo].isoformat()
        for campo in ("precio_noche", "impuestos", "descuento", "total"):
            if fila.get(campo) is not None:
                fila[campo] = float(fila[campo])
        return fila

    @staticmethod
    def _validar_datos(data):
        """Valida el cuerpo recibido. Devuelve un diccionario limpio o lanza ErrorNegocio."""
        if not isinstance(data, dict):
            raise ErrorNegocio("No se recibieron datos válidos.")

        try:
            cliente_id = int(data.get("cliente_id"))
            habitacion_id = int(data.get("habitacion_id"))
            adultos = int(data.get("adultos"))
            ninos = int(data.get("ninos") or 0)
        except (TypeError, ValueError):
            raise ErrorNegocio(
                "Cliente, habitación y número de huéspedes son obligatorios y deben ser válidos."
            ) from None

        entrada = ReservacionesController._parsear_fecha(data.get("fecha_entrada"))
        salida = ReservacionesController._parsear_fecha(data.get("fecha_salida"))

        if not entrada or not salida:
            raise ErrorNegocio("Las fechas de entrada y salida son obligatorias.")
        if salida <= entrada:
            raise ErrorNegocio("La fecha de salida debe ser posterior a la de entrada.")
        if adultos < 1 or ninos < 0:
            raise ErrorNegocio("Debe haber al menos un adulto y el número de niños no puede ser negativo.")

        estado = str(data.get("estado") or "PENDIENTE").strip().upper()
        if estado not in ESTADOS:
            raise ErrorNegocio("El estado de la reservación no es válido.")

        origen = data.get("origen")
        if origen:
            origen = str(origen).strip().upper()
            if origen not in ORIGENES:
                raise ErrorNegocio("El origen de la reservación no es válido.")
        else:
            origen = None

        return {
            "cliente_id": cliente_id,
            "habitacion_id": habitacion_id,
            "fecha_entrada": entrada,
            "fecha_salida": salida,
            "adultos": adultos,
            "ninos": ninos,
            "estado": estado,
            "origen": origen,
            "impuestos": ReservacionesController._decimal_opcional(data.get("impuestos"), "impuestos"),
            "descuento": ReservacionesController._decimal_opcional(data.get("descuento"), "descuento"),
            "comentarios": str(data.get("comentarios") or "").strip(),
        }

    @staticmethod
    def _verificar_cliente(cursor, cliente_id):
        cursor.execute("SELECT id FROM clientes WHERE id = %s", (cliente_id,))
        if not cursor.fetchone():
            raise ErrorNegocio("El cliente seleccionado no existe.", 404)

    @staticmethod
    def _hay_traslape(cursor, habitacion_id, entrada, salida, excluir_id=None):
        """Las fechas son límites abiertos: salir el día 13 no bloquea entrar el día 13."""
        consulta = """
            SELECT 1
            FROM reservaciones
            WHERE habitacion_id = %s
              AND estado IN ('PENDIENTE', 'CONFIRMADA', 'CHECK_IN')
              AND fecha_entrada < %s
              AND fecha_salida > %s
        """
        parametros = [habitacion_id, salida, entrada]

        if excluir_id:
            consulta += " AND id <> %s"
            parametros.append(excluir_id)

        consulta += " LIMIT 1"
        cursor.execute(consulta, parametros)
        return cursor.fetchone() is not None

    @staticmethod
    def _obtener_habitacion(cursor, datos, excluir_id=None, verificar_estado=True):
        """
        Bloquea la fila de la habitación (FOR UPDATE) para que dos reservaciones
        simultáneas no tomen la misma habitación, y valida las reglas.
        """
        cursor.execute(
            """
            SELECT h.id, h.numero, h.precio, h.estado,
                   th.capacidad_adultos, th.capacidad_ninos
            FROM habitaciones h
            INNER JOIN tipos_habitacion th ON th.id = h.tipo_id
            WHERE h.id = %s
            FOR UPDATE OF h
            """,
            (datos["habitacion_id"],)
        )
        habitacion = cursor.fetchone()

        if not habitacion:
            raise ErrorNegocio("La habitación seleccionada no existe.", 404)

        # Las reservaciones cerradas (canceladas, etc.) no ocupan habitación
        if datos["estado"] not in ESTADOS_ACTIVOS:
            return habitacion

        if verificar_estado and habitacion["estado"] in ("MANTENIMIENTO", "INACTIVA"):
            raise ErrorNegocio(
                f"La habitación {habitacion['numero']} no está disponible para reservar "
                f"({habitacion['estado'].lower()}).",
                409
            )

        capacidad_adultos = habitacion["capacidad_adultos"]
        capacidad_total = capacidad_adultos + habitacion["capacidad_ninos"]

        if (datos["adultos"] > capacidad_adultos
                or datos["adultos"] + datos["ninos"] > capacidad_total):
            raise ErrorNegocio(
                f"La habitación {habitacion['numero']} admite máximo {capacidad_adultos} "
                f"adulto(s) y {capacidad_total} huésped(es) en total.",
                400
            )

        if ReservacionesController._hay_traslape(
            cursor,
            datos["habitacion_id"],
            datos["fecha_entrada"],
            datos["fecha_salida"],
            excluir_id
        ):
            raise ErrorNegocio(
                f"La habitación {habitacion['numero']} ya tiene una reservación en esas fechas.",
                409
            )

        return habitacion

    @staticmethod
    def _calcular_montos(precio_noche, noches, impuestos, descuento):
        subtotal = (Decimal(precio_noche) * noches).quantize(Decimal("0.01"))
        total = subtotal + impuestos - descuento

        if total < 0:
            raise ErrorNegocio("El descuento no puede ser mayor que el subtotal más los impuestos.")

        return subtotal, total.quantize(Decimal("0.01"))

    @staticmethod
    def _registrar_historial(cursor, reservacion_id, estado_anterior, estado_nuevo, comentario):
        cursor.execute(
            """
            INSERT INTO historial_reservaciones
                (reservacion_id, usuario_id, estado_anterior, estado_nuevo, comentario)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (reservacion_id, session.get("user_id"), estado_anterior, estado_nuevo, comentario)
        )

    # ------------------------------------------------------------
    # CONSULTAS
    # ------------------------------------------------------------
    @staticmethod
    def listar_reservaciones():
        """Lista todas las reservaciones con cliente y habitación."""
        error_sesion = ReservacionesController._verificar_sesion_admin()
        if error_sesion:
            return error_sesion

        conexion = None
        cursor = None
        try:
            conexion = db.get_connection()
            cursor = conexion.cursor(dictionary=True)

            cursor.execute("""
                SELECT r.id, r.codigo_reservacion, r.cliente_id, r.habitacion_id,
                       CONCAT(c.nombre, ' ', c.apellidos) AS cliente,
                       h.numero AS habitacion,
                       th.nombre AS tipo_habitacion,
                       r.fecha_entrada, r.fecha_salida,
                       r.adultos, r.ninos, r.numero_huespedes, r.numero_noches,
                       r.precio_noche, r.impuestos, r.descuento, r.total,
                       r.estado, r.origen, r.comentarios
                FROM reservaciones r
                INNER JOIN clientes c ON c.id = r.cliente_id
                INNER JOIN habitaciones h ON h.id = r.habitacion_id
                INNER JOIN tipos_habitacion th ON th.id = h.tipo_id
                ORDER BY r.fecha_reservacion DESC, r.id DESC
            """)
            filas = [ReservacionesController._serializar(f) for f in cursor.fetchall()]

            return jsonify({"success": True, "reservaciones": filas}), 200

        except Exception:
            logger.error("Error al listar reservaciones:\n%s", traceback.format_exc())
            return jsonify({"success": False, "message": "Error interno al listar reservaciones."}), 500
        finally:
            if cursor: cursor.close()
            if conexion: conexion.close()

    @staticmethod
    def listar_clientes():
        """Clientes para llenar el menú desplegable del formulario."""
        error_sesion = ReservacionesController._verificar_sesion_admin()
        if error_sesion:
            return error_sesion

        conexion = None
        cursor = None
        try:
            conexion = db.get_connection()
            cursor = conexion.cursor(dictionary=True)

            cursor.execute("""
                SELECT id, CONCAT(nombre, ' ', apellidos) AS nombre, email
                FROM clientes
                ORDER BY apellidos, nombre
            """)

            return jsonify({"success": True, "clientes": cursor.fetchall()}), 200

        except Exception:
            logger.error("Error al listar clientes:\n%s", traceback.format_exc())
            return jsonify({"success": False, "message": "Error interno al obtener los clientes."}), 500
        finally:
            if cursor: cursor.close()
            if conexion: conexion.close()

    @staticmethod
    def habitaciones_disponibles(entrada_texto, salida_texto, excluir_texto=None):
        """Habitaciones libres entre dos fechas (límites abiertos)."""
        error_sesion = ReservacionesController._verificar_sesion_admin()
        if error_sesion:
            return error_sesion

        entrada = ReservacionesController._parsear_fecha(entrada_texto)
        salida = ReservacionesController._parsear_fecha(salida_texto)

        if not entrada or not salida or salida <= entrada:
            return jsonify({
                "success": False,
                "message": "Indica fechas válidas: la salida debe ser posterior a la entrada."
            }), 400

        try:
            excluir_id = int(excluir_texto) if excluir_texto else None
        except (TypeError, ValueError):
            excluir_id = None

        conexion = None
        cursor = None
        try:
            conexion = db.get_connection()
            cursor = conexion.cursor(dictionary=True)

            consulta = """
                SELECT h.id, h.numero, h.piso, h.precio,
                       th.nombre AS tipo,
                       th.capacidad_adultos, th.capacidad_ninos
                FROM habitaciones h
                INNER JOIN tipos_habitacion th ON th.id = h.tipo_id
                WHERE h.estado NOT IN ('MANTENIMIENTO', 'INACTIVA')
                  AND NOT EXISTS (
                      SELECT 1
                      FROM reservaciones r
                      WHERE r.habitacion_id = h.id
                        AND r.estado IN ('PENDIENTE', 'CONFIRMADA', 'CHECK_IN')
                        AND r.fecha_entrada < %s
                        AND r.fecha_salida > %s
            """
            parametros = [salida, entrada]

            if excluir_id:
                consulta += " AND r.id <> %s"
                parametros.append(excluir_id)

            consulta += """
                  )
                ORDER BY h.numero
            """
            cursor.execute(consulta, parametros)

            habitaciones = cursor.fetchall()
            for h in habitaciones:
                h["precio"] = float(h["precio"])

            return jsonify({"success": True, "habitaciones": habitaciones}), 200

        except Exception:
            logger.error("Error al consultar disponibilidad:\n%s", traceback.format_exc())
            return jsonify({"success": False, "message": "Error interno al consultar la disponibilidad."}), 500
        finally:
            if cursor: cursor.close()
            if conexion: conexion.close()

    # ------------------------------------------------------------
    # CREAR
    # ------------------------------------------------------------
    @staticmethod
    def crear_reservacion(data):
        error_sesion = ReservacionesController._verificar_sesion_admin()
        if error_sesion:
            return error_sesion

        conexion = None
        cursor = None
        try:
            datos = ReservacionesController._validar_datos(data)

            if datos["fecha_entrada"] < date.today():
                raise ErrorNegocio("La fecha de entrada no puede ser anterior a hoy.")
            if datos["estado"] not in ("PENDIENTE", "CONFIRMADA"):
                raise ErrorNegocio("Una reservación nueva solo puede iniciar como Pendiente o Confirmada.")

            conexion = db.get_connection()
            cursor = conexion.cursor(dictionary=True)

            ReservacionesController._verificar_cliente(cursor, datos["cliente_id"])
            habitacion = ReservacionesController._obtener_habitacion(cursor, datos)

            noches = (datos["fecha_salida"] - datos["fecha_entrada"]).days
            impuestos = datos["impuestos"] if datos["impuestos"] is not None else Decimal("0")
            descuento = datos["descuento"] if datos["descuento"] is not None else Decimal("0")

            subtotal, total = ReservacionesController._calcular_montos(
                habitacion["precio"], noches, impuestos, descuento
            )

            codigo = f"RES-{date.today():%Y%m%d}-{secrets.token_hex(3).upper()}"

            cursor.execute(
                """
                INSERT INTO reservaciones (
                    codigo_reservacion, cliente_id, habitacion_id,
                    fecha_entrada, fecha_salida,
                    numero_huespedes, adultos, ninos,
                    precio_noche, numero_noches, subtotal, impuestos, descuento, total,
                    estado, origen, comentarios
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    codigo, datos["cliente_id"], datos["habitacion_id"],
                    datos["fecha_entrada"], datos["fecha_salida"],
                    datos["adultos"] + datos["ninos"], datos["adultos"], datos["ninos"],
                    habitacion["precio"], noches, subtotal, impuestos, descuento, total,
                    datos["estado"], datos["origen"] or "RECEPCION", datos["comentarios"]
                )
            )
            reservacion_id = cursor.lastrowid

            ReservacionesController._registrar_historial(
                cursor, reservacion_id, None, datos["estado"],
                "Reservación creada desde el panel de administración."
            )

            conexion.commit()

            return jsonify({
                "success": True,
                "message": f"Reservación {codigo} creada correctamente.",
                "id": reservacion_id,
                "codigo_reservacion": codigo
            }), 201

        except ErrorNegocio as error:
            if conexion: conexion.rollback()
            return jsonify({"success": False, "message": error.mensaje}), error.codigo

        except Exception:
            if conexion: conexion.rollback()
            logger.error("Error al crear reservación:\n%s", traceback.format_exc())
            return jsonify({"success": False, "message": "Error interno al registrar la reservación."}), 500

        finally:
            if cursor: cursor.close()
            if conexion: conexion.close()

    # ------------------------------------------------------------
    # ACTUALIZAR
    # ------------------------------------------------------------
    @staticmethod
    def actualizar_reservacion(id, data):
        error_sesion = ReservacionesController._verificar_sesion_admin()
        if error_sesion:
            return error_sesion

        conexion = None
        cursor = None
        try:
            datos = ReservacionesController._validar_datos(data)

            conexion = db.get_connection()
            cursor = conexion.cursor(dictionary=True)

            cursor.execute(
                """
                SELECT id, codigo_reservacion, habitacion_id, estado, origen,
                       precio_noche, impuestos, descuento
                FROM reservaciones
                WHERE id = %s
                FOR UPDATE
                """,
                (id,)
            )
            actual = cursor.fetchone()

            if not actual:
                raise ErrorNegocio("La reservación no existe.", 404)

            if actual["estado"] in ESTADOS_CERRADOS:
                raise ErrorNegocio(
                    f"No se puede modificar una reservación {actual['estado'].replace('_', ' ').lower()}.",
                    409
                )

            ReservacionesController._verificar_cliente(cursor, datos["cliente_id"])

            cambio_habitacion = datos["habitacion_id"] != actual["habitacion_id"]
            habitacion = ReservacionesController._obtener_habitacion(
                cursor, datos, excluir_id=id, verificar_estado=cambio_habitacion
            )

            # Si no cambia de habitación se respeta el precio pactado
            precio_noche = habitacion["precio"] if cambio_habitacion else actual["precio_noche"]
            impuestos = datos["impuestos"] if datos["impuestos"] is not None else actual["impuestos"]
            descuento = datos["descuento"] if datos["descuento"] is not None else actual["descuento"]
            noches = (datos["fecha_salida"] - datos["fecha_entrada"]).days

            subtotal, total = ReservacionesController._calcular_montos(
                precio_noche, noches, impuestos, descuento
            )

            cursor.execute(
                """
                UPDATE reservaciones
                SET cliente_id = %s, habitacion_id = %s,
                    fecha_entrada = %s, fecha_salida = %s,
                    numero_huespedes = %s, adultos = %s, ninos = %s,
                    precio_noche = %s, numero_noches = %s,
                    subtotal = %s, impuestos = %s, descuento = %s, total = %s,
                    estado = %s, origen = %s, comentarios = %s
                WHERE id = %s
                """,
                (
                    datos["cliente_id"], datos["habitacion_id"],
                    datos["fecha_entrada"], datos["fecha_salida"],
                    datos["adultos"] + datos["ninos"], datos["adultos"], datos["ninos"],
                    precio_noche, noches,
                    subtotal, impuestos, descuento, total,
                    datos["estado"], datos["origen"] or actual["origen"], datos["comentarios"],
                    id
                )
            )

            if datos["estado"] != actual["estado"]:
                ReservacionesController._registrar_historial(
                    cursor, id, actual["estado"], datos["estado"],
                    "Estado modificado desde el panel de administración."
                )

            conexion.commit()

            return jsonify({
                "success": True,
                "message": f"Reservación {actual['codigo_reservacion']} actualizada correctamente."
            }), 200

        except ErrorNegocio as error:
            if conexion: conexion.rollback()
            return jsonify({"success": False, "message": error.mensaje}), error.codigo

        except Exception:
            if conexion: conexion.rollback()
            logger.error("Error al actualizar reservación:\n%s", traceback.format_exc())
            return jsonify({"success": False, "message": "Error interno al actualizar la reservación."}), 500

        finally:
            if cursor: cursor.close()
            if conexion: conexion.close()

    # ------------------------------------------------------------
    # CANCELAR
    # ------------------------------------------------------------
    @staticmethod
    def cancelar_reservacion(id):
        """Cancelación lógica: cambia el estado y deja registro en el historial."""
        error_sesion = ReservacionesController._verificar_sesion_admin()
        if error_sesion:
            return error_sesion

        conexion = None
        cursor = None
        try:
            conexion = db.get_connection()
            cursor = conexion.cursor(dictionary=True)

            cursor.execute(
                "SELECT id, codigo_reservacion, estado FROM reservaciones WHERE id = %s FOR UPDATE",
                (id,)
            )
            actual = cursor.fetchone()

            if not actual:
                raise ErrorNegocio("La reservación no existe.", 404)

            if actual["estado"] not in ESTADOS_CANCELABLES:
                raise ErrorNegocio(
                    f"Solo se pueden cancelar reservaciones pendientes o confirmadas "
                    f"(esta está {actual['estado'].replace('_', ' ').lower()}).",
                    409
                )

            cursor.execute("UPDATE reservaciones SET estado = 'CANCELADA' WHERE id = %s", (id,))

            ReservacionesController._registrar_historial(
                cursor, id, actual["estado"], "CANCELADA",
                "Cancelada desde el panel de administración."
            )

            conexion.commit()

            return jsonify({
                "success": True,
                "message": f"Reservación {actual['codigo_reservacion']} cancelada correctamente."
            }), 200

        except ErrorNegocio as error:
            if conexion: conexion.rollback()
            return jsonify({"success": False, "message": error.mensaje}), error.codigo

        except Exception:
            if conexion: conexion.rollback()
            logger.error("Error al cancelar reservación:\n%s", traceback.format_exc())
            return jsonify({"success": False, "message": "Error interno al cancelar la reservación."}), 500

        finally:
            if cursor: cursor.close()
            if conexion: conexion.close()
            
            
            