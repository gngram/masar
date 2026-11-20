{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  nativeBuildInputs = with pkgs; [
    python3
    python3Packages.pip
    python3Packages.virtualenv
    python3Packages.django
    python3Packages.djangorestframework
    python3Packages.django-cors-headers
    python3Packages.bcrypt
    pkg-config
    git
    sqlite
    curl
    jq
  ];

  buildInputs = with pkgs; [
    gcc
    openssl
  ];

  shellHook = ''
    # Setup and activate local Python virtual environment
    if [ ! -d ".venv" ]; then
      echo "[*] Setting up local Python virtual environment (.venv)..."
      python3 -m venv --system-site-packages .venv
    fi
    source .venv/bin/activate
    export PYTHONPATH="$PWD:$PYTHONPATH"

    shopt -s expand_aliases
    run() { python3 manage.py runserver 0.0.0.0:8080 "$@"; }
    run-server() { python3 manage.py runserver 0.0.0.0:8080 "$@"; }
    migrate() { python3 manage.py migrate "$@"; }
    makemigrations() { python3 manage.py makemigrations "$@"; }
    masar-test() { python3 manage.py test "$@"; }
    django-shell() { python3 manage.py shell "$@"; }
    db-browse() { sqlite3 ./data/masar.db "$@"; }
    export -f run run-server migrate makemigrations masar-test django-shell db-browse

    alias test="python3 manage.py test"
    alias shell="python3 manage.py shell"

    echo "=================================================="
    echo "                 MASAR DEV SHELL"
    echo "    Masar (مسار) Hardware Traceability Platform"
    echo "     Powered by Python Django & InvenTree Engine"
    echo "  Pure Embedded SQLite • Zero External DB Daemons"
    echo "=================================================="
    echo "Virtual Environment: .venv (Active)"
    echo "Python Version: $(python3 --version)"
    echo ""
    echo "Available aliases / commands:"
    echo "  run            - Start web portal (manage.py runserver 0.0.0.0:8080)"
    echo "  migrate        - Apply database migrations"
    echo "  makemigrations - Generate new database migrations"
    echo "  test           - Run unit test suite"
    echo "  shell          - Open Django interactive shell"
    echo "  db-browse      - Inspect SQLite database"
    echo "=================================================="
  '';
}


