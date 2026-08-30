#!/bin/bash
echo "==> Running Django Collectstatic..."
python duesanddos/manage.py collectstatic --noinput --clear
echo "==> Collectstatic Completed!"
