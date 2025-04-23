###############################################################################
# Stage 0 – build bytebotd + libnut
###############################################################################
ARG BUILDPLATFORM
FROM --platform=$BUILDPLATFORM node:20-bookworm-slim AS builder
WORKDIR /src

# ---- build prerequisites ----------------------------------------------------
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates build-essential cmake git \
        libx11-dev libxi-dev libxtst-dev libxinerama-dev libxrandr-dev && \
    rm -rf /var/lib/apt/lists/*

# ---- bytebotd ---------------------------------------------------------------
COPY packages/bytebotd ./bytebotd
RUN cd bytebotd && npm install && npm run build

# ---- libnut -----------------------------------------------------------------
RUN git clone https://github.com/ZachJW34/libnut-core.git && \
    cd libnut-core && \
    npm install && npm run build:release

###############################################################################
# Stage 1 – minimal runtime with GUI
###############################################################################
FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    DISPLAY=:0 \
    NODE_VERSION=20

# --------------------------------------------------------------------------- #
# 1. Core OS, X11 stack, GUI apps, Firefox, supervisor
# --------------------------------------------------------------------------- #
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        # X11 / GUI
        xvfb x11vnc xauth x11-utils openbox tint2 pcmanfm \
        xfce4-terminal firefox-esr \
        # Runtime helpers
        python3 python3-websockify python3-pyxdg git sudo curl ca-certificates \
        shared-mime-info desktop-file-utils supervisor && \
    rm -rf /usr/share/doc /usr/share/man /usr/share/locale && \
    rm -rf /var/lib/apt/lists/*

# --------------------------------------------------------------------------- #
# 2. Node 20 (via NodeSource)
# --------------------------------------------------------------------------- #
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - && \
    apt-get update && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# --------------------------------------------------------------------------- #
# 3. Firefox enterprise policy (skip onboarding, etc.)
# --------------------------------------------------------------------------- #
RUN install -m 0755 -d /etc/firefox/policies && \
    cat > /etc/firefox/policies/policies.json <<'EOF'
{
  "policies": {
    "FirefoxHome": {
      "Search": true, "TopSites": false, "SponsoredTopSites": false,
      "Highlights": false, "Pocket": false, "SponsoredPocket": false,
      "Snippets": false, "Locked": true
    },
    "PDFjs": { "Enabled": true, "EnablePermissions": true },
    "Notifications": { "BlockNewRequests": true, "Locked": true },
    "UserMessaging": {
      "ExtensionRecommendations": false, "FeatureRecommendations": false,
      "UrlbarInterventions": false, "SkipOnboarding": true,
      "MoreFromMozilla": false, "FirefoxLabs": false
    }
  }
}
EOF

# --------------------------------------------------------------------------- #
# 4. Global tint2 panel (single-line clock)
# --------------------------------------------------------------------------- #
RUN install -Dm0644 /dev/null /etc/xdg/tint2/tint2rc && \
    cat > /etc/xdg/tint2/tint2rc <<'EOF'
rounded = 0
border_width = 0
background_color = #212121 80   # 80% opacity
border_color = #000000 0
panel_items = TSC
panel_size = 100% 28
panel_position = bottom center
panel_padding = 0 2 4
panel_background_id = 1
time1_format = %a %b %d %l:%M%p
time1_font   = Sans 10
clock_font_color = #ffffff 100
clock_padding = 4 0
systray_monitor = 1
systray_padding = 2 2
taskbar_mode = single_desktop
taskbar_padding = 2 2 2
EOF

# --------------------------------------------------------------------------- #
# 5. noVNC (latest shallow clone) & wallpaper
# --------------------------------------------------------------------------- #
RUN git clone --depth 1 https://github.com/novnc/noVNC.git /opt/noVNC
RUN install -Dm0644 /dev/null /usr/share/backgrounds/bytebot/wall.jpg
COPY static/background.jpg /usr/share/backgrounds/bytebot/wall.jpg

# --------------------------------------------------------------------------- #
# 6. Non-root user + GUI session tweaks
# --------------------------------------------------------------------------- #
RUN useradd -m bytebot && echo "bytebot ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers
RUN mkdir -p /tmp/bytebot-screenshots && \
    chown -R bytebot:bytebot /tmp/bytebot-screenshots
WORKDIR /home/bytebot

# -- PCManFM behaviour (skip “Open With” prompt) -----------------------------
RUN install -Dm0644 /dev/null /home/bytebot/.config/libfm/libfm.conf && \
    cat > /home/bytebot/.config/libfm/libfm.conf <<'EOF'
[config]
quick_exec=1
EOF

# -- Openbox autostart & single workspace ------------------------------------
RUN install -Dm0755 /dev/null /etc/xdg/openbox/autostart && \
    cat > /etc/xdg/openbox/autostart <<'EOF'
#!/bin/sh
pcmanfm --desktop &
sleep 1
pcmanfm --set-wallpaper=/usr/share/backgrounds/bytebot/wall.jpg --wallpaper-mode=fit &
EOF
RUN sed -i 's#<number>4</number>#<number>1</number>#' /etc/xdg/openbox/rc.xml

# --------------------------------------------------------------------------- #
# 7. Desktop entries (Firefox, terminal, file manager)
# --------------------------------------------------------------------------- #
RUN install -dm0755 /usr/share/applications && \
    install -Dm0755 /dev/null /usr/share/applications/firefox.desktop && \
    install -Dm0755 /dev/null /usr/share/applications/terminal.desktop && \
    install -Dm0755 /dev/null /usr/share/applications/file-manager.desktop && \
    cat > /usr/share/applications/firefox.desktop <<'EOF'
[Desktop Entry]
Name=Firefox
Exec=/usr/bin/firefox-esr %u
Icon=firefox-esr
Type=Application
Terminal=false
StartupNotify=true
Categories=Applications;
EOF
RUN cat > /usr/share/applications/terminal.desktop <<'EOF'
[Desktop Entry]
Name=Terminal
Exec=xfce4-terminal
Icon=org.xfce.terminal
Type=Application
Terminal=false
Categories=Utility;TerminalEmulator;
EOF
RUN cat > /usr/share/applications/file-manager.desktop <<'EOF'
[Desktop Entry]
Name=File Manager
Exec=pcmanfm
Icon=system-file-manager
Type=Application
Terminal=false
Categories=System;FileTools;FileManager;Utility;Core;GTK;
MimeType=inode/directory
EOF
RUN mkdir -p /home/bytebot/Desktop && \
    cp /usr/share/applications/firefox.desktop /home/bytebot/Desktop/ && \
    cp /usr/share/applications/terminal.desktop /home/bytebot/Desktop/ && \
    cp /usr/share/applications/file-manager.desktop /home/bytebot/Desktop/ && \
    chown -R bytebot:bytebot /home/bytebot/Desktop

# --------------------------------------------------------------------------- #
# 8. Copy app artefacts from builder stage
# --------------------------------------------------------------------------- #
COPY --from=builder /src/bytebotd /opt/bytebotd
# Set restrictive permissions on bytebotd directory
RUN chown -R root:root /opt/bytebotd && \
    chmod -R 755 /opt/bytebotd

COPY --from=builder /src/libnut-core/build/Release/libnut.node \
     /opt/bytebotd/node_modules/@nut-tree-fork/libnut-linux/build/Release/

# --------------------------------------------------------------------------- #
# 9. Final cleanup & supervisor
# --------------------------------------------------------------------------- #
COPY infrastructure/docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
RUN update-desktop-database /usr/share/applications && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

EXPOSE 5900 6080 6081 9990
USER bytebot
CMD ["/usr/bin/supervisord","-c","/etc/supervisor/conf.d/supervisord.conf","-n"]
