// Fecha del día (solo en el inicio) y año del pie de página
const fechaActual = document.getElementById("currentDate");
if (fechaActual) {
    fechaActual.textContent = new Date().toLocaleDateString("es-MX", {
        weekday: "long", day: "numeric", month: "long"
    });
}
document.getElementById("footerYear").textContent = new Date().getFullYear();

// Los avisos se ocultan solos
document.querySelectorAll(".alerta").forEach((alerta) => setTimeout(() => alerta.remove(), 4000));

// Menú lateral en móvil
const sidebar = document.getElementById("sidebar");
const backdrop = document.getElementById("sidebarBackdrop");
const menuButton = document.getElementById("mobileMenuButton");

function toggleMenu(abrir) {
    sidebar.classList.toggle("open", abrir);
    backdrop.classList.toggle("visible", abrir);
    menuButton.setAttribute("aria-expanded", String(abrir));
}

menuButton.addEventListener("click", () => toggleMenu(!sidebar.classList.contains("open")));
backdrop.addEventListener("click", () => toggleMenu(false));
