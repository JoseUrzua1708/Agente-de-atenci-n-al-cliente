from flask import Blueprint, redirect, url_for, render_template, session, make_response
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

        @self.blueprint.route('/logout', methods=['GET', 'POST'])
        def logout_action():
            return AuthController.logout()

        @staticmethod
        def render_login():
            """Renderiza la vista principal de inicio de sesión o redirige si ya hay sesión."""
            # Si el usuario YA inició sesión como admin, mandarlo directo al panel
            if 'role_id' in session and int(session.get('role_id', 0)) == 1:
                return redirect('/admin/panel')
    
            # Si el usuario YA inició sesión como usuario estándar
            if 'user_id' in session:
                return redirect('/dashboard')

            # Si NO tiene sesión, mostrar la vista del login normalmente
            response = make_response(render_template('login.html'))
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response

    def get_blueprint(self):
        return self.blueprint
    