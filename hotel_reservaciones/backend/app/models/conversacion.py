# backend/app/models/conversacion.py

from datetime import datetime
from app.config.database import db
import json

class Conversacion(db.Model):
    __tablename__ = 'conversaciones'

    id = db.Column(db.BigInteger().with_variant(db.Integer, "sqlite"), primary_key=True, autoincrement=True)
    cliente_id = db.Column(db.BigInteger, db.ForeignKey('clientes.id', ondelete='SET NULL', onupdate='CASCADE'), nullable=True)
    usuario_id = db.Column(db.BigInteger, db.ForeignKey('usuarios.id', ondelete='SET NULL', onupdate='CASCADE'), nullable=True)
    canal = db.Column(db.Enum('WEB', 'CHATBOT', 'WHATSAPP', name='canal_enum'), default='CHATBOT')
    iniciada_en = db.Column(db.TIMESTAMP, default=datetime.utcnow)

    # Relaciones (opcionales, para consultas rápidas)
    cliente = db.relationship('Cliente', backref=db.backref('conversaciones', lazy=True))
    usuario = db.relationship('Usuario', backref=db.backref('conversaciones', lazy=True))
    
    # Relación uno-a-muchos con los mensajes
    mensajes = db.relationship('MensajeConversacion', backref='conversacion', lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Conversacion {self.id} - Canal: {self.canal}>"


class MensajeConversacion(db.Model):
    __tablename__ = 'mensajes_conversacion'

    id = db.Column(db.BigInteger().with_variant(db.Integer, "sqlite"), primary_key=True, autoincrement=True)
    conversacion_id = db.Column(db.BigInteger, db.ForeignKey('conversaciones.id', ondelete='CASCADE', onupdate='CASCADE'), nullable=False)
    rol = db.Column(db.Enum('user', 'assistant', 'tool', 'system', name='rol_enum'), nullable=False)
    contenido = db.Column(db.Text, nullable=True) # MEDIUMTEXT en MySQL, Text en SQLAlchemy
    tool_calls = db.Column(db.JSON, nullable=True)
    creado_en = db.Column(db.TIMESTAMP, default=datetime.utcnow)

    def to_dict(self):
        """Útil para enviar los mensajes al frontend o formatearlos."""
        return {
            "role": self.rol,
            "content": self.contenido,
            # Si hay tool_calls guardados como string JSON, los decodificamos
            "tool_calls": json.loads(self.tool_calls) if isinstance(self.tool_calls, str) else self.tool_calls
        }

    def __repr__(self):
        return f"<Mensaje {self.id} - Rol: {self.rol}>"