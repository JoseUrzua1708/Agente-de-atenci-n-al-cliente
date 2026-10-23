from flask import Blueprint, render_template, session, redirect, url_for, request, jsonify
from app.controllers.reservaciones_controller import ReservacionesController


class ReservacionesRoutes:

    def __init__(self, url_prefix="/admin"):
        self.blueprint = Blueprint(
            "reservaciones",
            __name__,
            url_prefix=url_prefix
        )
        self.registrar_seguridad()
        self.registrar_rutas()

    def registrar_seguridad(self):

        @self.blueprint.before_request
        def proteger_reservaciones():
            """Cubre TODAS las rutas de este blueprint: sesión activa y rol administrador."""
            try:
                role_id = int(session.get("role_id", 0))
            except (TypeError, ValueError):
                role_id = 0

            if not session.get("user_id") or role_id != 1:
                # La página redirige al login; la API responde JSON
                if request.path.endswith("/menu/reservaciones"):
                    return redirect(url_for("auth.login_view"))

                return jsonify({
                    "success": False,
                    "message": "Tu sesión ha terminado o no tienes autorización.",
                    "redirect": url_for("auth.login_view")
                }), 401

    def registrar_rutas(self):

        @self.blueprint.route("/menu/reservaciones", methods=["GET"])
        def vista_reservaciones():
            """Renderiza templates/admin/Menu/reservaciones.html"""
            return render_template("admin/Menu/reservaciones.html")

        @self.blueprint.route("/reservaciones/api", methods=["GET"])
        def listar_reservaciones():
            return ReservacionesController.listar_reservaciones()

        @self.blueprint.route("/reservaciones/api", methods=["POST"])
        def crear_reservacion():
            data = request.get_json(silent=True)
            return ReservacionesController.crear_reservacion(data)

        @self.blueprint.route("/reservaciones/api/<int:id>", methods=["PUT"])
        def actualizar_reservacion(id):
            data = request.get_json(silent=True)
            return ReservacionesController.actualizar_reservacion(id, data)

        @self.blueprint.route("/reservaciones/api/<int:id>/cancelar", methods=["PATCH"])
        def cancelar_reservacion(id):
            return ReservacionesController.cancelar_reservacion(id)

        @self.blueprint.route("/reservaciones/clientes", methods=["GET"])
        def listar_clientes():
            return ReservacionesController.listar_clientes()

        @self.blueprint.route("/reservaciones/disponibles", methods=["GET"])
        def habitaciones_disponibles():
            return ReservacionesController.habitaciones_disponibles(
                request.args.get("entrada"),
                request.args.get("salida"),
                request.args.get("excluir")
            )

    def get_blueprint(self):
        return self.blueprint