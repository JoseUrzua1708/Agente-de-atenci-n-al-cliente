from flask import render_template, request, jsonify, session
from app.config.database import db
import logging
import traceback

logger = logging.getLogger("SecurityAuditor")

class ClientController:
    @staticmethod
    def render_register():
        """Renderiza la vista principal de creación de cuenta de huésped."""
        return render_template('crear_cuenta.html')

    @staticmethod
    def process_register():
        """Procesa y almacena de forma segura el registro de un nuevo cliente/huésped."""
        connection = None
        cursor = None
        try:
            data = request.get_json(silent=True) or request.form

            # 1. Extracción y normalización de campos obligatorios
            nombre = str(data.get('nombre', '')).strip()
            apellido_paterno = str(data.get('apellido_paterno', '')).strip()
            apellido_materno = str(data.get('apellido_materno', '')).strip()
            email = str(data.get('correo', '')).strip().lower()
            telefono = str(data.get('telefono', '')).strip()
            fecha_nacimiento = data.get('fecha_nacimiento') or None
            nacionalidad = str(data.get('nacionalidad', '')).strip()
            
            tipo_documento = str(data.get('tipo_documento', '')).strip()
            numero_documento = str(data.get('numero_documento', '')).strip()

            # Validación de campos críticos obligatorios
            if not nombre or not apellido_paterno or not email or not telefono or not tipo_documento or not numero_documento:
                logger.warning("Intento de registro fallido: campos obligatorios faltantes.")
                return jsonify({
                    "success": False, 
                    "message": "Por favor completa todos los campos obligatorios marcados con asterisco (*)."
                }), 400

            # Nota: Como el formulario no solicita contraseña explícitamente para los clientes web,
            # podemos generar una contraseña temporal o asignar una por defecto segura si van a tener acceso al sistema,
            # o dejarlos como registros directos en la tabla clientes. Aquí creamos un registro de usuario asociado.
            password_temporal = "Cliente123*" # En producción se puede enviar un correo para establecerla

            connection = db.get_connection()
            cursor = connection.cursor(dictionary=True)

            # Verificar si el correo ya está registrado en el sistema
            cursor.execute("SELECT id FROM usuarios WHERE email = %s", (email,))
            if cursor.fetchone():
                cursor.close()
                connection.close()
                return jsonify({
                    "success": False, 
                    "message": "El correo electrónico ya se encuentra registrado."
                }), 400

            # Iniciar transacción segura
            connection.start_transaction()

            # 2. Insertar en la tabla usuarios (Rol 3 = CLIENTE)
            query_usuario = """
                INSERT INTO usuarios (rol_id, nombre, apellidos, email, password_hash, telefono, estado)
                VALUES (3, %s, %s, %s, %s, %s, 'ACTIVO')
            """
            apellidos_completi = f"{apellido_paterno} {apellido_materno}".strip()
            cursor.execute(query_usuario, (nombre, apellidos_completi, email, password_temporal, telefono))
            usuario_id = cursor.lastrowid

            # 3. Insertar en la tabla clientes con todos los campos extendidos del formulario
            # Concatenamos información adicional en el campo de observaciones o guardamos lo estructurado
            observaciones_dict = {
                "genero": data.get('genero'),
                "telefono_emergencia": data.get('telefono_emergencia'),
                "contacto_emergencia": data.get('contacto_emergencia'),
                "emision_documento": data.get('emision_documento'),
                "direccion": data.get('direccion'),
                "ciudad": data.get('ciudad'),
                "estado": data.get('estado'),
                "codigo_postal": data.get('codigo_postal'),
                "pais": data.get('pais'),
                "facturacion": {
                    "razon_social": data.get('razon_social'),
                    "rfc": data.get('rfc'),
                    "regimen_fiscal": data.get('regimen_fiscal'),
                    "uso_cfdi": data.get('uso_cfdi'),
                    "correo_facturacion": data.get('correo_facturacion'),
                    "direccion_fiscal": data.get('direccion_fiscal')
                },
                "preferencias": {
                    "habitacion": data.get('preferencia_habitacion'),
                    "fumador": data.get('preferencia_fumador'),
                    "viaja_mascotas": data.get('viaja_mascotas'),
                    "detalle_mascotas": data.get('detalle_mascotas'),
                    "accesibilidad": data.get('accesibilidad'),
                    "alergias": data.get('alergias')
                },
                "pago": {
                    "tipo_tarjeta": data.get('tipo_tarjeta'),
                    "titular_tarjeta": data.get('titular_tarjeta'),
                    "ultimos_digitos": data.get('ultimos_digitos_tarjeta')
                }
            }

            import json
            observaciones_json = json.dumps(observaciones_dict, ensure_ascii=False)

            query_cliente = """
                INSERT INTO clientes (
                    usuario_id, nombre, apellidos, email, telefono, 
                    documento_tipo, documento_numero, nacionalidad, 
                    fecha_nacimiento, observaciones
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            cursor.execute(query_cliente, (
                usuario_id, nombre, apellido_paterno, email, telefono,
                tipo_documento, numero_documento, nacionalidad,
                fecha_nacimiento if fecha_nacimiento else None,
                observaciones_json
            ))

            connection.commit()
            cursor.close()
            connection.close()

            logger.info(f"Nuevo cliente registrado con éxito: {email}")
            return jsonify({
                "success": True,
                "message": "Cuenta creada exitosamente. Ya puedes iniciar sesión.",
                "redirect": "/login"
            }), 200

        except Exception as e:
            if connection:
                connection.rollback()
            if cursor:
                cursor.close()
            if connection:
                connection.close()

            print("=== ERROR 500 DETALLADO EN REGISTRO ===")
            traceback.print_exc()
            print("=======================================")

            logger.error(f"Error crítico al registrar cliente: {str(e)}")
            return jsonify({
                "success": False, 
                "message": "Ocurrió un error interno al procesar tu registro. Inténtalo más tarde."
            }), 500