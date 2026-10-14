
from flask import Blueprint
from app.controllers.perfil_controller import PerfilController


class PerfilRoutes:

    def __init__(self, url_prefix="/admin"):
        self.blueprint = Blueprint(
            "perfil",
            __name__,
            url_prefix=url_prefix
        )

        self.registrar_rutas()

    def registrar_rutas(self):
        """Registra las direcciones del perfil y del cierre de sesión."""

        @self.blueprint.route("/perfil/datos", methods=["GET"])
        def obtener_datos_perfil():
            return PerfilController.obtener_perfil()

        @self.blueprint.route("/cerrar-sesion", methods=["POST"])
        def cerrar_sesion():
            return PerfilController.cerrar_sesion()

    def get_blueprint(self):
        return self.blueprint
