from flask import Blueprint
from app.controllers.pagos_controller import PagosController


class PagosRoutes:

    def __init__(self, url_prefix="/admin"):
        self.blueprint = Blueprint(
            "pagos",
            __name__,
            url_prefix=url_prefix
        )
        self.registrar_rutas()

    def registrar_rutas(self):

        @self.blueprint.route("/pagos/indicadores", methods=["GET"])
        def indicadores_pagos():
            return PagosController.obtener_indicadores()

    def get_blueprint(self):
        return self.blueprint