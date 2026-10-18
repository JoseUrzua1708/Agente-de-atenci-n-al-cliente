-- ============================================================
-- SCRIPT DE DATOS INICIALES (SEED) - HOTEL RESERVACIONES
-- ============================================================

USE hotel_reservaciones;

-- 1. ROLES DEL SISTEMA
INSERT INTO roles (id, nombre, descripcion, estado) VALUES
(1, 'ADMINISTRADOR', 'Administración general del sistema y control total', 1),
(2, 'RECEPCIONISTA', 'Gestión de clientes, check-in, check-out y reservaciones', 1),
(3, 'CLIENTE', 'Usuario final que realiza reservaciones desde la web', 1)
ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion);

-- 2. USUARIO ADMINISTRADOR Y RECEPCIÓN POR DEFECTO
-- Nota: Se incluyen hashes válidos generados por Werkzeug para "Admin1234*" y "Recepcion123*"
INSERT INTO usuarios (rol_id, nombre, apellidos, email, password_hash, telefono, estado) VALUES
(
    1, 
    'Administrador', 
    'General', 
    'admin@maisonhotel.com', 
    'Admin1234*', 
    '+527441234567', 
    'ACTIVO'
),
(
    2, 
    'Carlos', 
    'Recepción', 
    'recepcion@maisonhotel.com', 
    'Resepción123$', 
    '+527447654321', 
    'ACTIVO'
),
(
    2, 
    'Felipe', 
    'Cliente', 
    'cliente@maisonhotel.com', 
    'Cliente123$', 
    '+527447654321', 
    'ACTIVO'
)
ON DUPLICATE KEY UPDATE email = VALUES(email);

-- 3. TIPOS DE HABITACIÓN
INSERT INTO tipos_habitacion (id, nombre, descripcion, capacidad_adultos, capacidad_ninos, precio_base, amenidades) VALUES
(1, 'Individual', 'Habitación confortable para una persona con vista interior', 1, 0, 850.00, 'Wi-Fi, TV Smart, Aire acondicionado, Escritorio'),
(2, 'Doble', 'Habitación amplia con dos camas individuales o una matrimonial', 2, 1, 1200.00, 'Wi-Fi, TV Smart, Aire acondicionado, Minibar'),
(3, 'Suite de Lujo', 'Suite exclusiva con sala de estar, jacuzzi y vista panorámica', 2, 2, 2500.00, 'Wi-Fi, TV Smart 65", Aire acondicionado, Minibar, Jacuzzi, Sala independiente')
ON DUPLICATE KEY UPDATE precio_base = VALUES(precio_base);

-- 4. HABITACIONES FÍSICAS
INSERT INTO habitaciones (tipo_id, numero, piso, descripcion, precio, estado) VALUES
(1, '101', 1, 'Habitación individual estándar', 850.00, 'DISPONIBLE'),
(1, '102', 1, 'Habitación individual estándar', 850.00, 'DISPONIBLE'),
(2, '201', 2, 'Habitación doble con balcón', 1200.00, 'DISPONIBLE'),
(2, '202', 2, 'Habitación doble estándar', 1200.00, 'DISPONIBLE'),
(3, '301', 3, 'Suite presidencial principal', 2500.00, 'DISPONIBLE')
ON DUPLICATE KEY UPDATE precio = VALUES(precio);

-- 5. CLIENTE DE PRUEBA
INSERT INTO clientes (usuario_id, nombre, apellidos, email, telefono, documento_tipo, documento_numero, nacionalidad, idioma_preferido) VALUES
(
    NULL, 
    'Juan', 
    'Pérez Gómez', 
    'juan.perez@example.com', 
    '+527449876543', 
    'INE', 
    'ABC123456789', 
    'Mexicana', 
    'es'
);



-- 6. PREGUNTAS FRECUENTES (FAQ) PARA EL CHATBOT Y ATENCIÓN
INSERT INTO preguntas_frecuentes (pregunta, respuesta, categoria, idioma, palabras_clave, prioridad) VALUES
('¿A qué hora es el check-in?', 'El horario de check-in es a partir de las 15:00 horas.', 'CHECK-IN', 'es', 'check-in,entrada,llegada,horas', 1),
('¿A qué hora es el check-out?', 'El horario límite para realizar el check-out es hasta las 12:00 horas.', 'CHECK-OUT', 'es', 'check-out,salida,horario', 1),
('¿Cuáles son las formas de pago aceptadas?', 'Aceptamos tarjetas de crédito/débito, transferencias bancarias y efectivo directamente en recepción.', 'PAGOS', 'es', 'pagos,tarjeta,efectivo,transferencia', 2),
('¿El hotel cuenta con estacionamiento?', 'Sí, contamos con estacionamiento privado gratuito para todos nuestros huéspedes.', 'SERVICIOS', 'es', 'estacionamiento,carro,auto,parking', 2);