#!/bin/sh
# Builds index.html (standalone site) from body.html
cd "$(dirname "$0")"
{ printf '<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'; cat body.html; printf '\n</html>\n'; } > index.html
