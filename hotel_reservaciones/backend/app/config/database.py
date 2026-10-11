import os
import logging
import mysql.connector
from mysql.connector import Error
from mysql.connector import pooling
from dotenv import load_dotenv

# Cargar explícitamente el archivo .env ubicado en la carpeta backend/
load_dotenv(os.path.join(os.path.dirname(__file__), '../../.env'))

# Configurar el registro de errores interno en la raíz del backend
log_path = os.path.join(os.path.dirname(__file__), '../../db_errors.log')
logging.basicConfig(
    filename=log_path,
    level=logging.ERROR,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

class db:
    _instance = None
    _connection_pool = None

    def __new__(cls):
        """Implementación del Patrón Singleton para una única instancia de conexión/pool."""
        if cls._instance is None:
            cls._instance = super(db, cls).__new__(cls)
            cls._instance._initialize_pool()
        return cls._instance

    def _initialize_pool(self):
        """Inicializa un pool de conexiones seguro para la base de datos."""
        try:
            self._connection_pool = mysql.connector.pooling.MySQLConnectionPool(
                pool_name="hotel_pool",
                pool_size=5,
                pool_reset_session=True,
                host=os.getenv("DB_HOST", "127.0.0.1"),
                port=int(os.getenv("DB_PORT", 3306)),
                database=os.getenv("DB_NAME", "hotel_reservaciones"),
                user=os.getenv("DB_USER", "root"),  
                password=os.getenv("DB_PASS", ""),
                charset='utf8mb4',
                collation='utf8mb4_unicode_ci',
                use_pure=True
            )
        except Error as e:
            logging.error(f"Error al inicializar el pool de conexiones: {e}")
            raise RuntimeError("Ocurrió un error crítico al inicializar la conexión con la base de datos.")

    def get_connection(self):
        """Obtiene una conexión segura desde el pool."""
        try:
            connection = self._connection_pool.get_connection()
            return connection
        except Error as e:
            logging.error(f"Error al obtener la conexión del pool: {e}")
            raise RuntimeError("No se pudo establecer la conexión con el servidor de base de datos.")

db = db()