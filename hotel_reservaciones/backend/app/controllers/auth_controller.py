from flask import render_template, request, jsonify, session
from werkzeug.security import check_password_hash
from app.config.database import db
import logging

logger = logging.getLogger("SecurityAuditor")

class AuthController:
    @staticmethod
    def render_login():
        """Renderiza la vista principal de inicio de sesión de forma segura."""
        return render_template('login.html')

    @staticmethod
    def process_login():
        """Procesa las credenciales aplicando seguridad estricta, prevención de SQL Injection y control de roles."""
        try:
            data = request.get_json() or request.form
            email = data.get('username', '').strip()
            password = data.get('password', '')

            # Validación de campos vacíos
            if not email or not password:
                logger.warning("Intento de login fallido: campos vacíos.")
                return jsonify({"success": False, "message": "El correo y la contraseña son obligatorios."}), 400

            # Conexión segura al pool de base de datos
            connection = db.get_connection()
            cursor = connection.cursor(dictionary=True)
            
            # Consulta parametrizada para evitar inyección SQL por completo
            query = "SELECT id, nombre, apellidos, correo, password_hash, rol_id, estado FROM usuarios WHERE correo = %s"
            cursor.execute(query, (email,))
            user = cursor.fetchone()
            
            cursor.close()
            connection.close()

            # Verificación de existencia de usuario, estado activo y validación segura de hash
            # Nota: Usamos check_password_hash para comparar contra contraseñas cifradas
            if not user or user['estado'] != 'ACTIVO' or not check_password_hash(user['password_hash'], password):
                logger.warning(f"Intento de acceso no autorizado para el correo: {email}")
                return jsonify({"success": False, "message": "Credenciales inválidas o cuenta inactiva."}), 401

            # Control de sesión seguro en el servidor
            session.clear()
            session['user_id'] = user['id']
            session['role_id'] = user['rol_id']
            session['user_email'] = user['correo']

            # Validación estricta del Rol de Administrador (rol_id == 1 según tu estructura de base de datos)
            if int(user['rol_id']) == 1:
                logger.info(f"Acceso de administrador exitoso: {email}")
                return jsonify({
                    "success": True, 
                    "message": "Acceso de administrador autorizado",
                    "redirect": "/admin/panel"
                }), 200
            else:
                logger.info(f"Acceso de usuario estándar exitoso: {email}")
                return jsonify({
                    "success": True, 
                    "message": "Inicio de sesión exitoso",
                    "redirect": "/dashboard"
                }), 200

        except Exception as e:
            logger.error(f"Error crítico en process_login: {str(e)}")
            return jsonify({"success": False, "message": "Error interno en el servidor."}), 500

    @staticmethod
    def render_admin_panel():
        """Renderiza el panel de administración validando la sesión activa por seguridad."""
        # Protección básica a nivel de controlador por si intentan entrar por URL directa
        if 'role_id' not in session or int(session['role_id']) != 1:
            return render_template('login.html'), 403
        return render_template('admin/panel_admin.html')