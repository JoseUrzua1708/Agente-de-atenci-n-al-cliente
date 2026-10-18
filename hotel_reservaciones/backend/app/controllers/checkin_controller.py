from flask import render_template, session, redirect, url_for, flash
from app.config.database import db
from app.controllers.recepcion_controller import RecepcionController
from datetime import date
import logging

logger = logging.getLogger("SecurityAuditor")

ESTADOS_RESERVA = {
    "PENDIENTE": "Pendiente",
    "CONFIRMADA": "Confirmada",
    "CHECK_IN": "Hospedado",
    "CHECK_OUT": "Salió",
    "CANCELADA": "Cancelada",
    "NO_SHOW": "No llegó",
}
METODOS_PAGO = {
    "EFECTIVO": "Efectivo",
    "TARJETA": "Tarjeta",
    "TRANSFERENCIA": "Transferencia",
    "PAYPAL": "PayPal",
    "OTRO": "Otro",
}
ESTADOS_PAGO = {"PENDIENTE": "Pendiente", "APROBADO": "Aprobado", "RECHAZADO": "Rechazado", "REEMBOLSADO": "Reembolsado"}
# Solo se puede entregar una habitación libre o apartada para esta reserva
HABITACION_LISTA = ("DISPONIBLE", "RESERVADA")

# Columnas comunes de las dos listas; el saldo solo cuenta pagos aprobados
CONSULTA_BASE = """
    SELECT r.id, r.codigo_reservacion, r.fecha_entrada, r.fecha_salida, r.numero_noches,
           r.adultos, r.ninos, r.total, r.estado, r.origen, r.comentarios,
           CONCAT_WS(' ', c.nombre, c.apellidos) AS huesped,
           c.telefono, c.email, c.documento_tipo, c.documento_numero,
           h.numero AS habitacion, h.estado AS habitacion_estado,
           t.nombre AS tipo_habitacion,
           COALESCE(p.pagado, 0) AS pagado,
           r.total - COALESCE(p.pagado, 0) AS saldo
      FROM reservaciones AS r
      JOIN clientes AS c ON c.id = r.cliente_id
      JOIN habitaciones AS h ON h.id = r.habitacion_id
      JOIN tipos_habitacion AS t ON t.id = h.tipo_id
      LEFT JOIN (
            SELECT reservacion_id, SUM(monto) AS pagado
              FROM pagos
             WHERE estado = 'APROBADO'
             GROUP BY reservacion_id
      ) AS p ON p.reservacion_id = r.id
"""


class CheckinController:

    @staticmethod
    def render_lista():
        """Llegadas pendientes (hoy o atrasadas) y huéspedes en casa."""
        try:
            llegadas = RecepcionController._consultar(
                CONSULTA_BASE + """
                 WHERE r.estado IN ('PENDIENTE', 'CONFIRMADA')
                   AND r.fecha_entrada <= CURDATE()
                 ORDER BY r.fecha_entrada, h.numero
                """
            )
            hospedados = RecepcionController._consultar(
                CONSULTA_BASE + """
                 WHERE r.estado = 'CHECK_IN'
                 ORDER BY r.fecha_salida, h.numero
                """
            )
            pagos = CheckinController._pagos_por_reserva([r["id"] for r in llegadas + hospedados])
        except Exception:
            logger.exception("Error al consultar llegadas y estancias.")
            flash("No se pudieron cargar las reservas. Intenta de nuevo.", "error")
            llegadas, hospedados, pagos = [], [], {}

        return render_template(
            "recepcion/checkin.html",
            usuario=RecepcionController._obtener_usuario(),
            llegadas=llegadas,
            hospedados=hospedados,
            pagos=pagos,
            estados_reserva=ESTADOS_RESERVA,
            metodos_pago=METODOS_PAGO,
            estados_pago=ESTADOS_PAGO,
            habitacion_lista=HABITACION_LISTA,
            hoy=date.today(),
        )

    @staticmethod
    def registrar_entrada(reservacion_id):
        """Check-in: reserva a CHECK_IN y habitación a OCUPADA."""
        return CheckinController._cambiar_estado(
            reservacion_id,
            estados_validos=("PENDIENTE", "CONFIRMADA"),
            estado_nuevo="CHECK_IN",
            habitacion_nueva="OCUPADA",
            mensaje_ok="Check-in registrado. Habitación {habitacion} ocupada.",
        )

    @staticmethod
    def registrar_salida(reservacion_id):
        """Check-out: reserva a CHECK_OUT y habitación a LIMPIEZA."""
        return CheckinController._cambiar_estado(
            reservacion_id,
            estados_validos=("CHECK_IN",),
            estado_nuevo="CHECK_OUT",
            habitacion_nueva="LIMPIEZA",
            mensaje_ok="Check-out registrado. Habitación {habitacion} pasa a limpieza.",
        )

    @staticmethod
    def _cambiar_estado(reservacion_id, estados_validos, estado_nuevo, habitacion_nueva, mensaje_ok):
        """Reserva, habitación e historial en una sola transacción."""
        conexion = db.get_connection()
        cursor = conexion.cursor(dictionary=True)
        try:
            # FOR UPDATE evita que dos recepcionistas hagan el mismo movimiento a la vez
            cursor.execute(
                """
                SELECT r.estado, r.fecha_entrada, r.habitacion_id,
                       h.numero AS habitacion, h.estado AS habitacion_estado
                  FROM reservaciones AS r
                  JOIN habitaciones AS h ON h.id = r.habitacion_id
                 WHERE r.id = %s
                   FOR UPDATE
                """,
                (reservacion_id,)
            )
            reserva = cursor.fetchone()

            error = None
            if not reserva or reserva["estado"] not in estados_validos:
                error = "La reserva ya no está en un estado válido para este movimiento."
            elif estado_nuevo == "CHECK_IN" and reserva["habitacion_estado"] not in HABITACION_LISTA:
                error = f"La habitación {reserva['habitacion']} no está lista ({reserva['habitacion_estado'].lower()})."

            if error:
                conexion.rollback()
                flash(error, "error")
                return redirect(url_for("recepcion.checkin_view"))

            cursor.execute(
                "UPDATE reservaciones SET estado = %s WHERE id = %s",
                (estado_nuevo, reservacion_id)
            )
            cursor.execute(
                "UPDATE habitaciones SET estado = %s WHERE id = %s",
                (habitacion_nueva, reserva["habitacion_id"])
            )
            cursor.execute(
                """
                INSERT INTO historial_reservaciones
                    (reservacion_id, usuario_id, estado_anterior, estado_nuevo, comentario)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (reservacion_id, session["user_id"], reserva["estado"], estado_nuevo, "Movimiento desde recepción")
            )
            conexion.commit()
            flash(mensaje_ok.format(habitacion=reserva["habitacion"]), "exito")
        except Exception:
            conexion.rollback()
            logger.exception("Error al cambiar la reserva %s a %s.", reservacion_id, estado_nuevo)
            flash("No se pudo registrar el movimiento.", "error")
        finally:
            cursor.close()
            conexion.close()

        return redirect(url_for("recepcion.checkin_view"))

    @staticmethod
    def _pagos_por_reserva(ids):
        """Pagos agrupados por reserva para el detalle (una sola consulta)."""
        if not ids:
            return {}
        marcadores = ", ".join(["%s"] * len(ids))
        filas = RecepcionController._consultar(
            f"""
            SELECT reservacion_id, monto, metodo_pago, estado, referencia,
                   COALESCE(fecha_pago, fecha_creacion) AS fecha
              FROM pagos
             WHERE reservacion_id IN ({marcadores})
             ORDER BY fecha
            """,
            tuple(ids)
        )
        agrupados = {}
        for fila in filas:
            agrupados.setdefault(fila["reservacion_id"], []).append(fila)
        return agrupados
