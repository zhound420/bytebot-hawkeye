# Use Alpine Linux with a fixed version for better reproducibility
FROM alpine:3.19

# ---------------------------
# Copy the QEMU VM Disk Image
# ---------------------------
# Download the QEMU image and set proper permissions
RUN wget https://bytebot-desktop-images.s3.us-east-2.amazonaws.com/bytebot-lubuntu-22.04.5.qcow2 -P /opt/ && \
    chmod 777 /opt/bytebot-lubuntu-22.04.5.qcow2 

# Install required packages:
# - nodejs and npm for the hypervisor app
# - qemu-system-x86_64 for running the Ubuntu VM with VNC
# - supervisor to run multiple processes
# - bash for convenience
RUN apk update && apk add --no-cache \
    nodejs \
    npm \
    qemu-system-x86_64 \
    supervisor \
    bash \
    git \
    python3 \
    py3-pip \
    py3-numpy \
    py3-setuptools \
    netcat-openbsd && \
    rm -rf /var/cache/apk/*

# Clone the noVNC repository 
RUN git clone https://github.com/novnc/noVNC.git /opt/noVNC

# Clone and install websockify
RUN git clone https://github.com/novnc/websockify.git /opt/websockify && \
    cd /opt/websockify && \
    pip3 install --break-system-packages .

USER root
# ---------------------------
# Set Up Node.js Hypervisor App
# ---------------------------
# Copy package files first to leverage Docker cache
COPY ./hypervisor/package*.json /hypervisor/
WORKDIR /hypervisor
RUN npm install

# Copy the rest of the application code and build
COPY ./hypervisor/ /hypervisor/
RUN npm run build

# ---------------------------
# Add Supervisor Configuration
# ---------------------------
# Copy our Supervisor configuration file that starts the Node.js hypervisor
# and QEMU for the Ubuntu VM.
COPY ./docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# ---------------------------
# Expose Ports
# ---------------------------
# - Port 3000: Node.js hypervisor (your TypeScript app)
# - Port 5900: VNC display for the Ubuntu VM
# - Port 6080: noVNC client
# - Port 6081: noVNC HTTP proxy
EXPOSE 3000 5900 6080 6081


# Set the default command to run Supervisor in non‑daemon mode.
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf", "-n"]
