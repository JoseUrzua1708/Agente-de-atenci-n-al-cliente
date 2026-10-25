from flask import Blueprint
from app.controllers.controllers_chatbot.chatbot_controller import enviar_mensaje

chatbot_bp = Blueprint('chatbot', __name__)

@chatbot_bp.route('/api/chat', methods=['POST'])
def chat():
    return enviar_mensaje()