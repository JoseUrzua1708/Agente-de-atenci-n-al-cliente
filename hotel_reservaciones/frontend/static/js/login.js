"use strict";
let LOGIN_URL = "";
document.addEventListener("DOMContentLoaded", initializeLogin);

function initializeLogin() {
    
const loginForm = document.getElementById("loginForm");

if (!loginForm) {
    console.error("No se encontró el formulario #loginForm.");
    return;
}

LOGIN_URL = loginForm.dataset.loginUrl;

if (!LOGIN_URL) {
    console.error("No se configuró la URL del login.");
    return;
}

loginForm.addEventListener("submit", handleLoginSubmit);

}

async function handleLoginSubmit(event) {
    event.preventDefault();

    clearLoginMessage();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const submitButton = document.getElementById("submitButton");

    if (!username || !password) {
        showLoginMessage(
            "Ingresa tu correo electrónico y contraseña.",
            "error"
        );
        return;
    }

    setLoginLoading(submitButton, true);

    try {
        const response = await fetch(LOGIN_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify({
                username: username,
                password: password
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            showLoginMessage(
                result.message || "No se pudo iniciar sesión.",
                "error"
            );
            return;
        }

        if (result.redirect) {
            window.location.assign(result.redirect);
            return;
        }

        showLoginMessage(
            "El servidor no indicó a qué página redirigir.",
            "error"
        );

    } catch (error) {
        console.error("Error durante el inicio de sesión:", error);

        showLoginMessage(
            "No se pudo conectar con el servidor.",
            "error"
        );

    } finally {
        setLoginLoading(submitButton, false);
    }
}

function showLoginMessage(message, type) {
    const messageBox = document.getElementById("formMessage");

    if (!messageBox) {
        alert(message);
        return;
    }

    messageBox.textContent = message;
    messageBox.className = `message ${type}`;
    messageBox.hidden = false;
}

function clearLoginMessage() {
    const messageBox = document.getElementById("formMessage");

    if (!messageBox) return;

    messageBox.textContent = "";
    messageBox.className = "message";
    messageBox.hidden = true;
}


function setLoginLoading(button, isLoading) {
    if (!button) return;

    button.disabled = isLoading;
    button.classList.toggle("is-loading", isLoading);

    const buttonText = button.querySelector(".button-text");

    if (buttonText) {
        buttonText.textContent = isLoading
            ? "Iniciando sesión..."
            : "Ingresar al sistema";
    }
}
