# Usamos una imagen oficial y ligera de Python 3.11
FROM python:3.11-slim

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Instalar dependencias del sistema necesarias para compilar paquetes si es requerido
RUN apt-get update && apt-get install -y \
    gcc \
    default-libmysqlclient-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Copiar los requerimientos desde el contexto de la carpeta backend
COPY requirements.txt .

# Instalar las dependencias de Python
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copiar todo el código fuente del backend al contenedor
COPY . .

# Exponer el puerto 4005 de la aplicación Flask
EXPOSE 4005

# Comando para ejecutar la aplicación a través de run.py
CMD ["python", "run.py"]