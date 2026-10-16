from flask import Blueprint, render_template, session, redirect, url_for
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

        @self.blueprint.route("/perfil", methods=["GET"])
        def ver_perfil():
            if not session.get("user_id"):
                return redirect(url_for("auth.login_view"))

            try:
                if int(session.get("role_id", 0)) != 1:
                    return redirect(url_for("auth.login_view"))
            except (TypeError, ValueError):
                session.clear()
                return redirect(url_for("auth.login_view"))

            return render_template("admin/perfil_admin.html")

        @self.blueprint.route("/perfil/datos", methods=["GET"])
        def obtener_datos_perfil():
            return PerfilController.obtener_perfil()

        @self.blueprint.route("/cerrar-sesion", methods=["POST"])
        def cerrar_sesion():
            return PerfilController.cerrar_sesion()

    def get_blueprint(self):
        return self.blueprint
