import json
from app.services.deepseek_client import get_client
from app.services.tools import TOOLS_SCHEMA, TOOL_EXECUTORS
from app.models.conversacion import MensajeConversacion
from app.config.database import db

SYSTEM_PROMPT = """Eres el asistente virtual del Hotel. 
Ayudas a consultar disponibilidad, hacer reservaciones, responder preguntas frecuentes y levantar solicitudes.
Reglas:
- Usa las herramientas cuando necesites datos reales.
- Responde de forma amable y concisa.
- Si el usuario quiere reservar, pídele fechas y número de personas. 
- NUNCA inventes precios o disponibilidad."""

def procesar_mensaje(conversacion_id, mensaje_usuario):
    client = get_client()

    # 1. Guardar mensaje del usuario en BD
    msg_user = MensajeConversacion(conversacion_id=conversacion_id, rol='user', contenido=mensaje_usuario)
    db.session.add(msg_user)
    db.session.commit()

    # 2. Armar historial desde la BD
    historial_db = MensajeConversacion.query.filter_by(conversacion_id=conversacion_id).order_by(MensajeConversacion.id).all()
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend([m.to_dict() for m in historial_db])

    # 3. Bucle de DeepSeek
    for _ in range(5):
        resp = client.chat.completions.create(
            model="deepseek-chat",
            messages=messages,
            tools=TOOLS_SCHEMA,
            tool_choice="auto",
        )
        msg_asistente = resp.choices[0].message

        # Guardamos la respuesta del asistente (incluso si pide tools)
        msg_db = MensajeConversacion(
            conversacion_id=conversacion_id,
            rol='assistant',
            contenido=msg_asistente.content,
            tool_calls=json.dumps([tc.model_dump() for tc in msg_asistente.tool_calls]) if msg_asistente.tool_calls else None
        )
        db.session.add(msg_db)
        db.session.commit()
        
        messages.append(msg_asistente)

        if not msg_asistente.tool_calls:
            return {"respuesta": msg_asistente.content}

        # Ejecutar herramientas
        for tc in msg_asistente.tool_calls:
            nombre = tc.function.name
            args = json.loads(tc.function.arguments)
            ejecutor = TOOL_EXECUTORS.get(nombre)
            
            # ATENCIÓN: Si es crear_reservacion, pedimos confirmación al front
            if nombre == "crear_reservacion":
                return {
                    "respuesta": "He verificado los datos. ¿Deseas confirmar la reservación?",
                    "requiere_confirmacion": True,
                    "datos_confirmacion": args
                }

            if ejecutor:
                try:
                    resultado = ejecutor(args)
                except Exception as e:
                    resultado = {"error": str(e)}
            else:
                resultado = {"error": f"Herramienta {nombre} no encontrada"}

            # Guardar resultado de la herramienta en BD
            msg_tool = MensajeConversacion(
                conversacion_id=conversacion_id,
                rol='tool',
                contenido=json.dumps(resultado, ensure_ascii=False, default=str)
            )
            # Omitimos tool_call_id por simplicidad en tu BD, pero se recomienda agregarlo
            db.session.add(msg_tool)
            db.session.commit()
            
            messages.append({
                "role": "tool", 
                "tool_call_id": tc.id, 
                "content": json.dumps(resultado, ensure_ascii=False, default=str)
            })
            
    return {"respuesta": "Lo siento, estoy teniendo problemas para procesar tu solicitud."}