document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("registerForm");
    const message = document.getElementById("formMessage");
    const continueButton = document.getElementById("continueButton");
    const backButton = document.getElementById("backButton");
    const panels = [...document.querySelectorAll("[data-step]")];
    const indicators = [...document.querySelectorAll("[data-step-indicator]")];
    const year = document.getElementById("year");
    let currentStep = 1, messageTimer;
    if (year) year.textContent = new Date().getFullYear();

    function iconFor(type) {
        const paths = {
            error: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><path d="M12 7v6m0 4h.01" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
            success: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><path d="m7.5 12 3 3 6-6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
            info: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><path d="M12 11v5m0-8h.01" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>'
        };
        return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${paths[type] || paths.info}</svg>`;
    }
    function showMessage(text, type="info") {
        if (!message) return;
        clearTimeout(messageTimer);
        message.className = `form-message ${type}`;
        message.innerHTML = `${iconFor(type)}<span></span>`;
        message.querySelector("span").textContent = text;
        message.hidden = false;
        messageTimer = setTimeout(() => { message.hidden = true; message.textContent = ""; }, 3000);
    }
    function setStep(step) {
        currentStep = step;
        panels.forEach(panel => {
            const active = Number(panel.dataset.step) === step;
            panel.hidden = !active;
            panel.classList.toggle("active", active);
        });
        indicators.forEach(indicator => {
            const n = Number(indicator.dataset.stepIndicator);
            indicator.classList.toggle("active", n === step);
            indicator.classList.toggle("completed", n < step);
            indicator.querySelector(".step-number").textContent = String(n);
        });
        if (message) { message.hidden = true; message.textContent = ""; }
        window.scrollTo({top:0, behavior:matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
    }
    function validateStep() {
        const panel = panels.find(item => Number(item.dataset.step) === currentStep);
        for (const field of panel.querySelectorAll("input,select")) {
            if (!field.checkValidity()) {
                field.reportValidity(); field.focus({preventScroll:false});
                return false;
            }
        }
        if (currentStep === 1) {
            const password = document.getElementById("password");
            const confirmation = document.getElementById("confirmPassword");
            if (password.value.length < 8) { showMessage("La contraseña debe tener al menos 8 caracteres.", "error"); password.focus(); return false; }
            if (password.value !== confirmation.value) { showMessage("Las contraseñas no coinciden.", "error"); confirmation.focus(); return false; }
        }
        return true;
    }
    continueButton.addEventListener("click", () => { if (validateStep()) setStep(2); });
    backButton.addEventListener("click", () => setStep(1));
    document.querySelectorAll("[data-toggle-password]").forEach(button => button.addEventListener("click", () => {
        const input = document.getElementById(button.dataset.togglePassword);
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        button.setAttribute("aria-pressed", String(show));
        button.setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
    }));
    // Selectores personalizados sin buscador, con menú animado y posición adaptativa.
    const chevronIcon = '<svg class="smart-select-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    let openedSmartSelect = null;
    function closeSmartSelect(instance) {
        if (!instance) return;
        instance.menu.classList.remove("open", "opens-up");
        instance.wrapper.classList.remove("open");
        instance.trigger.setAttribute("aria-expanded", "false");
        if (openedSmartSelect === instance) openedSmartSelect = null;
    }
    function positionSmartSelect(instance) {
        if (!instance || !instance.menu.classList.contains("open")) return;
        const rect = instance.trigger.getBoundingClientRect();
        const margin = 10;
        const below = window.innerHeight - rect.bottom - margin;
        const above = rect.top - margin;
        const openUp = below < 235 && above > below;
        const available = Math.max(110, Math.min(310, (openUp ? above : below) - 8));
        const width = Math.min(Math.max(rect.width, 190), window.innerWidth - 20);
        const left = Math.max(10, Math.min(rect.left, window.innerWidth - width - 10));
        instance.menu.style.maxHeight = `${available}px`;
        instance.menu.style.width = `${width}px`;
        instance.menu.style.left = `${left}px`;
        if (openUp) {
            instance.menu.classList.add("opens-up");
            instance.menu.style.top = "auto";
            instance.menu.style.bottom = `${Math.max(10, window.innerHeight - rect.top + 5)}px`;
        } else {
            instance.menu.classList.remove("opens-up");
            instance.menu.style.bottom = "auto";
            instance.menu.style.top = `${Math.min(window.innerHeight - available - 10, rect.bottom + 5)}px`;
        }
    }
    function initSmartSelect(select) {
        if (!select || select.dataset.smartReady) return;
        select.dataset.smartReady = "true";
        select.classList.add("native-select-hidden");
        const wrapper = document.createElement("div");
        wrapper.className = "smart-select";
        select.parentNode.insertBefore(wrapper, select);
        wrapper.appendChild(select);
        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "smart-select-trigger";
        trigger.setAttribute("aria-haspopup", "listbox");
        trigger.setAttribute("aria-expanded", "false");
        const value = document.createElement("span");
        value.className = "smart-select-value";
        const currentOption = () => select.options[select.selectedIndex];
        const updateValue = () => { value.textContent = currentOption()?.textContent.trim() || "Selecciona una opción"; };
        trigger.append(value);
        trigger.insertAdjacentHTML("beforeend", chevronIcon);
        wrapper.appendChild(trigger);
        const menu = document.createElement("div");
        menu.className = "smart-select-menu";
        menu.setAttribute("role", "listbox");
        const optionsBox = document.createElement("div");
        optionsBox.className = "smart-select-options";
        menu.appendChild(optionsBox);
        document.body.appendChild(menu);
        const optionButtons = [];
        [...select.options].forEach((option, index) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "smart-select-option";
            button.setAttribute("role", "option");
            button.textContent = option.textContent.trim();
            button.setAttribute("aria-selected", String(index === select.selectedIndex));
            button.addEventListener("click", () => {
                select.selectedIndex = index;
                select.dispatchEvent(new Event("change", { bubbles: true }));
                updateValue();
                optionButtons.forEach(item => item.setAttribute("aria-selected", String(item === button)));
                closeSmartSelect(instance);
                trigger.focus({ preventScroll: true });
            });
            optionsBox.appendChild(button);
            optionButtons.push(button);
        });
        const instance = { select, wrapper, trigger, menu, optionButtons, updateValue };
        trigger.addEventListener("click", () => {
            if (openedSmartSelect === instance) { closeSmartSelect(instance); return; }
            closeSmartSelect(openedSmartSelect);
            openedSmartSelect = instance;
            wrapper.classList.add("open");
            menu.classList.add("open");
            trigger.setAttribute("aria-expanded", "true");
            optionButtons.forEach(button => button.setAttribute("aria-selected", String(button.textContent === currentOption()?.textContent.trim())));
            positionSmartSelect(instance);
            requestAnimationFrame(() => positionSmartSelect(instance));
        });
        select.addEventListener("change", updateValue);
        updateValue();
    }
    ["nacionalidad", "codigoPais", "idioma"].forEach(id => initSmartSelect(document.getElementById(id)));
    document.addEventListener("pointerdown", event => {
        if (openedSmartSelect && !openedSmartSelect.menu.contains(event.target) && !openedSmartSelect.wrapper.contains(event.target)) closeSmartSelect(openedSmartSelect);
    });
    window.addEventListener("resize", () => positionSmartSelect(openedSmartSelect));
    window.addEventListener("scroll", () => positionSmartSelect(openedSmartSelect), true);

    form.addEventListener("submit", event => {
        event.preventDefault();
        if (currentStep !== 2) { if (validateStep()) setStep(2); return; }
        if (!validateStep()) return;
        const birthValue = document.getElementById("fechaNacimiento").value;
        if (birthValue && new Date(`${birthValue}T00:00:00`) > new Date()) {
            showMessage("La fecha de nacimiento no puede ser futura.", "error");
            document.getElementById("fechaNacimiento").focus(); return;
        }
        // No mostrar mensajes de éxito hasta que el registro real del servidor esté conectado.
    });
});
