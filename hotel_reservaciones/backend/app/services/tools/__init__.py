from . import disponibilidad_tool, reservacion_tool, faq_tool, solicitud_tool

TOOLS_SCHEMA = [
    disponibilidad_tool.SCHEMA,
    reservacion_tool.SCHEMA_CONSULTAR,
    reservacion_tool.SCHEMA_CREAR,
    faq_tool.SCHEMA,
    solicitud_tool.SCHEMA,
]

TOOL_EXECUTORS = {
    "consultar_disponibilidad": disponibilidad_tool.ejecutar,
    "consultar_reservacion": reservacion_tool.consultar,
    "crear_reservacion": reservacion_tool.crear,
    "buscar_faq": faq_tool.ejecutar,
    "crear_solicitud": solicitud_tool.ejecutar,
}