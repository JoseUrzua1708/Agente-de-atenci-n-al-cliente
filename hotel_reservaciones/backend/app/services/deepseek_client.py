from openai import OpenAI
from flask import current_app

def get_client():
    return OpenAI(
        api_key=current_app.config["sk-621550400b98423c9452095734aa66e3"],
        base_url=current_app.config["https://api.deepseek.com"],
    )