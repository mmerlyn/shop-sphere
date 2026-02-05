#!/bin/bash

# ===========================================
# ShopSphere - Oracle Cloud Infrastructure CLI Deployment
# ===========================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration - EDIT THESE
export COMPARTMENT_ID=""  # Your compartment OCID (leave empty to use tenancy root)
export REGION="us-ashburn-1"  # Change to your preferred region
export DISPLAY_NAME="shopsphere"
export SSH_PUBLIC_KEY_PATH="$HOME/.ssh/id_rsa.pub"

# Derived names
VCN_NAME="${DISPLAY_NAME}-vcn"
SUBNET_NAME="${DISPLAY_NAME}-subnet"
INSTANCE_NAME="${DISPLAY_NAME}-server"
SECURITY_LIST_NAME="${DISPLAY_NAME}-security-list"

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║     ShopSphere - Oracle Cloud Infrastructure Setup        ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ===========================================
# Pre-flight checks
# ===========================================
preflight_checks() {
    echo -e "${YELLOW}[1/8] Running pre-flight checks...${NC}"

    # Check OCI CLI
    if ! command -v oci &> /dev/null; then
        echo -e "${RED}OCI CLI not found. Install it first:${NC}"
        echo "  brew install oci-cli  (macOS)"
        echo "  pip install oci-cli   (pip)"
        echo ""
        echo "Then run: oci setup config"
        exit 1
    fi

    # Check if configured
    if ! oci iam region list &> /dev/null; then
        echo -e "${RED}OCI CLI not configured. Run: oci setup config${NC}"
        exit 1
    fi

    # Get tenancy if compartment not set
    if [ -z "$COMPARTMENT_ID" ]; then
        COMPARTMENT_ID=$(oci iam compartment list --query "data[0].\"compartment-id\"" --raw-output 2>/dev/null || \
                         oci iam tenancy get --query "data.id" --raw-output)
        echo -e "${YELLOW}Using root compartment: ${COMPARTMENT_ID}${NC}"
    fi

    # Check SSH key
    if [ ! -f "$SSH_PUBLIC_KEY_PATH" ]; then
        echo -e "${YELLOW}SSH key not found at $SSH_PUBLIC_KEY_PATH${NC}"
        echo "Generating new SSH key..."
        ssh-keygen -t rsa -b 4096 -f "${SSH_PUBLIC_KEY_PATH%.pub}" -N ""
    fi

    echo -e "${GREEN}Pre-flight checks passed!${NC}"
}

# ===========================================
# Create VCN (Virtual Cloud Network)
# ===========================================
create_vcn() {
    echo -e "${YELLOW}[2/8] Creating Virtual Cloud Network...${NC}"

    # Check if VCN exists
    EXISTING_VCN=$(oci network vcn list \
        --compartment-id "$COMPARTMENT_ID" \
        --display-name "$VCN_NAME" \
        --query "data[0].id" \
        --raw-output 2>/dev/null || echo "")

    if [ -n "$EXISTING_VCN" ] && [ "$EXISTING_VCN" != "null" ]; then
        VCN_ID="$EXISTING_VCN"
        echo -e "${GREEN}Using existing VCN: $VCN_ID${NC}"
    else
        VCN_ID=$(oci network vcn create \
            --compartment-id "$COMPARTMENT_ID" \
            --display-name "$VCN_NAME" \
            --cidr-blocks '["10.0.0.0/16"]' \
            --dns-label "shopsphere" \
            --query "data.id" \
            --raw-output)
        echo -e "${GREEN}Created VCN: $VCN_ID${NC}"
    fi

    export VCN_ID
}

# ===========================================
# Create Internet Gateway
# ===========================================
create_internet_gateway() {
    echo -e "${YELLOW}[3/8] Creating Internet Gateway...${NC}"

    # Check if IG exists
    EXISTING_IG=$(oci network internet-gateway list \
        --compartment-id "$COMPARTMENT_ID" \
        --vcn-id "$VCN_ID" \
        --display-name "${DISPLAY_NAME}-ig" \
        --query "data[0].id" \
        --raw-output 2>/dev/null || echo "")

    if [ -n "$EXISTING_IG" ] && [ "$EXISTING_IG" != "null" ]; then
        IG_ID="$EXISTING_IG"
        echo -e "${GREEN}Using existing Internet Gateway: $IG_ID${NC}"
    else
        IG_ID=$(oci network internet-gateway create \
            --compartment-id "$COMPARTMENT_ID" \
            --vcn-id "$VCN_ID" \
            --display-name "${DISPLAY_NAME}-ig" \
            --is-enabled true \
            --query "data.id" \
            --raw-output)
        echo -e "${GREEN}Created Internet Gateway: $IG_ID${NC}"
    fi

    # Update route table
    RT_ID=$(oci network vcn get --vcn-id "$VCN_ID" --query "data.\"default-route-table-id\"" --raw-output)

    # Add route rule for internet access
    oci network route-table update \
        --rt-id "$RT_ID" \
        --route-rules "[{\"destination\": \"0.0.0.0/0\", \"destinationType\": \"CIDR_BLOCK\", \"networkEntityId\": \"$IG_ID\"}]" \
        --force \
        > /dev/null 2>&1 || true

    echo -e "${GREEN}Route table updated${NC}"
}

# ===========================================
# Create Security List
# ===========================================
create_security_list() {
    echo -e "${YELLOW}[4/8] Creating Security List...${NC}"

    # Security rules JSON
    INGRESS_RULES='[
        {"source": "0.0.0.0/0", "protocol": "6", "tcpOptions": {"destinationPortRange": {"min": 22, "max": 22}}, "description": "SSH"},
        {"source": "0.0.0.0/0", "protocol": "6", "tcpOptions": {"destinationPortRange": {"min": 80, "max": 80}}, "description": "HTTP"},
        {"source": "0.0.0.0/0", "protocol": "6", "tcpOptions": {"destinationPortRange": {"min": 443, "max": 443}}, "description": "HTTPS"},
        {"source": "0.0.0.0/0", "protocol": "6", "tcpOptions": {"destinationPortRange": {"min": 8000, "max": 8000}}, "description": "API Gateway"},
        {"source": "0.0.0.0/0", "protocol": "1", "icmpOptions": {"type": 3, "code": 4}, "description": "ICMP"}
    ]'

    EGRESS_RULES='[
        {"destination": "0.0.0.0/0", "protocol": "all", "description": "Allow all outbound"}
    ]'

    # Check if security list exists
    EXISTING_SL=$(oci network security-list list \
        --compartment-id "$COMPARTMENT_ID" \
        --vcn-id "$VCN_ID" \
        --display-name "$SECURITY_LIST_NAME" \
        --query "data[0].id" \
        --raw-output 2>/dev/null || echo "")

    if [ -n "$EXISTING_SL" ] && [ "$EXISTING_SL" != "null" ]; then
        SL_ID="$EXISTING_SL"
        # Update existing security list
        oci network security-list update \
            --security-list-id "$SL_ID" \
            --ingress-security-rules "$INGRESS_RULES" \
            --egress-security-rules "$EGRESS_RULES" \
            --force \
            > /dev/null
        echo -e "${GREEN}Updated existing Security List: $SL_ID${NC}"
    else
        SL_ID=$(oci network security-list create \
            --compartment-id "$COMPARTMENT_ID" \
            --vcn-id "$VCN_ID" \
            --display-name "$SECURITY_LIST_NAME" \
            --ingress-security-rules "$INGRESS_RULES" \
            --egress-security-rules "$EGRESS_RULES" \
            --query "data.id" \
            --raw-output)
        echo -e "${GREEN}Created Security List: $SL_ID${NC}"
    fi

    export SL_ID
}

# ===========================================
# Create Subnet
# ===========================================
create_subnet() {
    echo -e "${YELLOW}[5/8] Creating Subnet...${NC}"

    # Get availability domain
    AD=$(oci iam availability-domain list \
        --compartment-id "$COMPARTMENT_ID" \
        --query "data[0].name" \
        --raw-output)

    # Check if subnet exists
    EXISTING_SUBNET=$(oci network subnet list \
        --compartment-id "$COMPARTMENT_ID" \
        --vcn-id "$VCN_ID" \
        --display-name "$SUBNET_NAME" \
        --query "data[0].id" \
        --raw-output 2>/dev/null || echo "")

    if [ -n "$EXISTING_SUBNET" ] && [ "$EXISTING_SUBNET" != "null" ]; then
        SUBNET_ID="$EXISTING_SUBNET"
        echo -e "${GREEN}Using existing Subnet: $SUBNET_ID${NC}"
    else
        SUBNET_ID=$(oci network subnet create \
            --compartment-id "$COMPARTMENT_ID" \
            --vcn-id "$VCN_ID" \
            --display-name "$SUBNET_NAME" \
            --cidr-block "10.0.1.0/24" \
            --security-list-ids "[\"$SL_ID\"]" \
            --dns-label "subnet1" \
            --query "data.id" \
            --raw-output)
        echo -e "${GREEN}Created Subnet: $SUBNET_ID${NC}"
    fi

    export SUBNET_ID
    export AD
}

# ===========================================
# Create Compute Instance
# ===========================================
create_instance() {
    echo -e "${YELLOW}[6/8] Creating Compute Instance (ARM A1.Flex - FREE)...${NC}"

    # Check if instance exists
    EXISTING_INSTANCE=$(oci compute instance list \
        --compartment-id "$COMPARTMENT_ID" \
        --display-name "$INSTANCE_NAME" \
        --lifecycle-state RUNNING \
        --query "data[0].id" \
        --raw-output 2>/dev/null || echo "")

    if [ -n "$EXISTING_INSTANCE" ] && [ "$EXISTING_INSTANCE" != "null" ]; then
        INSTANCE_ID="$EXISTING_INSTANCE"
        echo -e "${GREEN}Using existing Instance: $INSTANCE_ID${NC}"
    else
        # Get Ubuntu 22.04 ARM image
        IMAGE_ID=$(oci compute image list \
            --compartment-id "$COMPARTMENT_ID" \
            --operating-system "Canonical Ubuntu" \
            --operating-system-version "22.04" \
            --shape "VM.Standard.A1.Flex" \
            --sort-by TIMECREATED \
            --sort-order DESC \
            --query "data[0].id" \
            --raw-output)

        echo "Using Ubuntu image: $IMAGE_ID"

        # Read SSH public key
        SSH_KEY=$(cat "$SSH_PUBLIC_KEY_PATH")

        # Create instance
        INSTANCE_ID=$(oci compute instance launch \
            --compartment-id "$COMPARTMENT_ID" \
            --availability-domain "$AD" \
            --display-name "$INSTANCE_NAME" \
            --shape "VM.Standard.A1.Flex" \
            --shape-config '{"ocpus": 4, "memoryInGBs": 24}' \
            --image-id "$IMAGE_ID" \
            --subnet-id "$SUBNET_ID" \
            --assign-public-ip true \
            --metadata "{\"ssh_authorized_keys\": \"$SSH_KEY\"}" \
            --query "data.id" \
            --raw-output)

        echo -e "${GREEN}Created Instance: $INSTANCE_ID${NC}"
        echo "Waiting for instance to be ready..."

        oci compute instance get \
            --instance-id "$INSTANCE_ID" \
            --wait-for-state RUNNING \
            --wait-interval-seconds 10 \
            > /dev/null
    fi

    # Get public IP
    VNIC_ATTACHMENT=$(oci compute vnic-attachment list \
        --compartment-id "$COMPARTMENT_ID" \
        --instance-id "$INSTANCE_ID" \
        --query "data[0].\"vnic-id\"" \
        --raw-output)

    PUBLIC_IP=$(oci network vnic get \
        --vnic-id "$VNIC_ATTACHMENT" \
        --query "data.\"public-ip\"" \
        --raw-output)

    export INSTANCE_ID
    export PUBLIC_IP

    echo -e "${GREEN}Instance Public IP: $PUBLIC_IP${NC}"
}

# ===========================================
# Setup Instance (Install Docker, Deploy App)
# ===========================================
setup_instance() {
    echo -e "${YELLOW}[7/8] Setting up instance with Docker...${NC}"

    SSH_KEY_PATH="${SSH_PUBLIC_KEY_PATH%.pub}"
    SSH_CMD="ssh -o StrictHostKeyChecking=no -i $SSH_KEY_PATH ubuntu@$PUBLIC_IP"

    echo "Waiting for SSH to be available..."
    for i in {1..30}; do
        if $SSH_CMD "echo 'SSH ready'" 2>/dev/null; then
            break
        fi
        sleep 10
    done

    echo "Installing Docker and dependencies..."
    $SSH_CMD << 'REMOTE_SCRIPT'
        # Update system
        sudo apt-get update
        sudo apt-get upgrade -y

        # Install Docker
        sudo apt-get install -y docker.io docker-compose-plugin git

        # Start Docker
        sudo systemctl start docker
        sudo systemctl enable docker
        sudo usermod -aG docker ubuntu

        # Install Docker Compose standalone (for compatibility)
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose

        echo "Docker installed successfully!"
        docker --version
        docker-compose --version
REMOTE_SCRIPT

    echo -e "${GREEN}Instance setup complete!${NC}"
}

# ===========================================
# Deploy Application
# ===========================================
deploy_app() {
    echo -e "${YELLOW}[8/8] Deploying ShopSphere...${NC}"

    SSH_KEY_PATH="${SSH_PUBLIC_KEY_PATH%.pub}"
    SSH_CMD="ssh -o StrictHostKeyChecking=no -i $SSH_KEY_PATH ubuntu@$PUBLIC_IP"
    SCP_CMD="scp -o StrictHostKeyChecking=no -i $SSH_KEY_PATH"

    # Get the script's directory (where the project is)
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

    echo "Copying project files to server..."

    # Create project directory
    $SSH_CMD "mkdir -p ~/shop-sphere"

    # Copy essential files
    $SCP_CMD "$SCRIPT_DIR/docker-compose.oracle.yml" "ubuntu@$PUBLIC_IP:~/shop-sphere/"
    $SCP_CMD "$SCRIPT_DIR/.env.oracle" "ubuntu@$PUBLIC_IP:~/shop-sphere/.env"
    $SCP_CMD -r "$SCRIPT_DIR/services" "ubuntu@$PUBLIC_IP:~/shop-sphere/"

    echo "Building and starting services..."
    $SSH_CMD << 'REMOTE_DEPLOY'
        cd ~/shop-sphere

        # Use docker with sudo until next login
        sudo docker-compose -f docker-compose.oracle.yml build
        sudo docker-compose -f docker-compose.oracle.yml up -d

        echo ""
        echo "Deployment status:"
        sudo docker-compose -f docker-compose.oracle.yml ps
REMOTE_DEPLOY

    echo -e "${GREEN}Deployment complete!${NC}"
}

# ===========================================
# Print Summary
# ===========================================
print_summary() {
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║              Deployment Complete!                         ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}Instance Details:${NC}"
    echo "  Public IP:     $PUBLIC_IP"
    echo "  Instance ID:   $INSTANCE_ID"
    echo ""
    echo -e "${GREEN}Access:${NC}"
    echo "  SSH:           ssh -i ${SSH_PUBLIC_KEY_PATH%.pub} ubuntu@$PUBLIC_IP"
    echo "  API Gateway:   http://$PUBLIC_IP:8000/api"
    echo ""
    echo -e "${GREEN}Management Commands:${NC}"
    echo "  View logs:     ssh ubuntu@$PUBLIC_IP 'cd shop-sphere && sudo docker-compose -f docker-compose.oracle.yml logs -f'"
    echo "  Restart:       ssh ubuntu@$PUBLIC_IP 'cd shop-sphere && sudo docker-compose -f docker-compose.oracle.yml restart'"
    echo "  Stop:          ssh ubuntu@$PUBLIC_IP 'cd shop-sphere && sudo docker-compose -f docker-compose.oracle.yml down'"
    echo ""
    echo -e "${YELLOW}Note: Update .env on the server with your actual credentials!${NC}"
    echo "  ssh ubuntu@$PUBLIC_IP 'nano ~/shop-sphere/.env'"
    echo ""
}

# ===========================================
# Cleanup (optional)
# ===========================================
cleanup() {
    echo -e "${RED}Cleaning up all resources...${NC}"

    # Terminate instance
    if [ -n "$INSTANCE_ID" ]; then
        oci compute instance terminate --instance-id "$INSTANCE_ID" --force
    fi

    # Delete subnet
    if [ -n "$SUBNET_ID" ]; then
        oci network subnet delete --subnet-id "$SUBNET_ID" --force
    fi

    # Delete security list
    if [ -n "$SL_ID" ]; then
        oci network security-list delete --security-list-id "$SL_ID" --force
    fi

    # Delete internet gateway
    if [ -n "$IG_ID" ]; then
        oci network internet-gateway delete --ig-id "$IG_ID" --force
    fi

    # Delete VCN
    if [ -n "$VCN_ID" ]; then
        oci network vcn delete --vcn-id "$VCN_ID" --force
    fi

    echo -e "${GREEN}Cleanup complete!${NC}"
}

# ===========================================
# Main
# ===========================================
main() {
    case "${1:-deploy}" in
        deploy)
            preflight_checks
            create_vcn
            create_internet_gateway
            create_security_list
            create_subnet
            create_instance
            setup_instance
            deploy_app
            print_summary
            ;;
        cleanup)
            cleanup
            ;;
        status)
            oci compute instance list \
                --compartment-id "$COMPARTMENT_ID" \
                --display-name "$INSTANCE_NAME" \
                --output table
            ;;
        ssh)
            SSH_KEY_PATH="${SSH_PUBLIC_KEY_PATH%.pub}"
            ssh -i "$SSH_KEY_PATH" "ubuntu@$PUBLIC_IP"
            ;;
        *)
            echo "Usage: $0 {deploy|cleanup|status|ssh}"
            echo ""
            echo "Commands:"
            echo "  deploy  - Create infrastructure and deploy app"
            echo "  cleanup - Delete all created resources"
            echo "  status  - Show instance status"
            echo "  ssh     - SSH into the instance"
            exit 1
            ;;
    esac
}

main "$@"
