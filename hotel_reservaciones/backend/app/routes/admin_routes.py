from flask import Blueprint, render_template, session
from app.controllers.auth_controller import AuthController
import logging

logger = logging.getLogger("SecurityAuditor")
admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

# Seguridad por Blueprint: protege automáticamente cualquier ruta bajo /admin
@admin_bp.before_request
def protect_admin_section():
    if 'role_id' not in session or int(session.get('role_id', 0)) != 1:
        logger.warning("Intento de acceso no autorizado a sección administrativa bloqueado.")
        return render_template('login.html'), 403

@admin_bp.route('/panel', methods=['GET'])
def admin_panel_view():
    return AuthController.render_admin_panel()