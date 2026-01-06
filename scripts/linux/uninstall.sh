#!/bin/bash
#
# Hytale Server Manager - Linux Uninstall Script
#
# This script removes the Hytale Server Manager from Linux.
#
# Usage: sudo ./uninstall.sh [OPTIONS]
#
# Options:
#   -p, --path PATH      Installation path (default: /opt/hytale-manager)
#   -k, --keep-data      Keep the data directory
#   -h, --help           Show this help message
#

set -e

# Default values
INSTALL_PATH="/opt/hytale-manager"
SERVICE_NAME="hytale-manager"
SERVICE_USER="hytale"
KEEP_DATA=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Functions
print_status() { echo -e "[*] $1"; }
print_success() { echo -e "${GREEN}[+]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
print_error() { echo -e "${RED}[-]${NC} $1"; }

show_help() {
    echo "Hytale Server Manager - Linux Uninstall Script"
    echo ""
    echo "Usage: sudo $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -p, --path PATH      Installation path (default: /opt/hytale-manager)"
    echo "  -k, --keep-data      Keep the data directory"
    echo "  -h, --help           Show this help message"
    echo ""
    exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--path)
            INSTALL_PATH="$2"
            shift 2
            ;;
        -k|--keep-data)
            KEEP_DATA=true
            shift
            ;;
        -h|--help)
            show_help
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            ;;
    esac
done

echo ""
echo -e "${RED}======================================${NC}"
echo -e "${RED}  Hytale Server Manager Uninstaller${NC}"
echo -e "${RED}======================================${NC}"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    print_error "This script must be run as root (sudo)"
    exit 1
fi

# Confirm
print_warning "This will remove Hytale Server Manager from:"
echo "  $INSTALL_PATH"
echo ""

if [[ "$KEEP_DATA" != true ]]; then
    print_warning "ALL DATA WILL BE DELETED including:"
    echo "  - Database"
    echo "  - Server files"
    echo "  - Backups"
    echo "  - Logs"
    echo ""
    echo "Use -k or --keep-data to preserve data directory"
    echo ""
fi

read -p "Are you sure you want to continue? (type 'yes' to confirm) " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
    echo "Uninstall cancelled."
    exit 0
fi

# Stop and disable service
print_status "Checking for systemd service..."
if systemctl list-unit-files | grep -q "$SERVICE_NAME"; then
    print_status "Stopping service..."
    systemctl stop "$SERVICE_NAME" 2>/dev/null || true
    systemctl disable "$SERVICE_NAME" 2>/dev/null || true

    print_status "Removing service file..."
    rm -f "/etc/systemd/system/$SERVICE_NAME.service"
    systemctl daemon-reload

    print_success "Service removed"
else
    echo "No service found"
fi

# Remove firewall rule if UFW
if command -v ufw &> /dev/null; then
    print_status "Removing firewall rule..."
    ufw delete allow "Hytale Server Manager" 2>/dev/null || true
    print_success "Firewall rule removed"
fi

# Remove installation directory
print_status "Removing installation files..."
if [[ -d "$INSTALL_PATH" ]]; then
    if [[ "$KEEP_DATA" == true ]]; then
        # Remove everything except data directory
        find "$INSTALL_PATH" -mindepth 1 -maxdepth 1 ! -name 'data' -exec rm -rf {} \;
        print_success "Installation files removed (data preserved)"
        echo "Data directory preserved at: $INSTALL_PATH/data"
    else
        rm -rf "$INSTALL_PATH"
        print_success "All files removed"
    fi
fi

# Remove service user (optional, only if no other processes)
if id "$SERVICE_USER" &>/dev/null; then
    PROCESSES=$(pgrep -u "$SERVICE_USER" 2>/dev/null || echo "")
    if [[ -z "$PROCESSES" ]]; then
        print_status "Removing service user: $SERVICE_USER"
        userdel "$SERVICE_USER" 2>/dev/null || true
        print_success "User removed"
    else
        print_warning "User '$SERVICE_USER' still has running processes, not removing"
    fi
fi

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  Uninstall Complete${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
