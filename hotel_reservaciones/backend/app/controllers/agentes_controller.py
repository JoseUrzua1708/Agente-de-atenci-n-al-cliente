from flask import render_template, request, session, redirect, url_for, flash
from app.config.database import db
from app.controllers.recepcion_controller import RecepcionController
import logging

logger = logging.getLogger("SecurityAuditor")

CANALES = {"WHATSAPP": "WhatsApp", "WEB": "Chat web"}
EMISORES = {"HUESPED": "Huésped", "BOT": "Bot IA", "RECEPCION": "Recepción"}
# Acciones sobre la conversación: (SET, condición extra del WHERE, mensaje)
ACCIONES = {
    "tomar": ("modo = 'HUMANO', requiere_humano = 0, atendida_por = %(usuario)s",
              "modo = 'BOT'", "Tomaste el control del chat."),
    "devolver": ("modo = 'BOT', atendida_por = NULL",
                 "modo = 'HUMANO' AND atendida_por = %(usuario)s", "El chat regresó al bot."),
    "cerrar": ("estado = 'CERRADA', requiere_humano = 0",
               "1 = 1", "Conversación cerrada."),
}


class AgentesController:

    @staticmethod
    def render_monitor():
        """Lista de chats activos y la conversación seleccionada."""
        seleccion = request.args.get("id", type=int)
        try:
            conversaciones = AgentesController._conversaciones_activas()
            if seleccion is None and conversaciones:
                seleccion = conversaciones[0]["id"]
            actual = AgentesController._conversacion(seleccion) if seleccion else None
            mensajes = AgentesController._mensajes(seleccion) if actual else []
            por_revisar = RecepcionController._consultar(
                "SELECT COUNT(*) AS total FROM mensajes WHERE marcado_incorrecto = 1",
                uno=True
            )["total"]
        except Exception:
            logger.exception("Error al consultar las conversaciones.")
            flash("No se pudieron cargar los chats. ¿Ya corriste migracion_agentes_ia.sql?", "error")
            conversaciones, actual, mensajes, por_revisar = [], None, [], 0

        return render_template(
            "recepcion/agentes.html",
            usuario=RecepcionController._obtener_usuario(),
            conversaciones=conversaciones,
            actual=actual,
            mensajes=mensajes,
            por_revisar=por_revisar,
            canales=CANALES,
            emisores=EMISORES,
            mi_id=session["user_id"],
        )

    @staticmethod
    def cambiar_modo(conversacion_id, accion):
        """Tomar control, devolver al bot o cerrar; el WHERE evita choques entre recepcionistas."""
        if accion not in ACCIONES:
            flash("Acción no válida.", "error")
            return AgentesController._volver(conversacion_id)

        cambios, condicion, mensaje = ACCIONES[accion]
        try:
            # cambios/condicion vienen de la lista blanca; los valores van parametrizados
            filas = RecepcionController._ejecutar(
                f"UPDATE conversaciones SET {cambios} "
                f"WHERE id = %(id)s AND estado = 'ACTIVA' AND {condicion}",
                {"id": conversacion_id, "usuario": session["user_id"]}
            )
            if filas:
                flash(mensaje, "exito")
            else:
                flash("No se pudo: el chat cambió o lo atiende otra persona.", "error")
        except Exception:
            logger.exception("Error en la acción %s del chat %s.", accion, conversacion_id)
            flash("No se pudo actualizar el chat.", "error")

        return AgentesController._volver(None if accion == "cerrar" else conversacion_id)

    @staticmethod
    def responder(conversacion_id):
        """Guarda la respuesta de recepción; el bot la entrega al huésped (entregado = 0)."""
        contenido = request.form.get("contenido", "").strip()[:2000]
        if not contenido:
            flash("Escribe un mensaje.", "error")
            return AgentesController._volver(conversacion_id)

        conexion = db.get_connection()
        cursor = conexion.cursor()
        try:
            # Solo quien tiene el control puede escribir
            cursor.execute(
                """
                SELECT id FROM conversaciones
                 WHERE id = %s AND estado = 'ACTIVA' AND modo = 'HUMANO' AND atendida_por = %s
                   FOR UPDATE
                """,
                (conversacion_id, session["user_id"])
            )
            if not cursor.fetchone():
                conexion.rollback()
                flash("Toma el control del chat antes de responder.", "error")
                return AgentesController._volver(conversacion_id)

            cursor.execute(
                """
                INSERT INTO mensajes (conversacion_id, emisor, usuario_id, contenido, entregado)
                VALUES (%s, 'RECEPCION', %s, %s, 0)
                """,
                (conversacion_id, session["user_id"], contenido)
            )
            cursor.execute(
                "UPDATE conversaciones SET ultimo_mensaje = NOW() WHERE id = %s",
                (conversacion_id,)
            )
            conexion.commit()
        except Exception:
            conexion.rollback()
            logger.exception("Error al responder el chat %s.", conversacion_id)
            flash("No se pudo enviar el mensaje.", "error")
        finally:
            cursor.close()
            conexion.close()

        return AgentesController._volver(conversacion_id)

    @staticmethod
    def marcar_mensaje(mensaje_id):
        """Marca o desmarca una respuesta del bot como incorrecta, con nota."""
        incorrecto = 1 if request.form.get("incorrecto") == "1" else 0
        nota = request.form.get("nota", "").strip()[:500] or None
        conversacion_id = request.form.get("conversacion_id", type=int)

        try:
            filas = RecepcionController._ejecutar(
                """
                UPDATE mensajes SET marcado_incorrecto = %s, nota_revision = %s
                 WHERE id = %s AND emisor = 'BOT'
                """,
                (incorrecto, nota if incorrecto else None, mensaje_id)
            )
            if filas:
                flash("Respuesta marcada para revisión." if incorrecto else "Marca quitada.", "exito")
        except Exception:
            logger.exception("Error al marcar el mensaje %s.", mensaje_id)
            flash("No se pudo marcar el mensaje.", "error")

        return AgentesController._volver(conversacion_id)

    @staticmethod
    def _conversaciones_activas():
        """Primero los que piden persona, luego los que atiende recepción, luego el resto."""
        return RecepcionController._consultar(
            """
            SELECT cv.id, cv.canal, cv.contacto, cv.modo, cv.requiere_humano, cv.atendida_por,
                   cv.ultimo_mensaje,
                   COALESCE(cv.nombre_contacto, CONCAT_WS(' ', c.nombre, c.apellidos), cv.contacto) AS nombre,
                   (SELECT m.contenido FROM mensajes AS m
                     WHERE m.conversacion_id = cv.id
                     ORDER BY m.fecha DESC, m.id DESC LIMIT 1) AS ultimo_texto
              FROM conversaciones AS cv
              LEFT JOIN clientes AS c ON c.id = cv.cliente_id
             WHERE cv.estado = 'ACTIVA'
             ORDER BY cv.requiere_humano DESC, cv.modo = 'HUMANO' DESC, cv.ultimo_mensaje DESC
             LIMIT 100
            """
        )

    @staticmethod
    def _conversacion(conversacion_id):
        return RecepcionController._consultar(
            """
            SELECT cv.*, COALESCE(cv.nombre_contacto, CONCAT_WS(' ', c.nombre, c.apellidos), cv.contacto) AS nombre,
                   r.codigo_reservacion, h.numero AS habitacion,
                   CONCAT_WS(' ', u.nombre, u.apellidos) AS atiende
              FROM conversaciones AS cv
              LEFT JOIN clientes AS c ON c.id = cv.cliente_id
              LEFT JOIN reservaciones AS r ON r.id = cv.reservacion_id
              LEFT JOIN habitaciones AS h ON h.id = r.habitacion_id
              LEFT JOIN usuarios AS u ON u.id = cv.atendida_por
             WHERE cv.id = %s AND cv.estado = 'ACTIVA'
            """,
            (conversacion_id,),
            uno=True
        )

    @staticmethod
    def _mensajes(conversacion_id):
        return RecepcionController._consultar(
            """
            SELECT m.id, m.emisor, m.contenido, m.entregado, m.marcado_incorrecto,
                   m.nota_revision, m.fecha, u.nombre AS respondio
              FROM mensajes AS m
              LEFT JOIN usuarios AS u ON u.id = m.usuario_id
             WHERE m.conversacion_id = %s
             ORDER BY m.fecha, m.id
            """,
            (conversacion_id,)
        )

    @staticmethod
    def _volver(conversacion_id):
        if conversacion_id:
            return redirect(url_for("recepcion.agentes_view", id=conversacion_id))
        return redirect(url_for("recepcion.agentes_view"))
