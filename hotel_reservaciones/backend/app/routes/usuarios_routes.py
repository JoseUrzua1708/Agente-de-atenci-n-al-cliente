from flask import Blueprint, session, jsonify

from app.config.database import db
from app.controllers.usuarios_controller import UsuariosController


class UsuariosRoutes:

    def __init__(self):
        self.blueprint = Blueprint(
            "usuarios",
            __name__,
            url_prefix="/admin/usuarios"
        )

        self._registrar_rutas()

    def _registrar_rutas(self):

        @self.blueprint.before_request
        def verificar_administrador():
            # Comprobar que exista una sesión.
            try:
                usuario_id = int(session.get("user_id"))
                rol_sesion = int(session.get("role_id"))
            except (TypeError, ValueError):
                session.clear()
                return jsonify({
                    "success": False,
                    "message": "Debes iniciar sesión para continuar."
                }), 401

            if rol_sesion != 1:
                return jsonify({
                    "success": False,
                    "message": "No tienes permisos para administrar usuarios."
                }), 403

            conexion = None
            cursor = None

            try:
                conexion = db.get_connection()
                cursor = conexion.cursor(dictionary=True)

                cursor.execute("""
                    SELECT u.id, u.estado, r.id AS rol_id
                    FROM usuarios u
                    INNER JOIN roles r ON r.id = u.rol_id
                    WHERE u.id = %s
                    LIMIT 1
                """, (usuario_id,))

                usuario = cursor.fetchone()

                if (
                    not usuario
                    or usuario["rol_id"] != 1
                    or usuario["estado"] != "ACTIVO"
                ):
                    session.clear()

                    return jsonify({
                        "success": False,
                        "message": "La cuenta no está autorizada o está inactiva."
                    }), 403

                return None

            except Exception:
                import logging
                logging.getLogger("SecurityAuditor").exception(
                    "Error al verificar permisos del módulo de usuarios."
                )

                return jsonify({
                    "success": False,
                    "message": "No fue posible verificar los permisos."
                }), 500

            finally:
                if cursor:
                    cursor.close()
                if conexion:
                    conexion.close()

        # Consultar administradores y recepcionistas.
        self.blueprint.add_url_rule(
            "/api",
            endpoint="listar_usuarios",
            view_func=UsuariosController.listar_usuarios,
            methods=["GET"]
        )

        # Crear recepcionista.
        self.blueprint.add_url_rule(
            "/recepcionistas",
            endpoint="crear_recepcionista",
            view_func=lambda: UsuariosController.crear_usuario(2),
            methods=["POST"]
        )

        # Crear administrador.
        self.blueprint.add_url_rule(
            "/administradores",
            endpoint="crear_administrador",
            view_func=lambda: UsuariosController.crear_usuario(1),
            methods=["POST"]
        )

        # Editar únicamente recepcionistas.
        self.blueprint.add_url_rule(
            "/<int:usuario_id>",
            endpoint="editar_recepcionista",
            view_func=UsuariosController.editar_recepcionista,
            methods=["PUT"]
        )

        # Inactivar o reactivar administradores y recepcionistas.
        self.blueprint.add_url_rule(
            "/<int:usuario_id>/estado",
            endpoint="cambiar_estado",
            view_func=UsuariosController.cambiar_estado,
            methods=["PATCH"]
        )

    def get_blueprint(self):
        return self.blueprint
