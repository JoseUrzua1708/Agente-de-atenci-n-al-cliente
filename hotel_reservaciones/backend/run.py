import os
import logging
from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS
from app import create_app
from app.config.database import db
load_dotenv()# Carga las variables de entorno desde un archivo .env   

# Configuración estricta de logging para seguridad y auditoría en producción/desarrollo
log_path = os.path.join(os.path.dirname(__file__), 'security_audit.log')
logging.basicConfig(
    filename=log_path,
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger("SecurityAuditor")

def verify_and_secure_environment():
    """Valida que las credenciales críticas y variables de entorno existan antes de arrancar."""
    required_vars = ["DB_PASS", "SECRET_KEY"]
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        error_msg = f"CRITICAL SECURITY ERROR: Faltan variables de entorno obligatorias: {missing_vars}"
        logger.critical(error_msg)
        raise EnvironmentError(error_msg)
    
    logger.info("Verificación de variables de entorno completada con éxito.")

def test_database_connection_safely():
    """Prueba la conexión a la base de datos de manera segura al arrancar el servidor."""
    try:
        connection = db.get_connection()
        if connection.is_connected():
            logger.info("Conexión a la Base de Datos MySQL establecida correctamente.")
            print(" [OK] Base de datos conectada de manera segura vía Pool.")
            connection.close() # Liberar inmediatamente de vuelta al pool
    except Exception as e:
        logger.critical(f"Fallo crítico al conectar con la Base de Datos: {e}")
        print(f" [ERROR CRÍTICO] No se pudo conectar a la base de datos: {e}")
        raise

# Inicializamos las validaciones de seguridad antes de levantar la app
verify_and_secure_environment()
test_database_connection_safely()

# Creamos la aplicación utilizando la fábrica
app = create_app()


# Configuración de CORS estricta (restringir orígenes en entornos reales, aquí abierto de forma controlada)
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

# Medida de seguridad: Agregar cabeceras de seguridad HTTP a todas las respuestas
@app.after_request
def set_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    return response

# Manejador global seguro para errores internos (evita filtrar trazas o información sensible al cliente)
@app.errorhandler(500)
def handle_internal_server_error(e):
    logger.error(f"Error interno del servidor capturado: {e}")
    return jsonify({
        "error": "Ocurrió un error interno en el servidor. Por favor, intente más tarde."
    }), 500

if __name__ == '__main__':
    # Carga segura del puerto desde el entorno, por defecto 4005
    port = int(os.getenv("PORT", 4005))
    
    # Desactivamos debug en producción por seguridad estricta
    is_development = os.getenv("FLASK_ENV", "development") == "development"
    
    logger.info(f"Iniciando servidor Flask en puerto {port} (Modo Debug: {is_development})")
    app.run(host='0.0.0.0', port=port, debug=is_development)