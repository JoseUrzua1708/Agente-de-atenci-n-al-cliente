"""Rutas API para el panel del cliente MAISON."""
from flask import Blueprint
from flask import Blueprint, render_template
from app.controllers.controllers_cliente.cliente_controller import (
    listar_habitaciones,
    obtener_mis_reservaciones,
    obtener_perfil,
    crear_reservacion
)

cliente_bp = Blueprint("cliente", __name__, url_prefix="/cliente")

@cliente_bp.get("/panel")
def panel_cliente():
    return render_template("cliente/panel_cliente.html")

@cliente_bp.get("/api/habitaciones")
def api_habitaciones():
    return listar_habitaciones()


@cliente_bp.get("/api/reservaciones")
def api_mis_reservaciones():
    return obtener_mis_reservaciones()


@cliente_bp.post("/api/reservaciones")
def api_crear_reservacion():
    return crear_reservacion()


@cliente_bp.get("/api/perfil")
def api_perfil():
    return obtener_perfil()