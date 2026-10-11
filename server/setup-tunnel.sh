#!/bin/bash
# Одноразове налаштування VM для school-king.pp.ua:
#   nginx на :80 (домашній проксі закінчує HTTPS і шле сюди простий HTTP)
#   + SSH через WebSocket (websockify) за секретною адресою — щоб Claude
#     мав доступ до консолі з хмари, де ходить лише HTTPS.
# Запуск на сервері:  curl -sL <raw-url> | sudo bash -s <секретна-адреса>
# Секрет у репозиторій не кладемо — він передається аргументом.
set -euo pipefail

TUNNEL_PATH="${1:?Вкажіть секретну адресу тунелю першим аргументом}"
CLAUDE_KEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIByx9/MLSBZuC9P/u1AOJgW3DjcahU80XXNpSt5fo5Hw claude@schoolkingdoms'
ADMIN_USER="${SUDO_USER:-sysadmin}"

apt-get update -q
DEBIAN_FRONTEND=noninteractive apt-get install -y -q nginx websockify

# ключ Claude — у дозволені для входу
AK="/home/$ADMIN_USER/.ssh/authorized_keys"
install -d -m 700 -o "$ADMIN_USER" -g "$ADMIN_USER" "/home/$ADMIN_USER/.ssh"
touch "$AK"
grep -qF "$CLAUDE_KEY" "$AK" || echo "$CLAUDE_KEY" >> "$AK"
chown "$ADMIN_USER:$ADMIN_USER" "$AK"
chmod 600 "$AK"

cat > /etc/systemd/system/sk-tunnel.service <<'EOF'
[Unit]
Description=SSH over WebSocket for Claude
After=network.target
[Service]
ExecStart=/usr/bin/websockify 127.0.0.1:8022 127.0.0.1:22
Restart=always
User=nobody
[Install]
WantedBy=multi-user.target
EOF

cat > /etc/nginx/sites-available/default <<EOF
map \$http_upgrade \$connection_upgrade { default upgrade; '' close; }
server {
  listen 80 default_server;
  server_name _;
  location /$TUNNEL_PATH {
    proxy_pass http://127.0.0.1:8022;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$connection_upgrade;
    proxy_read_timeout 1d;
    proxy_send_timeout 1d;
  }
  location / {
    default_type text/plain;
    return 200 "SchoolKingdoms: server ok\n";
  }
}
EOF

systemctl daemon-reload
systemctl enable --now sk-tunnel
nginx -t
systemctl reload nginx
curl -s http://localhost
