-- ============================================================
-- MIGRACIÓN: AGENTES DE IA (monitor de chats para recepción)
-- Ejecutar después de base_datos.sql. Es idempotente.
-- El bot (WhatsApp / chat web) escribe aquí sus conversaciones;
-- recepción las supervisa, toma el control y responde.
-- ============================================================
USE hotel_reservaciones;

CREATE TABLE IF NOT EXISTS conversaciones (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    cliente_id BIGINT UNSIGNED NULL,
    reservacion_id BIGINT UNSIGNED NULL,
    canal ENUM('WHATSAPP','WEB') NOT NULL,
    contacto VARCHAR(150) NOT NULL,                 -- teléfono o id de sesión web
    nombre_contacto VARCHAR(150),
    modo ENUM('BOT','HUMANO') NOT NULL DEFAULT 'BOT',
    requiere_humano TINYINT(1) NOT NULL DEFAULT 0, -- el bot pide ayuda o el huésped pide una persona
    estado ENUM('ACTIVA','CERRADA') NOT NULL DEFAULT 'ACTIVA',
    atendida_por BIGINT UNSIGNED NULL,
    fecha_inicio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ultimo_mensaje DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_conversaciones_cliente
        FOREIGN KEY (cliente_id) REFERENCES clientes(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT fk_conversaciones_reservacion
        FOREIGN KEY (reservacion_id) REFERENCES reservaciones(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    CONSTRAINT fk_conversaciones_usuario
        FOREIGN KEY (atendida_por) REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    INDEX idx_conversaciones_estado (estado, ultimo_mensaje),
    INDEX idx_conversaciones_contacto (canal, contacto)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS mensajes (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    conversacion_id BIGINT UNSIGNED NOT NULL,
    emisor ENUM('HUESPED','BOT','RECEPCION') NOT NULL,
    usuario_id BIGINT UNSIGNED NULL,               -- quién respondió, si fue recepción
    contenido TEXT NOT NULL,
    entregado TINYINT(1) NOT NULL DEFAULT 1,       -- 0 = respuesta de recepción que el bot aún debe enviar
    marcado_incorrecto TINYINT(1) NOT NULL DEFAULT 0,
    nota_revision VARCHAR(500),
    fecha TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_mensajes_conversacion
        FOREIGN KEY (conversacion_id) REFERENCES conversaciones(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_mensajes_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL,

    INDEX idx_mensajes_conversacion (conversacion_id, fecha),
    INDEX idx_mensajes_pendientes (entregado),
    INDEX idx_mensajes_revision (marcado_incorrecto)
) ENGINE=InnoDB;
