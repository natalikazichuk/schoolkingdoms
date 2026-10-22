#!/bin/bash
# Повернути ОДИН документ із щоденної копії бази (/srv/sk/backups), не чіпаючи решту.
# Повне відновлення (backup.sh) відкотило б і прогрес Героїв — тут лише один рядок docs.
#
#   sudo /srv/sk/repo/server/tools/restore-doc.sh list [шлях]       # що лежить у кожній копії
#   sudo /srv/sk/repo/server/tools/restore-doc.sh <копія.sql.gz> [шлях]
#
# Шлях за замовчуванням — curriculum/map. Для карти list показує кількість
# класів і розділів у кожній копії: беріть найсвіжішу, де їх стільки, скільки було.
# Поточну версію документа перед заміною кладемо в <шлях>_broken.
set -euo pipefail
B=/srv/sk/backups
DC=(docker compose -p sk -f /srv/sk/repo/server/docker-compose.yml)
[ -f /srv/sk/.env ] && DC+=(--env-file /srv/sk/.env)
MODE=${1:-list}
DOC=${2:-curriculum/map}

# Рядок документа з COPY-блоку таблиці docs (формат pg_dump: поля через TAB).
row() {
  gunzip -c "$1" | awk -v k="$DOC" '
    /^COPY public\.docs /{p=1; next}
    p && /^\\\.$/{exit}
    p { split($0, f, "\t"); if (f[1] == k) { print; exit } }'
}

# SQL, що кладе рядок у тимчасову таблицю r і виконує решту.
psql_with_row() {
  local line=$1 sql=$2
  { echo "create temp table r (like docs); copy r from stdin;"
    printf '%s\n' "$line"; echo '\.'
    echo "$sql"; } | "${DC[@]}" exec -T db psql -U sk -d sk -v ON_ERROR_STOP=1 -q -t
}

SIZE_SQL="select updated_at, version,
  (select count(*) from jsonb_array_elements(data->'tiers') t, jsonb_array_elements(t->'grades') g) as grades,
  (select count(*) from jsonb_array_elements(data->'tiers') t, jsonb_array_elements(t->'grades') g,
     jsonb_array_elements(g->'subjects') s, jsonb_array_elements(s->'topics') tp) as topics
  from r;"

if [ "$MODE" = list ]; then
  for f in $(ls -1 "$B"/sk-*.sql.gz | sort); do
    line=$(row "$f")
    if [ -z "$line" ]; then echo "$(basename "$f"): документа немає"; continue; fi
    if [ "$DOC" = curriculum/map ]; then
      echo "$(basename "$f"): $(psql_with_row "$line" "$SIZE_SQL" | tr -s ' ' | sed 's/^ //')"
    else
      echo "$(basename "$f"): $(psql_with_row "$line" 'select updated_at, version from r;' | tr -s ' ' | sed 's/^ //')"
    fi
  done
  echo "(формат: updated_at | version | класів | розділів)"
  exit 0
fi

F=$MODE; [ -f "$F" ] || F="$B/$MODE"
[ -f "$F" ] || { echo "Немає файлу $MODE"; exit 1; }
line=$(row "$F")
[ -n "$line" ] || { echo "У $(basename "$F") немає $DOC"; exit 1; }

"$(dirname "$0")/../backup.sh"   # свіжа копія перед зміною
psql_with_row "$line" "
begin;
insert into docs (path, parent, id, data)
  select path || '_broken', parent, id || '_broken', data from docs where path = '$DOC'
  on conflict (path) do update set data = excluded.data, version = docs.version + 1, updated_at = now();
update docs d set data = r.data, version = d.version + 1, updated_at = now() from r where d.path = r.path;
insert into docs (path, parent, id, data, version, created_at, updated_at)
  select * from r where not exists (select 1 from docs where path = r.path);
commit;"
echo "Відновлено $DOC з $(basename "$F") (стара версія — у ${DOC}_broken)."
