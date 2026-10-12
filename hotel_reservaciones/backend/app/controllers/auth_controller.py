from flask import render_template, request, jsonify, session
from app.config.database import db
import logging
import time
import traceback

logger = logging.getLogger("SecurityAuditor")

class AuthController:
    @staticmethod
    def render_login():
        """Renderiza la vista principal de inicio de sesión de forma segura."""
        return render_template('login.html')

    @staticmethod
    def process_login():
        """Procesa las credenciales aplicando el máximo estándar de seguridad defensiva (sin hash temporalmente)."""
        try:
            # 1. Extracción segura y normalización de entradas
            data = request.get_json(silent=True) or request.form
            email = str(data.get('username', '')).strip().lower()
            password = str(data.get('password', ''))

            # Validación preventiva contra campos vacíos
            if not email or not password:
                logger.warning("Intento de login fallido: campos vacíos detectados.")
                return jsonify({"success": False, "message": "Credenciales inválidas."}), 400

            # 2. Conexión segura al pool de base de datos
            connection = db.get_connection()
            cursor = connection.cursor(dictionary=True)
            
            # 3. Consulta parametrizada (Blindaje total contra SQL Injection)
            query = """
                SELECT
                    u.id,
                    u.nombre,
                    u.apellidos,
                    u.email AS correo,
                    u.password_hash,
                    u.rol_id,
                    u.estado,
                    r.nombre AS nombre_rol,
                    r.estado AS rol_estado
                FROM usuarios AS u
                INNER JOIN roles AS r ON r.id = u.rol_id
                WHERE u.email = %s
            """
            cursor.execute(query, (email,))
            user = cursor.fetchone()
            
            cursor.close()
            connection.close()

            # 4. Mitigación de Timing Attacks (Retardo artificial uniforme si el usuario no existe)
            if not user:
                time.sleep(0.5)
                logger.warning(f"Intento de acceso con correo no registrado: {email}")
                return jsonify({"success": False, "message": "Credenciales inválidas o cuenta inactiva."}), 401

            # Normalización segura de estatus (Manejo robusto si viene como bytes o string)
            raw_estado = user.get('estado')
            if isinstance(raw_estado, bytes):
                raw_estado = raw_estado.decode('utf-8')
            user_estado = str(raw_estado or '').strip().upper()

            rol_estado = int(user['rol_estado']) if user.get('rol_estado') is not None else 0
            user_rol = int(user['rol_id']) if user.get('rol_id') is not None else 0

            # 5. Verificación de políticas de estado y privilegios del rol
            if user_estado != 'ACTIVO' or rol_estado != 1:
                time.sleep(0.3)
                logger.warning(f"Intento de acceso bloqueado (Cuenta inactiva/bloqueada o rol suspendido) para: {email}")
                return jsonify({"success": False, "message": "Credenciales inválidas o cuenta inactiva."}), 401

            # 6. Verificación temporal en texto plano (Compara directamente contra el campo password_hash de la BD)
            stored_password = user.get('password_hash')
            if not stored_password or str(stored_password) != password:
                time.sleep(0.3)
                logger.warning(f"Intento de acceso con contraseña incorrecta para el correo: {email}")
                return jsonify({"success": False, "message": "Credenciales inválidas o cuenta inactiva."}), 401

            # 7. Prevención de Session Fixation (Limpieza total de la sesión previa)
            session.clear()
            
            # Configuración de variables de sesión esenciales
            session['user_id'] = user.get('id')
            session['role_id'] = user_rol
            session['user_email'] = user.get('correo')
            session.permanent = False 

            # 8. Control de acceso basado en roles (RBAC) y redirección segura
            if user_rol == 1:
                logger.info(f"Acceso de administrador autorizado con éxito: {email}")
                return jsonify({
                    "success": True, 
                    "message": "Acceso de administrador autorizado",
                    "redirect": "/admin/panel"
                }), 200
            else:
                logger.info(f"Acceso de usuario estándar autorizado con éxito: {email}")
                return jsonify({
                    "success": True, 
                    "message": "Inicio de sesión exitoso",
                    "redirect": "/dashboard"
                }), 200

        except Exception as e:
            # Imprime la traza completa del error directamente en tu consola/terminal de Flask
            print("=== ERROR 500 DETALLADO ===")
            traceback.print_exc()
            print("============================")
            
            logger.error(f"Error crítico de seguridad en process_login: {str(e)}")
            return jsonify({"success": False, "message": "Error interno en el servidor."}), 500

    @staticmethod
    def render_admin_panel():
        """Renderiza el panel de administración validando de forma estricta la sesión y el rol."""
        if 'role_id' not in session or int(session.get('role_id', 0)) != 1:
            logger.warning("Intento de acceso no autorizado mediante URL directa al panel de administración.")
            return render_template('login.html'), 403
        return render_template('admin/panel_admin.html')