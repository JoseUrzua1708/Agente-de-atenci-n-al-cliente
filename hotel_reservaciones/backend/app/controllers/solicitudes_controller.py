from flask import render_template, request, session, redirect, url_for, flash
from app.controllers.recepcion_controller import RecepcionController
import logging

logger = logging.getLogger("SecurityAuditor")

# Valores permitidos (iguales a los ENUM de la tabla solicitudes)
TIPOS = {
    "SERVICIO": "Servicio",
    "MANTENIMIENTO": "Mantenimiento",
    "QUEJA": "Queja",
    "PREGUNTA": "Pregunta",
    "RESERVACION": "Reservación",
    "MODIFICACION": "Modificación",
    "CANCELACION": "Cancelación",
    "OTRO": "Otro",
}
PRIORIDADES = {"BAJA": "Baja", "MEDIA": "Media", "ALTA": "Alta", "URGENTE": "Urgente"}
ESTADOS = {"ABIERTA": "Abierta", "EN_PROCESO": "En proceso", "RESUELTA": "Resuelta", "CERRADA": "Cerrada"}
CANALES = {"WEB": "Web", "CHATBOT": "Chatbot", "TELEFONO": "Teléfono", "RECEPCION": "Recepción"}
# Canales que puede registrar la recepcionista a mano
CANALES_MANUALES = ("RECEPCION", "TELEFONO")
# Filtro por defecto: lo que sigue pendiente
FILTRO_ACTIVAS = "ACTIVAS"


class SolicitudesController:

    @staticmethod
    def render_lista():
        """Lista de solicitudes con filtros por estado, prioridad y tipo."""
        filtros = {
            "estado": request.args.get("estado", FILTRO_ACTIVAS),
            "prioridad": request.args.get("prioridad", ""),
            "tipo": request.args.get("tipo", ""),
        }

        try:
            solicitudes = SolicitudesController._buscar(filtros)
            huespedes = SolicitudesController._huespedes_hospedados()
        except Exception:
            logger.exception("Error al consultar las solicitudes.")
            flash("No se pudieron cargar las solicitudes. Intenta de nuevo.", "error")
            solicitudes, huespedes = [], []

        return render_template(
            "recepcion/solicitudes.html",
            usuario=RecepcionController._obtener_usuario(),
            solicitudes=solicitudes,
            huespedes=huespedes,
            filtros=filtros,
            tipos=TIPOS,
            prioridades=PRIORIDADES,
            estados=ESTADOS,
            canales=CANALES,
            canales_manuales=CANALES_MANUALES,
        )

    @staticmethod
    def crear():
        """Registra una solicitud recibida en mostrador o por teléfono."""
        datos = request.form
        asunto = datos.get("asunto", "").strip()[:200]
        mensaje = datos.get("mensaje", "").strip()
        tipo = datos.get("tipo", "")
        prioridad = datos.get("prioridad", "MEDIA")
        canal = datos.get("canal", "RECEPCION")

        if not asunto or not mensaje or tipo not in TIPOS \
                or prioridad not in PRIORIDADES or canal not in CANALES_MANUALES:
            flash("Revisa los datos: asunto, detalle y tipo son obligatorios.", "error")
            return SolicitudesController._volver()

        try:
            # Huésped opcional: se toma de una estancia activa para ligar cliente y reserva
            cliente_id, reservacion_id = None, None
            if datos.get("reservacion_id", "").isdigit():
                estancia = RecepcionController._consultar(
                    "SELECT id, cliente_id FROM reservaciones WHERE id = %s AND estado = 'CHECK_IN'",
                    (int(datos["reservacion_id"]),),
                    uno=True
                )
                if estancia:
                    cliente_id, reservacion_id = estancia["cliente_id"], estancia["id"]

            RecepcionController._ejecutar(
                """
                INSERT INTO solicitudes
                    (cliente_id, reservacion_id, tipo, asunto, mensaje, prioridad, canal, asignado_a)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (cliente_id, reservacion_id, tipo, asunto, mensaje, prioridad, canal, session["user_id"])
            )
            flash("Solicitud registrada.", "exito")
        except Exception:
            logger.exception("Error al registrar una solicitud.")
            flash("No se pudo registrar la solicitud.", "error")

        return SolicitudesController._volver()

    @staticmethod
    def actualizar(solicitud_id):
        """Cambia estado/prioridad y guarda la respuesta; quien atiende queda asignado."""
        estado = request.form.get("estado", "")
        prioridad = request.form.get("prioridad", "")
        respuesta = request.form.get("respuesta", "").strip() or None

        if estado not in ESTADOS or prioridad not in PRIORIDADES:
            flash("Estado o prioridad no válidos.", "error")
            return SolicitudesController._volver()

        if estado in ("RESUELTA", "CERRADA") and not respuesta:
            flash("Para resolver o cerrar, escribe qué se hizo.", "error")
            return SolicitudesController._volver()

        try:
            # fecha_resolucion se fija al resolver y se limpia si se reabre
            filas = RecepcionController._ejecutar(
                """
                UPDATE solicitudes
                   SET estado = %s,
                       prioridad = %s,
                       respuesta = %s,
                       asignado_a = %s,
                       fecha_resolucion = CASE
                           WHEN %s IN ('RESUELTA', 'CERRADA') THEN COALESCE(fecha_resolucion, NOW())
                           ELSE NULL
                       END
                 WHERE id = %s
                """,
                (estado, prioridad, respuesta, session["user_id"], estado, solicitud_id)
            )
            if filas:
                flash(f"Solicitud #{solicitud_id} actualizada.", "exito")
            else:
                flash("La solicitud no existe o no tuvo cambios.", "error")
        except Exception:
            logger.exception("Error al actualizar la solicitud %s.", solicitud_id)
            flash("No se pudo actualizar la solicitud.", "error")

        return SolicitudesController._volver()

    @staticmethod
    def _buscar(filtros):
        """Arma el WHERE solo con valores de la lista blanca."""
        condiciones, parametros = [], []

        if filtros["estado"] == FILTRO_ACTIVAS:
            condiciones.append("s.estado IN ('ABIERTA', 'EN_PROCESO')")
        elif filtros["estado"] in ESTADOS:
            condiciones.append("s.estado = %s")
            parametros.append(filtros["estado"])

        if filtros["prioridad"] in PRIORIDADES:
            condiciones.append("s.prioridad = %s")
            parametros.append(filtros["prioridad"])

        if filtros["tipo"] in TIPOS:
            condiciones.append("s.tipo = %s")
            parametros.append(filtros["tipo"])

        where = f"WHERE {' AND '.join(condiciones)}" if condiciones else ""

        return RecepcionController._consultar(
            f"""
            SELECT s.id, s.tipo, s.asunto, s.mensaje, s.prioridad, s.canal, s.estado,
                   s.respuesta, s.fecha_creacion, s.fecha_resolucion,
                   CONCAT_WS(' ', c.nombre, c.apellidos) AS huesped,
                   h.numero AS habitacion,
                   CONCAT_WS(' ', u.nombre, u.apellidos) AS atendio
              FROM solicitudes AS s
              LEFT JOIN clientes AS c ON c.id = s.cliente_id
              LEFT JOIN reservaciones AS r ON r.id = s.reservacion_id
              LEFT JOIN habitaciones AS h ON h.id = r.habitacion_id
              LEFT JOIN usuarios AS u ON u.id = s.asignado_a
              {where}
             ORDER BY FIELD(s.prioridad, 'URGENTE', 'ALTA', 'MEDIA', 'BAJA'),
                      s.fecha_creacion DESC
             LIMIT 200
            """,
            tuple(parametros)
        )

    @staticmethod
    def _huespedes_hospedados():
        """Estancias activas para ligar la solicitud a un huésped."""
        return RecepcionController._consultar(
            """
            SELECT r.id, h.numero AS habitacion, CONCAT_WS(' ', c.nombre, c.apellidos) AS huesped
              FROM reservaciones AS r
              JOIN clientes AS c ON c.id = r.cliente_id
              JOIN habitaciones AS h ON h.id = r.habitacion_id
             WHERE r.estado = 'CHECK_IN'
             ORDER BY h.numero
            """
        )

    @staticmethod
    def _volver():
        """Regresa a la lista conservando los filtros (patrón PRG)."""
        filtros = {k: v for k, v in request.args.items() if k in ("estado", "prioridad", "tipo")}
        return redirect(url_for("recepcion.solicitudes_view", **filtros))
