import os
from flask import Flask
from app.routes.auth_routes import AuthRoutes

def create_app():
    # Apuntamos la carpeta de templates a ../frontend/templates desde backend/app/
    template_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../frontend/templates'))
    static_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../frontend/static'))
    
    app = Flask(__name__, template_folder=template_dir, static_folder=static_dir)
    
    # Instanciamos y registramos las rutas de autenticación
    auth_routes = AuthRoutes()
    app.register_blueprint(auth_routes.get_blueprint())
    
    return app