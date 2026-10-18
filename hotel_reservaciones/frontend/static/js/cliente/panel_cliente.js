/* MAISON - Panel del cliente
 */
(() => {
  "use strict";

  const API = {
    habitaciones: "/cliente/api/habitaciones",
    reservaciones: "/cliente/api/reservaciones",
    perfil: "/cliente/api/perfil"
  };

  const $ = (selector) => document.querySelector(selector);
  const money = (value) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(value || 0));
  const dateText = (value) => {
    if (!value) return "Por definir";
    const d = new Date(`${value}T12:00:00`);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  };
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  let habitaciones = [];
  let reservaciones = [];
  let habitacionSeleccionada = null;
  let toastTimer;

  function toast(message) {
    const node = $("#toast");
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove("show"), 3200);
  }

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: { "Accept": "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) },
      ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.mensaje || `Error ${response.status}`);
    return data;
  }

  function showSection(id) {
    document.querySelectorAll(".page-section").forEach(section => section.classList.toggle("hidden", section.id !== id));
    document.querySelectorAll(".nav-link").forEach(link => link.classList.toggle("active", link.dataset.section === id));
    $("#sidebar").classList.remove("open");
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (id === "habitaciones" && !habitaciones.length) cargarHabitaciones();
    if (id === "reservaciones") cargarReservaciones();
    if (id === "perfil") cargarPerfil();
  }

  function renderHabitaciones(items) {
    const container = $("#listaHabitaciones");
    $("#contadorHabitaciones").textContent = `${items.length} resultado(s)`;
    if (!items.length) {
      container.innerHTML = '<div class="empty-state"><span class="empty-icon">▣</span><strong>No encontramos habitaciones</strong><p>Prueba con otras fechas o revisa más tarde.</p></div>';
      return;
    }
    container.innerHTML = items.map(h => {
      const id = Number(h.id);
      const nombre = h.tipo || h.nombre_tipo || h.tipo_habitacion || "Habitación";
      const precio = Number(h.precio ?? h.precio_base ?? 0);
      const capacidad = Number(h.capacidad_adultos || 1) + Number(h.capacidad_ninos || 0);
      return `<article class="room-card">
        <div class="room-image" aria-hidden="true">⌂</div>
        <div class="room-body"><h3>${escapeHTML(nombre)}</h3>
        <p>${escapeHTML(h.descripcion || "Un espacio cómodo para disfrutar tu estancia.")}</p>
        <div class="room-meta">Habitación ${escapeHTML(h.numero || "—")} · Piso ${escapeHTML(h.piso ?? "—")} · Hasta ${capacidad} huésped(es)</div>
        <p>${escapeHTML(h.amenidades || "Consulta las amenidades en recepción.")}</p>
        <div class="room-price">${money(precio)} <small>/ noche</small></div>
        <button class="button button-dark js-reservar" data-id="${id}" data-precio="${precio}" data-nombre="${escapeHTML(nombre)}" data-numero="${escapeHTML(h.numero || "")}">Elegir habitación</button></div></article>`;
    }).join("");
  }

  async function cargarHabitaciones() {
    const container = $("#listaHabitaciones");
    container.innerHTML = '<div class="empty-state"><p>Consultando disponibilidad…</p></div>';
    try {
      const params = new URLSearchParams();
      if ($("#fechaEntrada").value) params.set("entrada", $("#fechaEntrada").value);
      if ($("#fechaSalida").value) params.set("salida", $("#fechaSalida").value);
      if ($("#huespedes").value) params.set("huespedes", $("#huespedes").value);
      const data = await api(`${API.habitaciones}?${params}`);
      habitaciones = Array.isArray(data) ? data : (data.habitaciones || []);
      renderHabitaciones(habitaciones);
      $("#totalHabitaciones").textContent = habitaciones.length;
    } catch (error) {
      container.innerHTML = `<div class="empty-state"><strong>No se pudieron cargar las habitaciones</strong><p>${escapeHTML(error.message)}. Revisa que la ruta de Python esté conectada.</p></div>`;
      $("#totalHabitaciones").textContent = "—";
    }
  }

  function renderReservaciones(items) {
    const container = $("#listaReservaciones");
    if (!items.length) {
      container.innerHTML = '<div class="empty-state"><span class="empty-icon">▦</span><strong>Todavía no tienes reservaciones</strong><p>Cuando hagas una reservación, aparecerá aquí.</p><a class="text-link" href="#habitaciones">Explorar habitaciones →</a></div>';
      return;
    }
    container.innerHTML = items.map(r => {
      const estado = String(r.estado || "PENDIENTE").toUpperCase();
      return `<article class="reservation-card"><div><h3>${escapeHTML(r.tipo_habitacion || r.tipo || "Estancia MAISON")}</h3><p>Código: ${escapeHTML(r.codigo_reservacion || "—")}<br>Habitación: ${escapeHTML(r.habitacion || r.numero_habitacion || "—")}</p></div>
      <div><p>Entrada: ${dateText(r.fecha_entrada)}<br>Salida: ${dateText(r.fecha_salida)}</p><p><span class="status ${estado.toLowerCase()}">${escapeHTML(estado.replaceAll("_", " "))}</span></p></div>
      <div class="reservation-total">${money(r.total)}<p>Total de estancia</p></div></article>`;
    }).join("");
  }

  async function cargarReservaciones() {
    $("#listaReservaciones").innerHTML = '<div class="empty-state"><p>Cargando reservaciones…</p></div>';
    try {
      const data = await api(API.reservaciones);
      reservaciones = Array.isArray(data) ? data : (data.reservaciones || []);
      renderReservaciones(reservaciones);
      const activas = reservaciones.filter(r => ["PENDIENTE", "CONFIRMADA", "CHECK_IN"].includes(String(r.estado).toUpperCase()));
      $("#totalReservaciones").textContent = activas.length;
      const proxima = activas.filter(r => r.fecha_entrada).sort((a,b) => a.fecha_entrada.localeCompare(b.fecha_entrada))[0];
      $("#proximaLlegada").textContent = proxima ? dateText(proxima.fecha_entrada) : "Sin viajes";
      if (proxima) {
        $("#proximaReserva").innerHTML = `<div class="reservation-card"><div><h3>${escapeHTML(proxima.tipo_habitacion || "Tu estancia MAISON")}</h3><p>Código: ${escapeHTML(proxima.codigo_reservacion || "—")}</p></div><div><p>Entrada: ${dateText(proxima.fecha_entrada)}<br>Salida: ${dateText(proxima.fecha_salida)}</p></div><div class="reservation-total">${money(proxima.total)}<p>Total de estancia</p></div></div>`;
      }
    } catch (error) {
      $("#listaReservaciones").innerHTML = `<div class="empty-state"><strong>No se pudieron cargar tus reservaciones</strong><p>${escapeHTML(error.message)}. Revisa la ruta y tu sesión de cliente.</p></div>`;
    }
  }

  async function cargarPerfil() {
    try {
      const p = await api(API.perfil);
      const nombre = [p.nombre, p.apellidos].filter(Boolean).join(" ") || "Mi cuenta";
      const iniciales = nombre.split(/\s+/).slice(0,2).map(x => x[0]).join("").toUpperCase();
      $("#nombreUsuario").textContent = nombre;
      $("#perfilNombre").textContent = nombre;
      $("#perfilEmail").textContent = p.email || "Correo no disponible";
      $("#avatarIniciales").textContent = iniciales;
      $("#perfilIniciales").textContent = iniciales;
    } catch (_) {
      // El backend puede insertar los datos de sesión directamente en la plantilla.
    }
  }

  function abrirReserva(habitacion) {
    habitacionSeleccionada = habitacion;
    $("#resumenHabitacion").textContent = `${habitacion.nombre} · Habitación ${habitacion.numero || "—"} · ${money(habitacion.precio)} por noche`;
    $("#reservaEntrada").value = $("#fechaEntrada").value;
    $("#reservaSalida").value = $("#fechaSalida").value;
    $("#reservaHuespedes").value = $("#huespedes").value;
    calcularTotal();
    $("#dialogReserva").showModal();
  }

  function calcularTotal() {
    if (!habitacionSeleccionada) return;
    const entrada = new Date(`${$("#reservaEntrada").value}T12:00:00`);
    const salida = new Date(`${$("#reservaSalida").value}T12:00:00`);
    const noches = Math.round((salida - entrada) / 86400000);
    $("#totalEstimado").textContent = noches > 0 ? money(noches * habitacionSeleccionada.precio) : "Selecciona fechas";
  }

  async function solicitarReserva(event) {
    event.preventDefault();
    if (!habitacionSeleccionada) return;
    const entrada = $("#reservaEntrada").value;
    const salida = $("#reservaSalida").value;
    if (!entrada || !salida || salida <= entrada) return toast("La salida debe ser posterior a la entrada.");
    const body = {
      habitacion_id: habitacionSeleccionada.id,
      fecha_entrada: entrada,
      fecha_salida: salida,
      numero_huespedes: Number($("#reservaHuespedes").value),
      adultos: Number($("#reservaHuespedes").value),
      ninos: 0
    };
    try {
      const result = await api(API.reservaciones, { method: "POST", body: JSON.stringify(body) });
      $("#dialogReserva").close();
      toast(result.mensaje || "Tu solicitud de reservación fue registrada.");
      await cargarReservaciones();
      showSection("reservaciones");
    } catch (error) {
      toast(error.message || "No se pudo solicitar la reservación.");
    }
  }

  document.querySelectorAll(".nav-link").forEach(link => link.addEventListener("click", event => {
    event.preventDefault();
    showSection(link.dataset.section);
    history.replaceState(null, "", `#${link.dataset.section}`);
  }));
  $("#mobileMenu").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  $("#formBusqueda").addEventListener("submit", event => {
    event.preventDefault();
    if ($("#fechaEntrada").value && $("#fechaSalida").value <= $("#fechaEntrada").value) return toast("La salida debe ser posterior a la entrada.");
    cargarHabitaciones();
  });
  $("#listaHabitaciones").addEventListener("click", event => {
    const button = event.target.closest(".js-reservar");
    if (!button) return;
    abrirReserva({ id: Number(button.dataset.id), precio: Number(button.dataset.precio), nombre: button.dataset.nombre, numero: button.dataset.numero });
  });
  $("#cerrarDialogo").addEventListener("click", () => $("#dialogReserva").close());
  $("#reservaEntrada").addEventListener("change", calcularTotal);
  $("#reservaSalida").addEventListener("change", calcularTotal);
  $("#formReserva").addEventListener("submit", solicitarReserva);

  cargarHabitaciones();
  cargarReservaciones();
  cargarPerfil();
})();
