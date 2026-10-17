from flask import Blueprint, render_template, session, redirect, url_for, request
from app.controllers.habitaciones_controller import HabitacionesController


class HabitacionesRoutes:

    def __init__(self, url_prefix="/admin"):
        self.blueprint = Blueprint(
            "habitaciones",
            __name__,
            url_prefix=url_prefix
        )
        self.registrar_rutas()

    def registrar_rutas(self):

        @self.blueprint.route("/menu/habitaciones", methods=["GET"])
        def vista_habitaciones():
            """Renderiza la vista HTML ubicada en templates/admin/Menu/habitaciones.html"""
            if not session.get("user_id"):
                return redirect(url_for("auth.login_view"))

            try:
                if int(session.get("role_id", 0)) != 1:
                    return redirect(url_for("auth.login_view"))
            except (TypeError, ValueError):
                session.clear()
                return redirect(url_for("auth.login_view"))

            return render_template("admin/Menu/habitaciones.html")

        @self.blueprint.route("/habitaciones/tipos", methods=["GET"])
        def obtener_tipos():
            return HabitacionesController.obtener_tipos_habitacion()

        @self.blueprint.route("/habitaciones/api", methods=["GET"])
        def listar_habitaciones():
            return HabitacionesController.listar_habitaciones()

        @self.blueprint.route("/habitaciones/api", methods=["POST"])
        def crear_habitacion():
            data = request.get_json()
            return HabitacionesController.crear_habitacion(data)

        @self.blueprint.route("/habitaciones/api/<int:id>", methods=["PUT"])
        def actualizar_habitacion(id):
            data = request.get_json()
            return HabitacionesController.actualizar_habitacion(id, data)

        @self.blueprint.route("/habitaciones/api/<int:id>/inactivar", methods=["PATCH"])
        def inactivar_habitacion(id):
            return HabitacionesController.desactivar_habitacion(id)

    def get_blueprint(self):
        return self.blueprint