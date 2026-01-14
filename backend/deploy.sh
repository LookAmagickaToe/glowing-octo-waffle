#!/bin/bash
# Deploy Gmail OAuth Cloud Functions to GCP

set -e

PROJECT_ID="waffle-mm"
REGION="us-central1"

# Load environment variables from .env file
if [ -f "../.env" ]; then
    export $(grep -v '^#' ../.env | xargs)
    echo "Loaded environment variables from .env"
else
    echo "ERROR: .env file not found in parent directory"
    exit 1
fi

# Verify required env vars
if [ -z "$GOOGLE_CLIENT_ID" ] || [ -z "$GOOGLE_CLIENT_SECRET" ]; then
    echo "ERROR: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env"
    exit 1
fi

echo "Deploying Gmail Cloud Functions to project: $PROJECT_ID"

# Copy shared module to each function directory
echo "Copying shared module..."
cp -r functions/shared/token_manager.py functions/gmail-auth/token_manager.py
cp -r functions/shared/token_manager.py functions/gmail-api/token_manager.py

# Environment variables to pass to all functions
ENV_VARS="PROJECT_ID=$PROJECT_ID,GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET"

# Deploy OAuth functions
echo "Deploying gmail-auth-init..."
gcloud functions deploy gmail-auth-init \
    --gen2 \
    --runtime=python311 \
    --region=$REGION \
    --source=functions/gmail-auth \
    --entry-point=gmail_auth_init \
    --trigger-http \
    --allow-unauthenticated \
    --set-env-vars=$ENV_VARS \
    --project=$PROJECT_ID

echo "Deploying gmail-auth-callback..."
gcloud functions deploy gmail-auth-callback \
    --gen2 \
    --runtime=python311 \
    --region=$REGION \
    --source=functions/gmail-auth \
    --entry-point=gmail_auth_callback \
    --trigger-http \
    --allow-unauthenticated \
    --set-env-vars=$ENV_VARS \
    --project=$PROJECT_ID

echo "Deploying gmail-auth-status..."
gcloud functions deploy gmail-auth-status \
    --gen2 \
    --runtime=python311 \
    --region=$REGION \
    --source=functions/gmail-auth \
    --entry-point=gmail_auth_status \
    --trigger-http \
    --allow-unauthenticated \
    --set-env-vars=$ENV_VARS \
    --project=$PROJECT_ID

echo "Deploying gmail-auth-revoke..."
gcloud functions deploy gmail-auth-revoke \
    --gen2 \
    --runtime=python311 \
    --region=$REGION \
    --source=functions/gmail-auth \
    --entry-point=gmail_auth_revoke \
    --trigger-http \
    --allow-unauthenticated \
    --set-env-vars=$ENV_VARS \
    --project=$PROJECT_ID

# Deploy Gmail API functions
echo "Deploying gmail-messages..."
gcloud functions deploy gmail-messages \
    --gen2 \
    --runtime=python311 \
    --region=$REGION \
    --source=functions/gmail-api \
    --entry-point=gmail_messages \
    --trigger-http \
    --allow-unauthenticated \
    --set-env-vars=$ENV_VARS \
    --project=$PROJECT_ID

echo "Deploying gmail-message..."
gcloud functions deploy gmail-message \
    --gen2 \
    --runtime=python311 \
    --region=$REGION \
    --source=functions/gmail-api \
    --entry-point=gmail_message \
    --trigger-http \
    --allow-unauthenticated \
    --set-env-vars=$ENV_VARS \
    --project=$PROJECT_ID

echo "Deploying gmail-send..."
gcloud functions deploy gmail-send \
    --gen2 \
    --runtime=python311 \
    --region=$REGION \
    --source=functions/gmail-api \
    --entry-point=gmail_send \
    --trigger-http \
    --allow-unauthenticated \
    --set-env-vars=$ENV_VARS \
    --project=$PROJECT_ID

echo "Deploying gmail-labels..."
gcloud functions deploy gmail-labels \
    --gen2 \
    --runtime=python311 \
    --region=$REGION \
    --source=functions/gmail-api \
    --entry-point=gmail_labels \
    --trigger-http \
    --allow-unauthenticated \
    --set-env-vars=$ENV_VARS \
    --project=$PROJECT_ID

echo "Deploying gmail-drafts..."
gcloud functions deploy gmail-drafts \
    --gen2 \
    --runtime=python311 \
    --region=$REGION \
    --source=functions/gmail-api \
    --entry-point=gmail_drafts \
    --trigger-http \
    --allow-unauthenticated \
    --set-env-vars=$ENV_VARS \
    --project=$PROJECT_ID

echo "Deploying gmail-draft..."
gcloud functions deploy gmail-draft \
    --gen2 \
    --runtime=python311 \
    --region=$REGION \
    --source=functions/gmail-api \
    --entry-point=gmail_draft \
    --trigger-http \
    --allow-unauthenticated \
    --set-env-vars=$ENV_VARS \
    --project=$PROJECT_ID

echo "Deploying gmail-modify..."
gcloud functions deploy gmail-modify \
    --gen2 \
    --runtime=python311 \
    --region=$REGION \
    --source=functions/gmail-api \
    --entry-point=gmail_modify \
    --trigger-http \
    --allow-unauthenticated \
    --set-env-vars=$ENV_VARS \
    --project=$PROJECT_ID

# Cleanup copied files
rm functions/gmail-auth/token_manager.py
rm functions/gmail-api/token_manager.py

echo ""
echo "Deployment complete!"
echo ""
echo "Function URLs:"
echo "  https://$REGION-$PROJECT_ID.cloudfunctions.net/gmail-auth-init"
echo "  https://$REGION-$PROJECT_ID.cloudfunctions.net/gmail-auth-callback"
echo "  https://$REGION-$PROJECT_ID.cloudfunctions.net/gmail-auth-status"
echo "  https://$REGION-$PROJECT_ID.cloudfunctions.net/gmail-auth-revoke"
echo "  https://$REGION-$PROJECT_ID.cloudfunctions.net/gmail-messages"
echo "  https://$REGION-$PROJECT_ID.cloudfunctions.net/gmail-message"
echo "  https://$REGION-$PROJECT_ID.cloudfunctions.net/gmail-send"
echo "  https://$REGION-$PROJECT_ID.cloudfunctions.net/gmail-labels"
echo "  https://$REGION-$PROJECT_ID.cloudfunctions.net/gmail-drafts"
echo "  https://$REGION-$PROJECT_ID.cloudfunctions.net/gmail-draft"
echo "  https://$REGION-$PROJECT_ID.cloudfunctions.net/gmail-modify"
