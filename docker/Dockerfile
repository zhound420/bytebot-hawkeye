# -----------------------------------------------------------------------------
# ByteBot Dockerfile - Virtual Desktop Environment
# -----------------------------------------------------------------------------

# Base image
FROM --platform=linux/amd64 ubuntu:22.04

# -----------------------------------------------------------------------------
# 1. Environment setup
# -----------------------------------------------------------------------------
# Set non-interactive installation
ARG DEBIAN_FRONTEND=noninteractive
# Configure display for X11 applications
ENV DISPLAY=:0

# -----------------------------------------------------------------------------
# 2. System dependencies installation
# -----------------------------------------------------------------------------
RUN apt-get update && apt-get install -y \
    # X11 / VNC
    xvfb x11vnc xauth x11-xserver-utils \
    x11-apps sudo software-properties-common \
    # Desktop environment 
    xfce4 xfce4-goodies dbus \
    # Display manager with autologin capability
    lightdm \
    # Development tools
    python3 python3-pip curl wget git vim \
    # Utilities
    supervisor netcat-openbsd \
    # Applications
    xpdf gedit xpaint \
    # Libraries
    libxtst-dev \
    # Remove unneeded dependencies
    && apt-get remove -y light-locker xfce4-screensaver xfce4-power-manager || true \
    # Clean up to reduce image size
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /run/dbus && \
    # Generate a machine-id so dbus-daemon doesn’t complain
    dbus-uuidgen --ensure=/etc/machine-id

# -----------------------------------------------------------------------------
# 3. Additional software installation
# -----------------------------------------------------------------------------
# Install Google Chrome
RUN wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && \
    apt-get update && \
    apt-get install -y \
    # Install Additional Graphics Libraries
    mesa-utils \
    libgl1-mesa-dri \
    libgl1-mesa-glx \
    # Install Sandbox Capabilities
    libcap2-bin \
    # Install Fonts
    fontconfig \
    fonts-dejavu \
    fonts-liberation \
    fonts-freefont-ttf \
    ./google-chrome-stable_current_amd64.deb && \
    rm google-chrome-stable_current_amd64.deb && \
    # Set Chrome as default browser system-wide
    update-alternatives --install /usr/bin/x-www-browser x-www-browser /usr/bin/google-chrome-stable 200 && \
    update-alternatives --set x-www-browser /usr/bin/google-chrome-stable && \
    # Configure default MIME handlers for web content
    mkdir -p /etc/xdg/xfce4/helpers && \
    echo '[Desktop Entry]' > /etc/xdg/xfce4/helpers/google-chrome.desktop && \
    echo 'Version=1.0' >> /etc/xdg/xfce4/helpers/google-chrome.desktop && \
    echo 'Type=X-XFCE-Helper' >> /etc/xdg/xfce4/helpers/google-chrome.desktop && \
    echo 'Name=Google Chrome' >> /etc/xdg/xfce4/helpers/google-chrome.desktop && \
    echo 'X-XFCE-Binaries=google-chrome-stable;google-chrome;' >> /etc/xdg/xfce4/helpers/google-chrome.desktop && \
    echo 'X-XFCE-Category=WebBrowser' >> /etc/xdg/xfce4/helpers/google-chrome.desktop && \
    echo 'X-XFCE-Commands=%B;%B --incognito;' >> /etc/xdg/xfce4/helpers/google-chrome.desktop && \
    echo 'X-XFCE-CommandsWithParameter=%B %s;%B --incognito %s;' >> /etc/xdg/xfce4/helpers/google-chrome.desktop && \
    echo 'WebBrowser=google-chrome' > /etc/xdg/xfce4/helpers.rc && \
    apt-get clean && rm -rf /var/lib/apt/lists/* \
    && fc-cache -f -v \
    && setcap cap_net_raw,cap_net_admin=eip /usr/bin/chrome-sandbox \
    || true

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get update \
    && apt-get install -y nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Upgrade pip
RUN pip3 install --upgrade pip

# -----------------------------------------------------------------------------
# 4. VNC and remote access setup
# -----------------------------------------------------------------------------
# Install noVNC and websockify
RUN git clone https://github.com/novnc/noVNC.git /opt/noVNC \
    && git clone https://github.com/novnc/websockify.git /opt/websockify \
    && cd /opt/websockify \
    && pip3 install --break-system-packages .

# -----------------------------------------------------------------------------
# 5. Application setup (bytebotd)
# -----------------------------------------------------------------------------
# Copy package files first to leverage Docker cache
COPY ./bytebotd/package*.json /bytebotd/
WORKDIR /bytebotd
RUN npm install

# Copy the rest of the application code and build
COPY ./bytebotd/ /bytebotd/
RUN npm run build

# -----------------------------------------------------------------------------
# 6. System configuration
# -----------------------------------------------------------------------------
# Add Supervisor Configuration for service management
COPY ./docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Set restrictive permissions on supervisord configuration
RUN chmod 644 /etc/supervisor/conf.d/supervisord.conf && \
    chown root:root /etc/supervisor/conf.d/supervisord.conf

# Set restrictive permissions on bytebotd directory
RUN chown -R root:root /bytebotd && \
    chmod -R 755 /bytebotd

# -----------------------------------------------------------------------------
# 7. User setup and autologin configuration
# -----------------------------------------------------------------------------
# Create non-root user
RUN useradd -ms /bin/bash bytebot && echo "bytebot ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

RUN chmod 755 /var/run/dbus && \
    chown bytebot:bytebot /var/run/dbus

RUN mkdir -p /tmp/bytebot-screenshots && \
    chown -R bytebot:bytebot /tmp/bytebot-screenshots

# Configure autologin for the bytebot user
RUN mkdir -p /etc/lightdm/lightdm.conf.d && \
    echo '[Seat:*]' > /etc/lightdm/lightdm.conf.d/50-autologin.conf && \
    echo 'autologin-user=bytebot' >> /etc/lightdm/lightdm.conf.d/50-autologin.conf && \
    echo 'autologin-user-timeout=0' >> /etc/lightdm/lightdm.conf.d/50-autologin.conf && \
    echo 'autologin-session=xfce' >> /etc/lightdm/lightdm.conf.d/50-autologin.conf

# Make sure the lightdm configuration has proper permissions
RUN chmod 644 /etc/lightdm/lightdm.conf.d/50-autologin.conf && \
    chown root:root /etc/lightdm/lightdm.conf.d/50-autologin.conf

# Set custom desktop background
# Create backgrounds directory
RUN mkdir -p /usr/share/backgrounds/bytebot

# Copy background.jpg from the build context
COPY ./static/background.jpg /usr/share/backgrounds/bytebot/ 
RUN chmod 644 /usr/share/backgrounds/bytebot/background.jpg

# Add XFCE configuration files
COPY ./docker/xfce4/ /tmp/xfce4/
COPY ./docker/chrome.desktop /tmp/chrome.desktop

# Set up XFCE configuration
RUN mkdir -p /home/bytebot/.config/xfce4/ && \
    mkdir -p /home/bytebot/Desktop && \
    # Copy the XFCE configuration files
    cp -r /tmp/xfce4/* /home/bytebot/.config/xfce4/ && \
    # Create Chrome desktop shortcut
    cp /tmp/chrome.desktop /home/bytebot/Desktop/ && \
    chmod +x /home/bytebot/Desktop/chrome.desktop && \
    # Create .xsessionrc file for the user to ensure XFCE starts properly
    mkdir -p /home/bytebot/.config && \
    echo "exec startxfce4" > /home/bytebot/.xsessionrc && \
    # Ensure all settings are owned by the user
    chown -R bytebot:bytebot /home/bytebot/.config /home/bytebot/Desktop /home/bytebot/.xsessionrc

# Configure Chrome flags
RUN mkdir -p /home/bytebot/.config && \
    echo "--password-store=basic" > /home/bytebot/.config/chrome-flags.conf && \
    echo "--use-mock-keychain" >> /home/bytebot/.config/chrome-flags.conf && \
    echo "--disable-gpu" >> /home/bytebot/.config/chrome-flags.conf && \
    echo "--disable-software-rasterizer" >> /home/bytebot/.config/chrome-flags.conf && \
    chown -R bytebot:bytebot /home/bytebot/.config

# Replace default Web Browser shortcut with Google Chrome (using Chrome logo and name)
RUN mkdir -p /etc/skel/.config/xfce4/panel/launcher-* && \
    mkdir -p /usr/share/applications/ && \
    echo '[Desktop Entry]' > /usr/share/applications/chrome.desktop && \
    echo 'Version=1.0' >> /usr/share/applications/chrome.desktop && \
    echo 'Type=Application' >> /usr/share/applications/chrome.desktop && \
    echo 'Name=Google Chrome' >> /usr/share/applications/chrome.desktop && \
    echo 'Comment=Browse the web with Google Chrome' >> /usr/share/applications/chrome.desktop && \
    echo 'Exec=/usr/bin/google-chrome-stable %U' >> /usr/share/applications/chrome.desktop && \
    echo 'Icon=google-chrome' >> /usr/share/applications/chrome.desktop && \
    echo 'Path=' >> /usr/share/applications/chrome.desktop && \
    echo 'Terminal=false' >> /usr/share/applications/chrome.desktop && \
    echo 'StartupNotify=true' >> /usr/share/applications/chrome.desktop && \
    echo 'Categories=Network;WebBrowser;' >> /usr/share/applications/chrome.desktop && \
    chmod +x /usr/share/applications/chrome.desktop && \
    # Copy Chrome desktop file to panel configuration
    mkdir -p /home/bytebot/.config/xfce4/panel && \
    cp -f /usr/share/applications/chrome.desktop /home/bytebot/.config/xfce4/panel/ && \
    # Create a backup of the default XFCE panel configuration
    mkdir -p /etc/xdg/xfce4/panel/backup && \
    # Also add Chrome to desktop
    mkdir -p /home/bytebot/Desktop && \
    cp -f /usr/share/applications/chrome.desktop /home/bytebot/Desktop/ && \
    chown -R bytebot:bytebot /home/bytebot/.config/xfce4/panel /home/bytebot/Desktop

# Add a desktop shortcut for the Terminal
RUN echo '[Desktop Entry]' > /usr/share/applications/terminal.desktop && \
    echo 'Version=1.0' >> /usr/share/applications/terminal.desktop && \
    echo 'Type=Application' >> /usr/share/applications/terminal.desktop && \
    echo 'Name=Terminal Emulator' >> /usr/share/applications/terminal.desktop && \
    echo 'Comment=Open a terminal' >> /usr/share/applications/terminal.desktop && \
    echo 'Exec=exo-open --launch TerminalEmulator' >> /usr/share/applications/terminal.desktop && \
    echo 'Icon=org.xfce.terminalemulator' >> /usr/share/applications/terminal.desktop && \
    echo 'Path=' >> /usr/share/applications/terminal.desktop && \
    echo 'Terminal=false' >> /usr/share/applications/terminal.desktop && \
    echo 'StartupNotify=true' >> /usr/share/applications/terminal.desktop && \
    echo 'Categories=Utility;TerminalEmulator;' >> /usr/share/applications/terminal.desktop && \
    chmod +x /usr/share/applications/terminal.desktop && \
    mkdir -p /home/bytebot/Desktop && \
    cp -f /usr/share/applications/terminal.desktop /home/bytebot/Desktop/ && \
    chown -R bytebot:bytebot /home/bytebot/Desktop

USER bytebot
WORKDIR /home/bytebot

# -----------------------------------------------------------------------------
# 8. Port configuration and runtime
# -----------------------------------------------------------------------------
# - Port 3000: bytebotd
# - Port 5900: VNC display for the Ubuntu VM
# - Port 6080: noVNC client
# - Port 6081: noVNC HTTP proxy
EXPOSE 3000 5900 6080 6081

# Start supervisor to manage all services
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf", "-n"]