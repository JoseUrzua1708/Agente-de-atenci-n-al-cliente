
"use strict";

let LOGIN_URL = "";
let messageTimeout = null;

document.addEventListener("DOMContentLoaded", initializeLogin);

function initializeLogin() {
    const loginForm = document.getElementById("loginForm");

    if (!loginForm) {
        console.error("No se encontró el formulario de inicio de sesión.");
        return;
    }

    LOGIN_URL = loginForm.dataset.loginUrl;

    if (!LOGIN_URL) {
        showLoginMessage("No se configuró la dirección del servidor.", "error");
        return;
    }

    loginForm.addEventListener("submit", handleLoginSubmit);

    // Mostrar u ocultar contraseña.
    document.querySelectorAll("[data-toggle-password]").forEach((button) => {
        button.addEventListener("click", () => {
            const password = document.getElementById("password");
            const visible = password.type === "password";

            password.type = visible ? "text" : "password";
            button.setAttribute("aria-pressed", String(visible));
            button.setAttribute(
                "aria-label",
                visible ? "Ocultar contraseña" : "Mostrar contraseña"
            );
        });
    });

    // Crear cuenta.
    const switchMode = document.getElementById("switchMode");

    if (switchMode) {
        switchMode.addEventListener("click", () => {
            window.location.assign("/crear-cuenta");
        });
    }

    // Recuperar contraseña.
    const forgotPassword = document.getElementById("forgotPassword");

    if (forgotPassword) {
        forgotPassword.addEventListener("click", (event) => {
            event.preventDefault();
            window.location.assign("/recuperar-contrasena");
        });
    }

    // Recordar únicamente el correo, nunca la contraseña.
    const username = document.getElementById("username");
    const remember = document.getElementById("remember");

    try {
        const savedEmail = localStorage.getItem("maison_remembered_email");

        if (savedEmail) {
            username.value = savedEmail;
            remember.checked = true;
        }
    } catch (error) {
        console.warn("No fue posible recuperar el correo guardado.");
    }

    const year = document.getElementById("year");

    if (year) {
        year.textContent = new Date().getFullYear();
    }
}

async function handleLoginSubmit(event) {
    event.preventDefault();
    clearLoginMessage();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const remember = document.getElementById("remember");
    const submitButton = document.getElementById("submitButton");

    if (!username || !password) {
        showLoginMessage(
            "Ingresa tu correo electrónico y contraseña.",
            "error"
        );
        return;
    }

    if (submitButton.disabled) return;

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
                username,
                password
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

        if (remember.checked) {
            try {
                localStorage.setItem("maison_remembered_email", username);
            } catch (error) {
                console.warn("No fue posible guardar el correo.");
            }
        } else {
            try {
                localStorage.removeItem("maison_remembered_email");
            } catch (error) {
                console.warn("No fue posible eliminar el correo guardado.");
            }
        }

        if (!result.redirect) {
            showLoginMessage(
                "El servidor no indicó la página de destino.",
                "error"
            );
            return;
        }

        window.location.assign(result.redirect);

    } catch (error) {
        console.error("Error de inicio de sesión:", error);

        showLoginMessage(
            "No se pudo conectar con el servidor. Inténtalo nuevamente.",
            "error"
        );
    } finally {
        setLoginLoading(submitButton, false);
    }
}

function showLoginMessage(message, type = "error") {
    const messageBox = document.getElementById("formMessage");

    if (!messageBox) return;

    if (messageTimeout) {
        clearTimeout(messageTimeout);
    }

    const icons = {
        error: `
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9"
                    stroke="currentColor" stroke-width="1.8"/>
                <path d="M12 8v5m0 3h.01"
                    stroke="currentColor" stroke-width="1.8"
                    stroke-linecap="round"/>
            </svg>`,
        success: `
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9"
                    stroke="currentColor" stroke-width="1.8"/>
                <path d="m8 12 2.5 2.5L16 9"
                    stroke="currentColor" stroke-width="1.8"
                    stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`,
        warning: `
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3 22 20H2L12 3Z"
                    stroke="currentColor" stroke-width="1.8"
                    stroke-linejoin="round"/>
                <path d="M12 9v4m0 3h.01"
                    stroke="currentColor" stroke-width="1.8"
                    stroke-linecap="round"/>
            </svg>`
    };

    const iconContainer = document.createElement("span");
    iconContainer.className = "message-icon";
    iconContainer.innerHTML = icons[type] || icons.error;

    const textContainer = document.createElement("span");
    textContainer.className = "message-text";
    textContainer.textContent = message;

    messageBox.replaceChildren(iconContainer, textContainer);
    messageBox.className = `message ${type}`;
    messageBox.hidden = false;

    messageTimeout = setTimeout(() => {
        messageBox.hidden = true;
        messageBox.replaceChildren();
        messageBox.className = "message";
        messageTimeout = null;
    }, 3000);
}

function clearLoginMessage() {
    const messageBox = document.getElementById("formMessage");

    if (messageTimeout) {
        clearTimeout(messageTimeout);
        messageTimeout = null;
    }

    if (messageBox) {
        messageBox.hidden = true;
        messageBox.replaceChildren();
        messageBox.className = "message";
    }
}

function setLoginLoading(button, isLoading) {
    if (!button) return;

    button.disabled = isLoading;
    button.classList.toggle("is-loading", isLoading);

    const buttonText = button.querySelector(".button-text");

    if (buttonText) {
        buttonText.textContent = isLoading
            ? "Verificando credenciales..."
            : "Ingresar al sistema";
    }
}
