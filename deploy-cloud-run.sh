#!/bin/bash
# Cloud Run Deployment Script for Last Man Standing

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Last Man Standing - Cloud Run Deployment${NC}"
echo "=========================================="

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: Google Cloud SDK is not installed${NC}"
    echo ""
    echo "Please install the Google Cloud SDK from:"
    echo "https://cloud.google.com/sdk/docs/install"
    echo ""
    echo "Then retry this script"
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    echo -e "${YELLOW}Authenticating with Google Cloud...${NC}"
    gcloud auth login
fi

# Set project
echo -e "${YELLOW}Setting project to last-man-standing-6cc93...${NC}"
gcloud config set project last-man-standing-6cc93

if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to set project${NC}"
    exit 1
fi

# Navigate to web directory
cd "$(dirname "$0")/web" || exit 1

echo -e "${YELLOW}Deploying to Cloud Run...${NC}"
echo "This may take 2-5 minutes..."
echo ""

gcloud run deploy last-man-standing \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --timeout 600 \
  --set-env-vars "NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY" \
  --set-env-vars "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN" \
  --set-env-vars "NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID" \
  --set-env-vars "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET" \
  --set-env-vars "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID" \
  --set-env-vars "NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ Deployment successful!${NC}"
    echo ""
    echo "Your app is now live at:"
    gcloud run services describe last-man-standing --region us-central1 --format="value(status.url)"
else
    echo -e "${RED}Deployment failed${NC}"
    exit 1
fi
