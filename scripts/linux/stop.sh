#!/bin/bash
#
# Hytale Server Manager - Stop Script
#
# This script stops the running application.
#

SERVICE_NAME="hytale-manager"

echo ""
echo "======================================"
echo "  Hytale Server Manager - Stop"
echo "======================================"
echo ""

# Try systemd first
if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    echo "Stopping systemd service: $SERVICE_NAME"
    sudo systemctl stop "$SERVICE_NAME"
    echo "Service stopped."
else
    # Try to find and kill the process
    echo "Stopping process..."

    PIDS=$(pgrep -f "node.*index.js" 2>/dev/null)

    if [[ -n "$PIDS" ]]; then
        for PID in $PIDS; do
            echo "Stopping process $PID..."
            kill "$PID" 2>/dev/null
        done

        # Wait a moment and force kill if still running
        sleep 2
        for PID in $PIDS; do
            if kill -0 "$PID" 2>/dev/null; then
                echo "Force stopping process $PID..."
                kill -9 "$PID" 2>/dev/null
            fi
        done

        echo "Stopped."
    else
        echo "No running process found."
    fi
fi

echo ""
