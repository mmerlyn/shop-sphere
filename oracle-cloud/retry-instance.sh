#!/bin/bash

# ===========================================
# Oracle Cloud Instance Retry Script
# Keeps trying until ARM capacity is available
# ===========================================

export COMPARTMENT_ID="ocid1.tenancy.oc1..aaaaaaaafp7fsqxjxv7hlcabyjhtyqgym2oaqo2p5ve7nz5umbqogizisgeq"
export SUBNET_ID="ocid1.subnet.oc1.us-sanjose-1.aaaaaaaapbgjcmizfnqsvgqxchwa5d5g47qxdszpgxd7wrey4cij3wpqjs3a"
export AD="QdeJ:US-SANJOSE-1-AD-1"
export IMAGE_ID="ocid1.image.oc1.us-sanjose-1.aaaaaaaaqiu6papxpzh7wxk7drutfhcuil46kza4nq2dizro77gv3elagb5q"
export SUPPRESS_LABEL_WARNING=True

SSH_KEY=$(cat ~/.ssh/id_rsa.pub)

# Configuration
OCPUS=4
MEMORY_GB=24
RETRY_INTERVAL=30  # seconds between retries
MAX_RETRIES=1000   # max attempts (about 16 hours at 60s interval)

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║     Oracle Cloud Instance Retry Script                    ║"
echo "║     Will keep trying until capacity is available          ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "Configuration:"
echo "  OCPUs: $OCPUS"
echo "  Memory: ${MEMORY_GB}GB"
echo "  Retry interval: ${RETRY_INTERVAL}s"
echo ""
echo "Press Ctrl+C to stop"
echo ""

attempt=1
while [ $attempt -le $MAX_RETRIES ]; do
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Attempt $attempt..."

    RESULT=$(oci compute instance launch \
        --compartment-id "$COMPARTMENT_ID" \
        --availability-domain "$AD" \
        --display-name "shopsphere-server" \
        --shape "VM.Standard.A1.Flex" \
        --shape-config "{\"ocpus\": $OCPUS, \"memoryInGBs\": $MEMORY_GB}" \
        --image-id "$IMAGE_ID" \
        --subnet-id "$SUBNET_ID" \
        --assign-public-ip true \
        --metadata "{\"ssh_authorized_keys\": \"$SSH_KEY\"}" \
        2>&1)

    if echo "$RESULT" | grep -q "ocid1.instance"; then
        INSTANCE_ID=$(echo "$RESULT" | grep -o 'ocid1\.instance\.[^"]*')
        echo ""
        echo "╔═══════════════════════════════════════════════════════════╗"
        echo "║                    SUCCESS!                               ║"
        echo "╚═══════════════════════════════════════════════════════════╝"
        echo ""
        echo "Instance ID: $INSTANCE_ID"
        echo ""
        echo "Waiting for instance to be ready..."

        oci compute instance get \
            --instance-id "$INSTANCE_ID" \
            --wait-for-state RUNNING \
            --wait-interval-seconds 10 \
            > /dev/null 2>&1

        # Get public IP
        sleep 10
        VNIC_ID=$(oci compute vnic-attachment list \
            --compartment-id "$COMPARTMENT_ID" \
            --instance-id "$INSTANCE_ID" \
            --query "data[0].\"vnic-id\"" \
            --raw-output 2>/dev/null)

        PUBLIC_IP=$(oci network vnic get \
            --vnic-id "$VNIC_ID" \
            --query "data.\"public-ip\"" \
            --raw-output 2>/dev/null)

        echo "Public IP: $PUBLIC_IP"
        echo ""
        echo "SSH Command:"
        echo "  ssh -i ~/.ssh/id_rsa ubuntu@$PUBLIC_IP"
        echo ""
        echo "Instance created successfully!"

        # Save instance info
        echo "$INSTANCE_ID" > ~/.oci/shopsphere_instance_id
        echo "$PUBLIC_IP" > ~/.oci/shopsphere_public_ip

        exit 0
    elif echo "$RESULT" | grep -q "Out of host capacity"; then
        echo "  Out of capacity. Retrying in ${RETRY_INTERVAL}s..."
    else
        echo "  Error: $(echo "$RESULT" | grep -o '"message": "[^"]*"' | head -1)"
        echo "  Retrying in ${RETRY_INTERVAL}s..."
    fi

    sleep $RETRY_INTERVAL
    attempt=$((attempt + 1))
done

echo "Max retries reached. Please try again later."
exit 1
