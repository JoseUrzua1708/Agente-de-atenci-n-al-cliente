-- ============================================================
-- BASE DE DATOS: hotel_reservaciones
-- Gestor Inteligente de Reservaciones para Hotel
-- MySQL 8.0+
-- ============================================================

DROP DATABASE IF EXISTS hotel_reservaciones;
CREATE DATABASE hotel_reservaciones
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE hotel_reservaciones;

-- ============================================================
-- 1. ROLES
-- 1 = ADMINISTRADOR, 2 = RECEPCIONISTA, 3 = CLIENTE
-- ============================================================
CREATE TABLE roles (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion VARCHAR(255),
    estado TINYINT(1) NOT NULL DEFAULT 1, -- 1: ACTIVO, 2: INACTIVO
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
-
-- ============================================================
-- 2. USUARIOS
-- ============================================================
CREATE TABLE usuarios (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    rol_id INT UNSIGNED NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellidos VARCHAR(150),
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    telefono VARCHAR(25),
    estado ENUM('ACTIVO','INACTIVO','BLOQUEADO') NOT NULL DEFAULT 'ACTIVO',
    ultimo_acceso DATETIME NULL,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_usuarios_roles
        FOREIGN KEY (rol_id) REFERENCES roles(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    INDEX idx_usuarios_rol (rol_id),
    INDEX idx_usuarios_estado (estado)
) ENGINE=InnoDB;

-- ============================================================
-- 3. CLIENTES
-- Un cliente puede reservar sin necesariamente ser usuario
-- administrativo del sistema.
-- ============================================================
CREATE TABLE clientes (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario_id BIGINT UNSIGNED NULL,
    nombre VARCHAR(100) NOT NULL,
    apellidos VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    telefono VARCHAR(25),
    documento_tipo VARCHAR(30),
    documento_numero VARCHAR(50),
    nacionalidad VARCHAR(80),
    idioma_preferido VARCHAR(10) NOT NULL DEFAULT 'es',
    fecha_nacimiento DATE NULL,
    observaciones TEXT,
    fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_clientes_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    INDEX idx_clientes_email (email),
    INDEX idx_clientes_nombre (apellidos, nombre),
    UNIQUE KEY uk_cliente_documento (documento_tipo, documento_numero)
) ENGINE=InnoDB;

-- ============================================================
-- 4. TIPOS DE HABITACIÓN
-- ============================================================
CREATE TABLE tipos_habitacion (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL UNIQUE,
    descripcion TEXT,
    capacidad_adultos TINYINT UNSIGNED NOT NULL DEFAULT 1,
    capacidad_ninos TINYINT UNSIGNED NOT NULL DEFAULT 0,
    precio_base DECIMAL(10,2) NOT NULL,
    amenidades TEXT,
    estado TINYINT(1) NOT NULL DEFAULT 1, -- 1: ACTIVO, 2: INACTIVO
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_tipo_precio CHECK (precio_base >= 0),
    CONSTRAINT chk_tipo_capacidad CHECK (
        capacidad_adultos + capacidad_ninos > 0
    )
) ENGINE=InnoDB;

-- ============================================================
-- 5. HABITACIONES
-- ============================================================
CREATE TABLE habitaciones (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tipo_id INT UNSIGNED NOT NULL,
    numero VARCHAR(10) NOT NULL UNIQUE,
    piso TINYINT NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10,2) NOT NULL,
    estado ENUM(
        'DISPONIBLE',
        'RESERVADA',
        'OCUPADA',
        'LIMPIEZA',
        'MANTENIMIENTO',
        'INACTIVA'
    ) NOT NULL DEFAULT 'DISPONIBLE',
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_habitaciones_tipo
        FOREIGN KEY (tipo_id) REFERENCES tipos_habitacion(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT chk_habitacion_precio CHECK (precio >= 0),

    INDEX idx_habitaciones_tipo (tipo_id),
    INDEX idx_habitaciones_estado (estado)
) ENGINE=InnoDB;

-- ============================================================
-- 6. RESERVACIONES
-- ============================================================
CREATE TABLE reservaciones (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    codigo_reservacion VARCHAR(30) NOT NULL UNIQUE,
    cliente_id BIGINT UNSIGNED NOT NULL,
    habitacion_id INT UNSIGNED NOT NULL,
    fecha_entrada DATE NOT NULL,
    fecha_salida DATE NOT NULL,
    numero_huespedes TINYINT UNSIGNED NOT NULL DEFAULT 1,
    adultos TINYINT UNSIGNED NOT NULL DEFAULT 1,
    ninos TINYINT UNSIGNED NOT NULL DEFAULT 0,
    precio_noche DECIMAL(10,2) NOT NULL,
    numero_noches INT UNSIGNED NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    impuestos DECIMAL(10,2) NOT NULL DEFAULT 0,
    descuento DECIMAL(10,2) NOT NULL DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    estado ENUM(
        'PENDIENTE',
        'CONFIRMADA',
        'CHECK_IN',
        'CHECK_OUT',
        'CANCELADA',
        'NO_SHOW'
    ) NOT NULL DEFAULT 'PENDIENTE',
    origen ENUM(
        'WEB',
        'RECEPCION',
        'CHATBOT',
        'TELEFONO'
    ) NOT NULL DEFAULT 'WEB',
    comentarios TEXT,
    fecha_reservacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_reservaciones_cliente
        FOREIGN KEY (cliente_id) REFERENCES clientes(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_reservaciones_habitacion
        FOREIGN KEY (habitacion_id) REFERENCES habitaciones(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT chk_fechas_reserva CHECK (fecha_salida > fecha_entrada),
    CONSTRAINT chk_huespedes CHECK (
        numero_huespedes > 0
        AND adultos > 0
        AND numero_huespedes = adultos + ninos
    ),
    CONSTRAINT chk_montos_reserva CHECK (
        precio_noche >= 0
        AND subtotal >= 0
        AND impuestos >= 0
        AND descuento >= 0
        AND total >= 0
    ),

    INDEX idx_reservaciones_cliente (cliente_id),
    INDEX idx_reservaciones_habitacion (habitacion_id),
    INDEX idx_reservaciones_fechas (fecha_entrada, fecha_salida),
    INDEX idx_reservaciones_estado (estado),
    INDEX idx_reservaciones_codigo (codigo_reservacion)
) ENGINE=InnoDB;

-- ============================================================
-- 7. PAGOS
-- ============================================================
CREATE TABLE pagos (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reservacion_id BIGINT UNSIGNED NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    metodo_pago ENUM(
        'EFECTIVO',
        'TARJETA',
        'TRANSFERENCIA',
        'PAYPAL',
        'OTRO'
    ) NOT NULL,
    estado ENUM(
        'PENDIENTE',
        'APROBADO',
        'RECHAZADO',
        'REEMBOLSADO'
    ) NOT NULL DEFAULT 'PENDIENTE',
    referencia VARCHAR(100),
    fecha_pago DATETIME NULL,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_pagos_reservacion
        FOREIGN KEY (reservacion_id) REFERENCES reservaciones(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT chk_pago_monto CHECK (monto > 0),

    INDEX idx_pagos_reservacion (reservacion_id),
    INDEX idx_pagos_estado (estado)
) ENGINE=InnoDB;

-- ============================================================
-- 8. PREGUNTAS FRECUENTES (FAQ)
-- ============================================================
CREATE TABLE preguntas_frecuentes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    pregunta VARCHAR(500) NOT NULL,
    respuesta TEXT NOT NULL,
    categoria VARCHAR(80) NOT NULL,
    idioma VARCHAR(10) NOT NULL DEFAULT 'es',
    palabras_clave VARCHAR(500),
    prioridad TINYINT UNSIGNED NOT NULL DEFAULT 1,
    estado TINYINT(1) NOT NULL DEFAULT 1, -- 1: ACTIVO, 2: INACTIVO
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_faq_categoria (categoria),
    INDEX idx_faq_idioma (idioma),
    INDEX idx_faq_estado (estado)
) ENGINE=InnoDB;

-- ============================================================
-- 9. SOLICITUDES DE ATENCIÓN
-- ============================================================
CREATE TABLE solicitudes (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    cliente_id BIGINT UNSIGNED NULL,
    reservacion_id BIGINT UNSIGNED NULL,
    tipo ENUM(
        'RESERVACION',
        'CANCELACION',
        'MODIFICACION',
        'PREGUNTA',
        'QUEJA',
        'MANTENIMIENTO',
        'SERVICIO',
        'OTRO'
    ) NOT NULL,
    asunto VARCHAR(200) NOT NULL,
    mensaje TEXT NOT NULL,
    prioridad ENUM('BAJA','MEDIA','ALTA','URGENTE') NOT NULL DEFAULT 'MEDIA',
    canal ENUM('WEB','CHATBOT','TELEFONO','RECEPCION') NOT NULL DEFAULT 'WEB',
    estado ENUM(
        'ABIERTA',
        'EN_PROCESO',
        'RESUELTA',
        'CERRADA'
    ) NOT NULL DEFAULT 'ABIERTA',
    asignado_a BIGINT UNSIGNED NULL,
    respuesta TEXT,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_resolucion DATETIME NULL,

    CONSTRAINT fk_solicitudes_cliente
        FOREIGN KEY (cliente_id) REFERENCES clientes(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT fk_solicitudes_reservacion
        FOREIGN KEY (reservacion_id) REFERENCES reservaciones(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT fk_solicitudes_usuario
        FOREIGN KEY (asignado_a) REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    INDEX idx_solicitudes_estado (estado),
    INDEX idx_solicitudes_prioridad (prioridad),
    INDEX idx_solicitudes_tipo (tipo),
    INDEX idx_solicitudes_cliente (cliente_id)
) ENGINE=InnoDB;

-- ============================================================
-- 10. NOTIFICACIONES
-- ============================================================
CREATE TABLE notificaciones (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    usuario_id BIGINT UNSIGNED NULL,
    cliente_id BIGINT UNSIGNED NULL,
    reservacion_id BIGINT UNSIGNED NULL,
    tipo ENUM(
        'CONFIRMACION',
        'RECORDATORIO',
        'BIENVENIDA',
        'CHECK_IN',
        'CHECK_OUT',
        'ENCUESTA',
        'CANCELACION',
        'GENERAL'
    ) NOT NULL,
    canal ENUM('WEB','EMAIL','SMS','WHATSAPP') NOT NULL DEFAULT 'WEB',
    asunto VARCHAR(200) NOT NULL,
    mensaje TEXT NOT NULL,
    estado ENUM(
        'PENDIENTE',
        'ENVIADA',
        'ERROR',
        'LEIDA'
    ) NOT NULL DEFAULT 'PENDIENTE',
    fecha_programada DATETIME NULL,
    fecha_envio DATETIME NULL,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_notificaciones_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT fk_notificaciones_cliente
        FOREIGN KEY (cliente_id) REFERENCES clientes(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT fk_notificaciones_reservacion
        FOREIGN KEY (reservacion_id) REFERENCES reservaciones(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    INDEX idx_notificaciones_estado (estado),
    INDEX idx_notificaciones_programada (fecha_programada),
    INDEX idx_notificaciones_cliente (cliente_id)
) ENGINE=InnoDB;

-- ============================================================
-- 11. ENCUESTAS DE SATISFACCIÓN
-- ============================================================
CREATE TABLE encuestas (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reservacion_id BIGINT UNSIGNED NOT NULL,
    cliente_id BIGINT UNSIGNED NOT NULL,
    calificacion TINYINT UNSIGNED NOT NULL,
    comentario TEXT,
    respondida_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_encuestas_reservacion
        FOREIGN KEY (reservacion_id) REFERENCES reservaciones(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_encuestas_cliente
        FOREIGN KEY (cliente_id) REFERENCES clientes(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT chk_encuesta_calificacion CHECK (
        calificacion BETWEEN 1 AND 5
    ),

    UNIQUE KEY uk_encuesta_reservacion (reservacion_id)
) ENGINE=InnoDB;

-- ============================================================
-- 12. HISTORIAL DE ESTADOS DE RESERVACIÓN
-- ============================================================
CREATE TABLE historial_reservaciones (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    reservacion_id BIGINT UNSIGNED NOT NULL,
    usuario_id BIGINT UNSIGNED NULL,
    estado_anterior VARCHAR(30),
    estado_nuevo VARCHAR(30) NOT NULL,
    comentario VARCHAR(500),
    fecha_cambio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_historial_reservacion
        FOREIGN KEY (reservacion_id) REFERENCES reservaciones(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_historial_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    INDEX idx_historial_reservacion (reservacion_id)
) ENGINE=InnoDB;

-- ============================================================
-- DATOS INICIALES (Con roles numéricos: 1=ADMIN, 2=RECEPCIONISTA, 3=CLIENTE)
-- ============================================================

INSERT INTO roles (id, nombre, descripcion, estado) VALUES
(1, 'ADMINISTRADOR', 'Administración general del sistema', 1),
(2, 'RECEPCIONISTA', 'Gestión de clientes y reservaciones', 1),
(3, 'CLIENTE', 'Cliente que realiza reservaciones', 1);

INSERT INTO tipos_habitacion
(nombre, descripcion, capacidad_adultos, capacidad_ninos, precio_base, amenidades, estado)
VALUES
('Individual', 'Habitación para una persona', 1, 0, 850.00,
 'Wi-Fi, TV, Aire acondicionado', 1),
('Doble', 'Habitación para dos personas', 2, 1, 1200.00,
 'Wi-Fi, TV, Aire acondicionado', 1),
('Suite', 'Habitación amplia con servicios adicionales', 2, 2, 2200.00,
 'Wi-Fi, TV, Aire acondicionado, Minibar, Sala', 1);

INSERT INTO habitaciones
(tipo_id, numero, piso, descripcion, precio, estado)
VALUES
(1, '101', 1, 'Habitación individual', 850.00, 'DISPONIBLE'),
(1, '102', 1, 'Habitación individual', 850.00, 'DISPONIBLE'),
(2, '201', 2, 'Habitación doble', 1200.00, 'DISPONIBLE'),
(2, '202', 2, 'Habitación doble', 1200.00, 'DISPONIBLE'),
(3, '301', 3, 'Suite principal', 2200.00, 'DISPONIBLE');

INSERT INTO preguntas_frecuentes
(pregunta, respuesta, categoria, idioma, palabras_clave, prioridad, estado)
VALUES
('¿A qué hora es el check-in?',
 'El horario de check-in es a partir de las 15:00 horas.',
 'CHECK-IN', 'es', 'check-in,entrada,llegada', 1, 1),

('¿A qué hora es el check-out?',
 'El horario de check-out es hasta las 12:00 horas.',
 'CHECK-OUT', 'es', 'check-out,salida,horario', 1, 1),

('¿Cómo puedo realizar una reservación?',
 'Seleccione las fechas de entrada y salida, consulte la disponibilidad y complete los datos solicitados.',
 'RESERVACIONES', 'es', 'reservar,reservación,habitación', 1, 1),

('¿El hotel cuenta con Wi-Fi?',
 'Sí. El hotel cuenta con servicio de Wi-Fi para los huéspedes.',
 'SERVICIOS', 'es', 'wifi,internet,conexión', 2, 1),

('What time is check-in?',
 'Check-in starts at 3:00 PM.',
 'CHECK-IN', 'en', 'check-in,arrival', 1, 1),

('What time is check-out?',
 'Check-out is until 12:00 PM.',
 'CHECK-OUT', 'en', 'check-out,departure', 1, 1);

-- ============================================================
-- VISTAS ÚTILES
-- ============================================================

-- Reservaciones con información de cliente y habitación
CREATE VIEW vw_reservaciones AS
SELECT
    r.id,
    r.codigo_reservacion,
    CONCAT(c.nombre, ' ', c.apellidos) AS cliente,
    c.email,
    c.telefono,
    h.numero AS habitacion,
    th.nombre AS tipo_habitacion,
    r.fecha_entrada,
    r.fecha_salida,
    r.numero_huespedes,
    r.total,
    r.estado,
    r.origen,
    r.fecha_reservacion
FROM reservaciones r
INNER JOIN clientes c ON c.id = r.cliente_id
INNER JOIN habitaciones h ON h.id = r.habitacion_id
INNER JOIN tipos_habitacion th ON th.id = h.tipo_id;

-- Estado general de habitaciones
CREATE VIEW vw_estado_habitaciones AS
SELECT
    h.id,
    h.numero,
    h.piso,
    th.nombre AS tipo,
    h.precio,
    h.estado
FROM habitaciones h
INNER JOIN tipos_habitacion th ON th.id = h.tipo_id;

-- ============================================================
-- CONSULTA PARA DISPONIBILIDAD
-- ============================================================
-- Ejemplo: buscar habitaciones disponibles entre
-- 2026-10-10 y 2026-10-13.
--
-- IMPORTANTE:
-- Las fechas de salida y entrada se consideran límites abiertos:
-- una reservación que sale el día 13 no bloquea una nueva
-- reservación que entra el día 13.
--
-- SELECT h.*
-- FROM habitaciones h
-- WHERE h.estado NOT IN ('MANTENIMIENTO', 'INACTIVA')
-- AND NOT EXISTS (
--     SELECT 1
--     FROM reservaciones r
--     WHERE r.habitacion_id = h.id
--       AND r.estado IN ('PENDIENTE', 'CONFIRMADA', 'CHECK_IN')
--       AND r.fecha_entrada < '2026-10-13'
--       AND r.fecha_salida > '2026-10-10'
-- );

-- ============================================================
-- 13. CONVERSACIONES (Historial del Chatbot)
-- ============================================================
CREATE TABLE conversaciones (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    cliente_id BIGINT UNSIGNED NULL,
    usuario_id BIGINT UNSIGNED NULL,
    canal ENUM('WEB','CHATBOT','WHATSAPP') DEFAULT 'CHATBOT',
    iniciada_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_conversaciones_cliente
        FOREIGN KEY (cliente_id) REFERENCES clientes(id) 
        ON UPDATE CASCADE ON DELETE SET NULL,
        
    CONSTRAINT fk_conversaciones_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) 
        ON UPDATE CASCADE ON DELETE SET NULL,
        
    INDEX idx_conversaciones_cliente (cliente_id),
    INDEX idx_conversaciones_usuario (usuario_id)
) ENGINE=InnoDB;

-- ============================================================
-- 14. MENSAJES DE CONVERSACIÓN
-- ============================================================
CREATE TABLE mensajes_conversacion (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    conversacion_id BIGINT UNSIGNED NOT NULL,
    rol ENUM('user','assistant','tool','system') NOT NULL,
    contenido MEDIUMTEXT,
    tool_calls JSON NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_mensajes_conversacion
        FOREIGN KEY (conversacion_id) REFERENCES conversaciones(id) 
        ON UPDATE CASCADE ON DELETE CASCADE,
        
    INDEX idx_mensajes_conversacion (conversacion_id)
) ENGINE=InnoDB;

-- ============================================================
-- FIN DEL SCRIPT
-- ============================================================