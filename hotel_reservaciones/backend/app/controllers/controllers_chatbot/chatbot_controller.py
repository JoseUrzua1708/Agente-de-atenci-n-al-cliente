from flask import request, jsonify, session
from app.services.chatbot_service import procesar_mensaje
from app.models.conversacion import Conversacion, MensajeConversacion
from app.config.database import db

def enviar_mensaje():
    data = request.get_json() or {}
    mensaje = (data.get("mensaje") or "").strip()
    conversacion_id = data.get("conversacion_id")

    if not mensaje:
        return jsonify({"error": "El mensaje no puede estar vacío"}), 400

    # 1. Crear o recuperar la conversación
    if not conversacion_id:
        # Si el usuario está logueado, lo asociamos (ajusta esto según tu login)
        usuario_id = session.get('usuario_id') 
        nueva_conv = Conversacion(usuario_id=usuario_id, canal='CHATBOT')
        db.session.add(nueva_conv)
        db.session.commit()
        conversacion_id = nueva_conv.id

    # 2. Llamar al servicio que habla con DeepSeek
    try:
        resultado = procesar_mensaje(conversacion_id, mensaje)
        return jsonify({
            "respuesta": resultado["respuesta"],
            "conversacion_id": conversacion_id,
            "requiere_confirmacion": resultado.get("requiere_confirmacion", False),
            "datos_confirmacion": resultado.get("datos_confirmacion")
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500