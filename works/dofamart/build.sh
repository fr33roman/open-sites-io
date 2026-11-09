#!/bin/sh
# Builds index.html (standalone site) from body.html: head part before the first <canvas>, page after it
cd "$(dirname "$0")"
python - <<'PY'
s = open('body.html', encoding='utf-8').read()
i = s.index('<canvas id="race"')
html = ('<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        + s[:i] + '</head>\n<body>\n' + s[i:] + '\n</body>\n</html>\n')
open('index.html', 'w', encoding='utf-8').write(html)
PY
