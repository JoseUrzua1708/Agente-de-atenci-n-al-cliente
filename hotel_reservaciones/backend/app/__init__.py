import os
from flask import Flask
from app.routes.auth_routes import AuthRoutes
from app.routes.admin_routes import admin_bp
from app.routes.register_routes import register_bp
from app.routes.recovery_routes import recovery_bp
from app.routes.perfil_routes import PerfilRoutes

def create_app():
    # Apuntamos la carpeta de templates y estáticos
    template_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../frontend/templates'))
    static_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../frontend/static'))
    
    app = Flask(__name__, template_folder=template_dir, static_folder=static_dir)
    
    # Asignamos la llave secreta obligatoria para el manejo de sesiones en Flask
    app.secret_key = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    
    # Instanciamos y registramos cada Blueprint de forma independiente
    auth_routes = AuthRoutes()
    app.register_blueprint(auth_routes.get_blueprint())
    app.register_blueprint(admin_bp)
    app.register_blueprint(register_bp)
    app.register_blueprint(recovery_bp)
    app.register_blueprint(PerfilRoutes().get_blueprint())
    
    return app