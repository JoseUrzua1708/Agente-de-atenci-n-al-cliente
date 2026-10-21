
from flask import Blueprint, request, render_template

from app.controllers.reservaciones_controller import ReservacionesController


class ReservacionesRoutes:

    def __init__(self, url_prefix="/admin"):
        self.blueprint = Blueprint(
            "reservaciones",
            __name__,
            url_prefix=f"{url_prefix}/reservaciones"
        )
        self._registrar_rutas()

    def get_blueprint(self):
        return self.blueprint

    def _registrar_rutas(self):
        self.blueprint.add_url_rule(
            "",
            endpoint="listar_reservaciones",
            view_func=ReservacionesController.listar_reservaciones,
            methods=["GET"]
        )

        self.blueprint.add_url_rule(
    "/vista",
    endpoint="vista_reservaciones",
    view_func=lambda: render_template("admin/Menu/reservaciones.html"),
    methods=["GET"]
)

        self.blueprint.add_url_rule(
            "/clientes",
            endpoint="listar_clientes",
            view_func=ReservacionesController.listar_clientes,
            methods=["GET"]
        )

        self.blueprint.add_url_rule(
            "/habitaciones-disponibles",
            endpoint="habitaciones_disponibles",
            view_func=self._habitaciones_disponibles,
            methods=["GET"]
        )

        self.blueprint.add_url_rule(
            "",
            endpoint="crear_reservacion",
            view_func=self._crear_reservacion,
            methods=["POST"]
        )

        self.blueprint.add_url_rule(
            "/<int:id>",
            endpoint="actualizar_reservacion",
            view_func=self._actualizar_reservacion,
            methods=["PUT"]
        )

        self.blueprint.add_url_rule(
            "/<int:id>/cancelar",
            endpoint="cancelar_reservacion",
            view_func=ReservacionesController.cancelar_reservacion,
            methods=["POST"]
        )

    @staticmethod
    def _habitaciones_disponibles():
        return ReservacionesController.habitaciones_disponibles(
            request.args.get("fecha_entrada"),
            request.args.get("fecha_salida"),
            request.args.get("excluir_id")
        )

    @staticmethod
    def _crear_reservacion():
        return ReservacionesController.crear_reservacion(
            request.get_json(silent=True)
        )

    @staticmethod
    def _actualizar_reservacion(id):
        return ReservacionesController.actualizar_reservacion(
            id,
            request.get_json(silent=True)
        )
