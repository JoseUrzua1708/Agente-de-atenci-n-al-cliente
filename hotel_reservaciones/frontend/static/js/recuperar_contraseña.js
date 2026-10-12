"use strict";

let RECOVER_URL = "";
let lastEmail = "";
let messageTimeout = null;

document.addEventListener("DOMContentLoaded", initializeRecover);

function initializeRecover() {
    const recoverForm = document.getElementById("recoverForm");

    if (!recoverForm) {
        console.error("No se encontró el formulario de recuperación.");
        return;
    }

    RECOVER_URL = recoverForm.dataset.recoverUrl;

    if (!RECOVER_URL) {
        showRecoverMessage("No se configuró la dirección del servidor.", "error");
        return;
    }

    recoverForm.addEventListener("submit", handleRecoverSubmit);

    // Reenviar el correo desde el paso 2.
    const resendButton = document.getElementById("resendButton");

    if (resendButton) {
        resendButton.addEventListener("click", handleResend);
    }

    // Volver al inicio de sesión.
    const backToLogin = document.getElementById("backToLogin");

    if (backToLogin) {
        backToLogin.addEventListener("click", () => {
            window.location.assign(backToLogin.dataset.loginPage || "/");
        });
    }

    const year = document.getElementById("year");

    if (year) {
        year.textContent = new Date().getFullYear();
    }
}

async function handleRecoverSubmit(event) {
    event.preventDefault();
    clearRecoverMessage();
    clearEmailError();

    const email = document.getElementById("email").value.trim();
    const submitButton = document.getElementById("submitButton");

    if (!email) {
        showEmailError("Ingresa tu correo electrónico.");
        return;
    }

    if (!isValidEmail(email)) {
        showEmailError("Escribe un correo electrónico válido.");
        return;
    }

    if (submitButton.disabled) return;

    setRecoverLoading(submitButton, true, "Enviando instrucciones...", "Enviar instrucciones");

    const sent = await requestRecovery(email);

    setRecoverLoading(submitButton, false, "Enviando instrucciones...", "Enviar instrucciones");

    if (sent) {
        lastEmail = email;
        showSentStep(email);
    }
}

async function handleResend() {
    const resendButton = document.getElementById("resendButton");

    if (!lastEmail || resendButton.disabled) return;

    clearRecoverMessage();
    setRecoverLoading(resendButton, true, "Reenviando...", "Reenviar correo");

    const sent = await requestRecovery(lastEmail);

    setRecoverLoading(resendButton, false, "Reenviando...", "Reenviar correo");

    if (sent) {
        showRecoverMessage("Te enviamos las instrucciones de nuevo.", "success");
    }
}

async function requestRecovery(email) {
    try {
        const response = await fetch(RECOVER_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            credentials: "same-origin",
            body: JSON.stringify({ email })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            showRecoverMessage(
                result.message || "No se pudo enviar las instrucciones.",
                "error"
            );
            return false;
        }

        return true;

    } catch (error) {
        console.error("Error al recuperar contraseña:", error);

        showRecoverMessage(
            "No se pudo conectar con el servidor. Inténtalo nuevamente.",
            "error"
        );
        return false;
    }
}

function showSentStep(email) {
    document.getElementById("recoverForm").hidden = true;
    document.getElementById("sentStep").hidden = false;
    document.getElementById("sentEmail").textContent = email;
    document.getElementById("stepIndicator2").classList.add("active");
}

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function showEmailError(text) {
    const emailError = document.getElementById("emailError");
    const wrapper = document.getElementById("email").closest(".input-wrapper");

    if (emailError) emailError.textContent = text;
    if (wrapper) wrapper.classList.add("has-error");
}

function clearEmailError() {
    const emailError = document.getElementById("emailError");
    const wrapper = document.getElementById("email").closest(".input-wrapper");

    if (emailError) emailError.textContent = "";
    if (wrapper) wrapper.classList.remove("has-error");
}

function showRecoverMessage(message, type = "error") {
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

function clearRecoverMessage() {
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

function setRecoverLoading(button, isLoading, loadingText, idleText) {
    if (!button) return;

    button.disabled = isLoading;
    button.classList.toggle("is-loading", isLoading);

    const buttonText = button.querySelector(".button-text");

    if (buttonText) {
        buttonText.textContent = isLoading ? loadingText : idleText;
    }
}