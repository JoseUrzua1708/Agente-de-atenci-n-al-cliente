from flask import Blueprint, render_template

register_bp = Blueprint('register', __name__)

@register_bp.route('/crear-cuenta', methods=["GET"])
def create_account_view():
    return render_template("crear_cuenta.html")