"""
WSGI config for duesanddos project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/4.2/howto/deployment/wsgi/
"""

import os
import sys
from pathlib import Path

# Add the django project directory (containing manage.py) to sys.path
base_dir = Path(__file__).resolve().parent.parent
sys.path.append(str(base_dir))

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "duesanddos.settings")

application = get_wsgi_application()
app = application
