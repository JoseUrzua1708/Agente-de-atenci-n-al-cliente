from flask import Blueprint, session, redirect, url_for, request
from app.controllers.recepcion_controller import RecepcionController, ROL_RECEPCIONISTA
from app.controllers.solicitudes_controller import SolicitudesController
from app.controllers.checkin_controller import CheckinController
from app.controllers.info_controller import InfoController
from app.controllers.agentes_controller import AgentesController
from app.controllers.reservaciones_controller import ReservacionesController
import logging

logger = logging.getLogger("SecurityAuditor")

recepcion_bp = Blueprint(
    "recepcion",
    __name__,
    url_prefix="/recepcion"
)


# ============================================================
# SEGURIDAD: SOLO SESIONES CON ROL RECEPCIONISTA
# ============================================================
@recepcion_bp.before_request
def proteger_recepcion():
    try:
        role_id = int(session.get("role_id", 0))
    except (TypeError, ValueError):
        role_id = 0

    if not session.get("user_id") or role_id != ROL_RECEPCIONISTA:
        logger.warning("Intento de acceso no autorizado a la sección de recepción.")
        return redirect(url_for("auth.login_view"))


# ============================================================
# INICIO
# ============================================================
@recepcion_bp.route("/inicio", methods=["GET"])
def inicio_view():
    return RecepcionController.render_inicio()


# ============================================================
# SOLICITUDES (TICKETS DE HUÉSPEDES)
# ============================================================
@recepcion_bp.route("/solicitudes", methods=["GET"])
def solicitudes_view():
    return SolicitudesController.render_lista()


@recepcion_bp.route("/solicitudes/nueva", methods=["POST"])
def solicitudes_crear():
    return SolicitudesController.crear()


@recepcion_bp.route("/solicitudes/<int:solicitud_id>/actualizar", methods=["POST"])
def solicitudes_actualizar(solicitud_id):
    return SolicitudesController.actualizar(solicitud_id)


# ============================================================
# CHECK-IN / CHECK-OUT
# ============================================================
@recepcion_bp.route("/checkin", methods=["GET"])
def checkin_view():
    return CheckinController.render_lista()


@recepcion_bp.route("/checkin/<int:reservacion_id>/entrada", methods=["POST"])
def checkin_entrada(reservacion_id):
    return CheckinController.registrar_entrada(reservacion_id)


@recepcion_bp.route("/checkin/<int:reservacion_id>/salida", methods=["POST"])
def checkin_salida(reservacion_id):
    return CheckinController.registrar_salida(reservacion_id)


# ============================================================
# INFO DEL HOTEL (HABITACIONES Y RESPUESTAS RÁPIDAS)
# ============================================================
@recepcion_bp.route("/info", methods=["GET"])
def info_view():
    return InfoController.render_info()


@recepcion_bp.route("/info/habitaciones/<int:habitacion_id>/estado", methods=["POST"])
def info_habitacion_estado(habitacion_id):
    return InfoController.cambiar_estado_habitacion(habitacion_id)


@recepcion_bp.route("/info/faq/nueva", methods=["POST"])
def info_faq_crear():
    return InfoController.guardar_faq()


@recepcion_bp.route("/info/faq/<int:faq_id>", methods=["POST"])
def info_faq_actualizar(faq_id):
    return InfoController.guardar_faq(faq_id)


# ============================================================
# AGENTES IA (MONITOR DE CHATS Y TOMA DE CONTROL)
# ============================================================
@recepcion_bp.route("/agentes", methods=["GET"])
def agentes_view():
    return AgentesController.render_monitor()


@recepcion_bp.route("/agentes/<int:conversacion_id>/<accion>", methods=["POST"])
def agentes_accion(conversacion_id, accion):
    return AgentesController.cambiar_modo(conversacion_id, accion)


@recepcion_bp.route("/agentes/<int:conversacion_id>/responder", methods=["POST"])
def agentes_responder(conversacion_id):
    return AgentesController.responder(conversacion_id)


@recepcion_bp.route("/agentes/mensajes/<int:mensaje_id>/revision", methods=["POST"])
def agentes_marcar(mensaje_id):
    return AgentesController.marcar_mensaje(mensaje_id)


# ============================================================
# RESERVACIONES
# ============================================================
@recepcion_bp.route("/reservaciones/api", methods=["POST"])
def crear_reservacion_recepcion():
    return ReservacionesController.crear_reservacion(
        request.get_json(silent=True), origen_forzado="RECEPCION"
    )


@recepcion_bp.route("/reservaciones/clientes", methods=["GET"])
def listar_clientes_reservacion_recepcion():
    return ReservacionesController.listar_clientes(roles_permitidos=(2,))


@recepcion_bp.route("/reservaciones/disponibles", methods=["GET"])
def listar_habitaciones_disponibles_recepcion():
    return ReservacionesController.habitaciones_disponibles(
        request.args.get("entrada"),
        request.args.get("salida"),
        roles_permitidos=(2,)
    )


# ============================================================
# CERRAR SESIÓN
# ============================================================
@recepcion_bp.route("/cerrar-sesion", methods=["POST"])
def cerrar_sesion():
    return RecepcionController.cerrar_sesion()
