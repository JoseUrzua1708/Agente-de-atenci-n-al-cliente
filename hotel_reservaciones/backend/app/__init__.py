import os
from flask import Flask
from app.routes.auth_routes import AuthRoutes
from app.routes.admin_routes import admin_bp
from app.routes.register_routes import register_bp
from app.routes.recovery_routes import recovery_bp
from app.routes.perfil_routes import PerfilRoutes
from app.routes.habitaciones_routes import HabitacionesRoutes
from app.routes.routes_cliente.cliente_routes import cliente_bp


def create_app():
    # Apuntamos la carpeta de templates y estáticos
    template_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../frontend/templates'))
    static_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../frontend/static'))
    
    app = Flask(__name__, template_folder=template_dir, static_folder=static_dir)
    
    # Asignamos la llave secreta obligatoria para el manejo de sesiones en Flask
    
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")

    if not app.config["SECRET_KEY"]:
        raise RuntimeError(
            "Falta configurar SECRET_KEY en las variables de entorno."
        )

    # Seguridad de las cookies de sesión
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

    # Activar cuando el sitio funcione mediante HTTPS
    app.config["SESSION_COOKIE_SECURE"] = (
    os.getenv("HTTPS_ENABLED", "false").lower() == "true"
    )

    # La sesión del navegador no debe ser permanente
    app.config["SESSION_PERMANENT"] = False

    
    # Instanciamos y registramos cada Blueprint de forma independiente
    auth_routes = AuthRoutes()
    app.register_blueprint(auth_routes.get_blueprint())
    app.register_blueprint(admin_bp)
    app.register_blueprint(register_bp)
    app.register_blueprint(recovery_bp)
    app.register_blueprint(PerfilRoutes().get_blueprint())
    habitaciones_routes = HabitacionesRoutes(url_prefix="/admin")
    app.register_blueprint(habitaciones_routes.get_blueprint())
    app.register_blueprint(cliente_bp)

    # Evitar que el navegador almacene páginas de la aplicación
    @app.after_request
    def evitar_cache_privada(response):
        response.headers["Cache-Control"] = (
            "no-store, no-cache, must-revalidate, private, max-age=0"
        )
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response

    return app
