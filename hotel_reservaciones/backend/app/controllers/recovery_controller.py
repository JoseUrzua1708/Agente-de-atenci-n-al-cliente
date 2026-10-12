from flask import render_template, request, jsonify
from app.config.database import db
import logging
import time
import traceback

logger = logging.getLogger("SecurityAuditor")

class RecoveryController:
    @staticmethod
    def render_recover():
        """Renderiza la vista principal de recuperación de contraseña de forma segura."""
        return render_template('recuperar_contraseña.html')

    @staticmethod
    def process_recover():
        """Procesa la solicitud de recuperación aplicando seguridad defensiva."""
        try:
            data = request.get_json(silent=True) or request.form
            email = str(data.get('email', '')).strip().lower()

            if not email:
                logger.warning("Intento de recuperación fallido: correo electrónico vacío.")
                return jsonify({"success": False, "message": "El correo electrónico es obligatorio."}), 400

            # Conexión segura al pool de base de datos
            connection = db.get_connection()
            cursor = connection.cursor(dictionary=True)
            
            query = "SELECT id, email FROM usuarios WHERE email = %s"
            cursor.execute(query, (email,))
            user = cursor.fetchone()
            
            cursor.close()
            connection.close()

            # Mitigación de Timing Attacks y protección contra enumeración de correos
            time.sleep(0.4)
            logger.info(f"Solicitud de recuperación procesada para el correo: {email}")

            # Respuesta genérica exitosa para no revelar si el correo existe o no en la BD
            return jsonify({
                "success": True,
                "message": "Si el correo está registrado en el sistema, recibirás las instrucciones en breve."
            }), 200

        except Exception as e:
            print("=== ERROR 500 DETALLADO EN RECUPERACIÓN ===")
            traceback.print_exc()
            print("===========================================")
            
            logger.error(f"Error crítico en process_recover: {str(e)}")
            return jsonify({"success": False, "message": "Error interno en el servidor."}), 500