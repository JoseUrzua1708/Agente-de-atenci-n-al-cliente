from flask import render_template, request, redirect, url_for, flash
from app.controllers.recepcion_controller import RecepcionController
import logging

logger = logging.getLogger("SecurityAuditor")

ESTADOS_HABITACION = {
    "DISPONIBLE": "Disponible",
    "RESERVADA": "Reservada",
    "OCUPADA": "Ocupada",
    "LIMPIEZA": "Limpieza",
    "MANTENIMIENTO": "Mantenimiento",
    "INACTIVA": "Inactiva",
}
# Recepción solo mueve entre estos; ocupada/reservada van por check-in y la baja es del admin
ESTADOS_MANUALES = ("DISPONIBLE", "LIMPIEZA", "MANTENIMIENTO")


class InfoController:

    @staticmethod
    def render_info():
        """Estado de habitaciones por piso y base de respuestas rápidas."""
        busqueda = request.args.get("q", "").strip()[:100]
        categoria = request.args.get("categoria", "")

        try:
            habitaciones = InfoController._habitaciones_por_piso()
            categorias = [f["categoria"] for f in RecepcionController._consultar(
                "SELECT DISTINCT categoria FROM preguntas_frecuentes ORDER BY categoria"
            )]
            faqs = InfoController._buscar_faqs(busqueda, categoria if categoria in categorias else "")
        except Exception:
            logger.exception("Error al consultar la información del hotel.")
            flash("No se pudo cargar la información. Intenta de nuevo.", "error")
            habitaciones, categorias, faqs = {}, [], []

        return render_template(
            "recepcion/info.html",
            usuario=RecepcionController._obtener_usuario(),
            habitaciones=habitaciones,
            faqs=faqs,
            categorias=categorias,
            busqueda=busqueda,
            categoria=categoria,
            estados_habitacion=ESTADOS_HABITACION,
            estados_manuales=ESTADOS_MANUALES,
        )

    @staticmethod
    def cambiar_estado_habitacion(habitacion_id):
        """Cambia el estado solo si la habitación está libre de huéspedes."""
        nuevo = request.form.get("estado", "")
        if nuevo not in ESTADOS_MANUALES:
            flash("Estado no permitido.", "error")
            return InfoController._volver()

        try:
            # El WHERE impide tocar habitaciones ocupadas, reservadas o inactivas
            filas = RecepcionController._ejecutar(
                "UPDATE habitaciones SET estado = %s WHERE id = %s AND estado IN ('DISPONIBLE', 'LIMPIEZA', 'MANTENIMIENTO')",
                (nuevo, habitacion_id)
            )
            if filas:
                flash(f"Habitación actualizada a {ESTADOS_HABITACION[nuevo].lower()}.", "exito")
            else:
                flash("Esa habitación no se puede cambiar desde recepción (ocupada, reservada o sin cambios).", "error")
        except Exception:
            logger.exception("Error al cambiar el estado de la habitación %s.", habitacion_id)
            flash("No se pudo cambiar el estado.", "error")

        return InfoController._volver()

    @staticmethod
    def guardar_faq(faq_id=None):
        """Crea (sin id) o actualiza una respuesta rápida."""
        datos = request.form
        pregunta = datos.get("pregunta", "").strip()[:500]
        respuesta = datos.get("respuesta", "").strip()
        categoria = datos.get("categoria", "").strip().upper()[:80]
        palabras = datos.get("palabras_clave", "").strip()[:500] or None
        estado = 1 if datos.get("activa") else 2

        if not pregunta or not respuesta or not categoria:
            flash("Pregunta, respuesta y categoría son obligatorias.", "error")
            return InfoController._volver()

        try:
            if faq_id is None:
                RecepcionController._ejecutar(
                    """
                    INSERT INTO preguntas_frecuentes (pregunta, respuesta, categoria, palabras_clave, estado)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (pregunta, respuesta, categoria, palabras, estado)
                )
                flash("Respuesta rápida agregada.", "exito")
            else:
                RecepcionController._ejecutar(
                    """
                    UPDATE preguntas_frecuentes
                       SET pregunta = %s, respuesta = %s, categoria = %s, palabras_clave = %s, estado = %s
                     WHERE id = %s
                    """,
                    (pregunta, respuesta, categoria, palabras, estado, faq_id)
                )
                flash("Respuesta rápida actualizada.", "exito")
        except Exception:
            logger.exception("Error al guardar la pregunta frecuente %s.", faq_id)
            flash("No se pudo guardar la respuesta.", "error")

        return InfoController._volver()

    @staticmethod
    def _habitaciones_por_piso():
        """Habitaciones agrupadas por piso con el huésped actual si lo hay."""
        filas = RecepcionController._consultar(
            """
            SELECT h.id, h.numero, h.piso, h.estado, t.nombre AS tipo,
                   CONCAT_WS(' ', c.nombre, c.apellidos) AS huesped,
                   r.fecha_salida
              FROM habitaciones AS h
              JOIN tipos_habitacion AS t ON t.id = h.tipo_id
              LEFT JOIN reservaciones AS r ON r.habitacion_id = h.id AND r.estado = 'CHECK_IN'
              LEFT JOIN clientes AS c ON c.id = r.cliente_id
             ORDER BY h.piso, h.numero
            """
        )
        pisos = {}
        for fila in filas:
            pisos.setdefault(fila["piso"], []).append(fila)
        return pisos

    @staticmethod
    def _buscar_faqs(busqueda, categoria):
        """Busca en pregunta, respuesta y palabras clave; activas primero."""
        condiciones, parametros = [], []
        if busqueda:
            patron = f"%{busqueda}%"
            condiciones.append("(pregunta LIKE %s OR respuesta LIKE %s OR palabras_clave LIKE %s)")
            parametros += [patron, patron, patron]
        if categoria:
            condiciones.append("categoria = %s")
            parametros.append(categoria)

        where = f"WHERE {' AND '.join(condiciones)}" if condiciones else ""
        return RecepcionController._consultar(
            f"""
            SELECT id, pregunta, respuesta, categoria, palabras_clave, estado
              FROM preguntas_frecuentes
              {where}
             ORDER BY estado, categoria, prioridad, pregunta
            """,
            tuple(parametros)
        )

    @staticmethod
    def _volver():
        """Regresa conservando búsqueda y categoría (patrón PRG)."""
        filtros = {k: v for k, v in request.args.items() if k in ("q", "categoria")}
        return redirect(url_for("recepcion.info_view", **filtros))
