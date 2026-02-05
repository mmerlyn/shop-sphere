# Oracle Cloud Deployment Guide

Deploy ShopSphere to Oracle Cloud **FREE** tier using OCI CLI.

## Prerequisites

### 1. Install OCI CLI

**macOS:**
```bash
brew install oci-cli
```

**Linux/Windows:**
```bash
pip install oci-cli
```

### 2. Configure OCI CLI

```bash
oci setup config
```

You'll need:
- **User OCID**: Profile → User Settings → OCID
- **Tenancy OCID**: Profile → Tenancy → OCID
- **Region**: e.g., `us-ashburn-1`
- **API Key**: Will be generated automatically

After setup, upload your public key to Oracle Cloud:
1. Go to Profile → User Settings → API Keys
2. Click "Add API Key"
3. Choose "Paste Public Key"
4. Paste contents of `~/.oci/oci_api_key_public.pem`

### 3. Verify Configuration

```bash
oci iam region list
```

## Deployment

### Quick Deploy (One Command)

```bash
cd oracle-cloud
chmod +x deploy-oci.sh
./deploy-oci.sh deploy
```

This will:
1. Create VCN (Virtual Cloud Network)
2. Create Internet Gateway
3. Create Security List (opens ports 22, 80, 443, 8000)
4. Create Subnet
5. Create ARM Compute Instance (4 OCPU, 24GB RAM - FREE)
6. Install Docker
7. Deploy ShopSphere

### Commands

```bash
./deploy-oci.sh deploy   # Full deployment
./deploy-oci.sh status   # Check instance status
./deploy-oci.sh ssh      # SSH into instance
./deploy-oci.sh cleanup  # Delete all resources
```

## Post-Deployment

### 1. Update Environment Variables

SSH into the instance and edit `.env`:

```bash
ssh -i ~/.ssh/id_rsa ubuntu@<PUBLIC_IP>
nano ~/shop-sphere/.env
```

Update:
- `JWT_SECRET` - Generate with: `openssl rand -hex 32`
- `STRIPE_SECRET_KEY` - Your Stripe key
- `MAIL_*` - Email credentials

### 2. Restart Services

```bash
cd ~/shop-sphere
sudo docker-compose -f docker-compose.oracle.yml restart
```

### 3. View Logs

```bash
sudo docker-compose -f docker-compose.oracle.yml logs -f
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Oracle Cloud (FREE)                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              VM.Standard.A1.Flex (ARM)                │  │
│  │              4 OCPU | 24GB RAM | FREE                 │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │                   Docker                        │  │  │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐          │  │  │
│  │  │  │API GW   │ │User Svc │ │Product  │          │  │  │
│  │  │  │:8000    │ │:3001    │ │:3002    │          │  │  │
│  │  │  └─────────┘ └─────────┘ └─────────┘          │  │  │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐          │  │  │
│  │  │  │Cart Svc │ │Order Svc│ │Notif Svc│          │  │  │
│  │  │  │:3003    │ │:3004    │ │:3005    │          │  │  │
│  │  │  └─────────┘ └─────────┘ └─────────┘          │  │  │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐          │  │  │
│  │  │  │Payment  │ │Review   │ │ Redis   │          │  │  │
│  │  │  │:3006    │ │:3007    │ │:6379    │          │  │  │
│  │  │  └─────────┘ └─────────┘ └─────────┘          │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │    Supabase     │
                    │   (PostgreSQL)  │
                    │      FREE       │
                    └─────────────────┘
```

## Costs

| Resource | Cost |
|----------|------|
| ARM VM (A1.Flex 4 OCPU, 24GB) | **FREE** |
| Block Storage (up to 200GB) | **FREE** |
| Supabase PostgreSQL | **FREE** |
| **Total** | **$0/month** |

## Troubleshooting

### "Out of capacity" error
ARM instances are popular. Try:
- Different availability domain
- Different region
- Try again later (capacity frees up)

### SSH connection refused
Wait 2-3 minutes after instance creation for SSH to be ready.

### Docker permission denied
Log out and back in, or use `sudo docker`.

### Services not starting
Check logs:
```bash
sudo docker-compose -f docker-compose.oracle.yml logs api-gateway
```
