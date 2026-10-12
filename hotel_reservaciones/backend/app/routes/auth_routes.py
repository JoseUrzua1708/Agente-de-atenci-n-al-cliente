from flask import Blueprint, redirect, url_for
from app.controllers.auth_controller import AuthController

class AuthRoutes:
    def __init__(self, url_prefix=None):
        self.blueprint = Blueprint('auth', __name__, url_prefix=url_prefix)
        self._register_routes()

    def _register_routes(self):
        """Registra exclusivamente los endpoints correspondientes al flujo de login y autenticación."""
        
        @self.blueprint.route('/', methods=['GET'])
        def index_redirect():
            return redirect(url_for('auth.login_view'))

        @self.blueprint.route('/login', methods=['GET'])
        def login_view():
            return AuthController.render_login()

        @self.blueprint.route('/login', methods=['POST'])
        def login_action():
            return AuthController.process_login()

    def get_blueprint(self):
        return self.blueprint