from flask import Blueprint
from app.controllers.recovery_controller import RecoveryController

recovery_bp = Blueprint('recovery', __name__)

@recovery_bp.route('/recuperar-contrasena', methods=['GET'])
def recover_view():
    """Muestra la vista para recuperar la contraseña."""
    return RecoveryController.render_recover()

@recovery_bp.route('/recuperar-contrasena', methods=['POST'])
def recover_action():
    """Procesa el envío del formulario de recuperación."""
    return RecoveryController.process_recover()