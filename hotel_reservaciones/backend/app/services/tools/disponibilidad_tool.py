SCHEMA = {
    "type": "function",
    "function": {
        "name": "consultar_disponibilidad",
        "description": "Consulta habitaciones disponibles entre dos fechas.",
        "parameters": {
            "type": "object",
            "properties": {
                "fecha_entrada": {"type": "string", "description": "YYYY-MM-DD"},
                "fecha_salida":  {"type": "string", "description": "YYYY-MM-DD"},
                "personas":      {"type": "integer", "minimum": 1},
            },
            "required": ["fecha_entrada", "fecha_salida"],
        },
    },
}

def ejecutar(args):
    from ..disponibilidad_service import buscar_disponibles
    # Valida fechas aquí antes de tocar la BD
    return buscar_disponibles(
        args["fecha_entrada"], args["fecha_salida"], args.get("personas", 1)
    )