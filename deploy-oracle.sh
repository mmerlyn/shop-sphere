#!/bin/bash

# ===========================================
# ShopSphere - Oracle Cloud Deployment Script
# ===========================================

set -e

echo "🚀 ShopSphere Oracle Cloud Deployment"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running on Oracle Cloud VM
check_requirements() {
    echo -e "${YELLOW}Checking requirements...${NC}"

    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Docker not found. Installing...${NC}"
        sudo apt-get update
        sudo apt-get install -y docker.io
        sudo systemctl start docker
        sudo systemctl enable docker
        sudo usermod -aG docker $USER
        echo -e "${GREEN}Docker installed. Please log out and back in, then run this script again.${NC}"
        exit 1
    fi

    # Check Docker Compose
    if ! command -v docker compose &> /dev/null; then
        echo -e "${RED}Docker Compose not found. Installing...${NC}"
        sudo apt-get install -y docker-compose-plugin
    fi

    echo -e "${GREEN}All requirements met!${NC}"
}

# Setup environment
setup_env() {
    echo -e "${YELLOW}Setting up environment...${NC}"

    if [ ! -f .env ]; then
        if [ -f .env.oracle ]; then
            cp .env.oracle .env
            echo -e "${GREEN}Created .env from .env.oracle${NC}"
            echo -e "${YELLOW}Please edit .env with your actual credentials before continuing.${NC}"
            echo "Press Enter to continue after editing .env, or Ctrl+C to abort..."
            read
        else
            echo -e "${RED}.env.oracle not found!${NC}"
            exit 1
        fi
    fi
}

# Build and deploy
deploy() {
    echo -e "${YELLOW}Building and deploying services...${NC}"

    # Pull latest images and build
    docker compose -f docker-compose.oracle.yml build --no-cache

    # Start services
    docker compose -f docker-compose.oracle.yml up -d

    echo -e "${GREEN}Deployment complete!${NC}"
}

# Health check
health_check() {
    echo -e "${YELLOW}Waiting for services to start...${NC}"
    sleep 10

    echo -e "${YELLOW}Checking service health...${NC}"

    # Check API Gateway
    if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ API Gateway is running${NC}"
    else
        echo -e "${RED}✗ API Gateway not responding${NC}"
    fi

    # Show running containers
    echo ""
    echo "Running containers:"
    docker compose -f docker-compose.oracle.yml ps
}

# Show logs
show_logs() {
    echo -e "${YELLOW}Showing logs (Ctrl+C to exit)...${NC}"
    docker compose -f docker-compose.oracle.yml logs -f
}

# Main menu
main() {
    case "${1:-deploy}" in
        deploy)
            check_requirements
            setup_env
            deploy
            health_check
            ;;
        logs)
            show_logs
            ;;
        stop)
            docker compose -f docker-compose.oracle.yml down
            echo -e "${GREEN}Services stopped.${NC}"
            ;;
        restart)
            docker compose -f docker-compose.oracle.yml restart
            echo -e "${GREEN}Services restarted.${NC}"
            ;;
        status)
            docker compose -f docker-compose.oracle.yml ps
            ;;
        *)
            echo "Usage: $0 {deploy|logs|stop|restart|status}"
            exit 1
            ;;
    esac
}

main "$@"
