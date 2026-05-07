#!/usr/bin/env bash
# TraceForge — One-time GCP project bootstrap
# Run once: bash infra/setup.sh
# Prerequisites: gcloud CLI installed and authenticated (gcloud auth login)

set -euo pipefail

# ── Config — edit these ───────────────────────────────────────────────────────
PROJECT_ID="${GCP_PROJECT_ID:-traceforge-hackathon}"
REGION="us-central1"
# ─────────────────────────────────────────────────────────────────────────────

echo "🚀 Setting up TraceForge GCP project: $PROJECT_ID"

# 1. Create project (skip if already exists)
gcloud projects create "$PROJECT_ID" --name="TraceForge" 2>/dev/null || \
  echo "  ↳ Project $PROJECT_ID already exists, continuing..."

gcloud config set project "$PROJECT_ID"

# 2. Link billing (required for Cloud Run + Vertex AI)
echo ""
echo "⚠️  ACTION REQUIRED: Link a billing account to $PROJECT_ID"
echo "   → https://console.cloud.google.com/billing/linkedaccount?project=$PROJECT_ID"
echo "   Press Enter once billing is linked..."
read -r

# 3. Enable required APIs
echo "🔧 Enabling APIs (this takes ~2 minutes)..."
gcloud services enable \
  aiplatform.googleapis.com \
  run.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  customsearch.googleapis.com \
  --project="$PROJECT_ID"

echo "  ✅ APIs enabled"

# 4. Create Firestore database
echo "🗄️  Creating Firestore database..."
gcloud firestore databases create \
  --location="$REGION" \
  --project="$PROJECT_ID" 2>/dev/null || \
  echo "  ↳ Firestore database already exists"

# 5. Create Secret Manager secrets (empty — fill in after getting keys)
echo "🔐 Creating Secret Manager secrets..."
for secret in phoenix-api-key phoenix-collector-endpoint google-search-api-key google-search-engine-id; do
  gcloud secrets create "$secret" \
    --replication-policy="automatic" \
    --project="$PROJECT_ID" 2>/dev/null || \
    echo "  ↳ Secret $secret already exists"
done
echo "  ✅ Secrets created (fill in values below)"

# 6. Prompt for Phoenix credentials
echo ""
echo "📋 Now enter your Phoenix Cloud credentials"
echo "   (Create account at https://app.phoenix.arize.com → Settings → API Keys)"
echo ""
read -rp "   PHOENIX_API_KEY (format px_live_...): " PHOENIX_KEY
read -rp "   PHOENIX_COLLECTOR_ENDPOINT (e.g. https://app.phoenix.arize.com/s/my-space): " PHOENIX_ENDPOINT

echo -n "$PHOENIX_KEY" | gcloud secrets versions add phoenix-api-key --data-file=- --project="$PROJECT_ID"
echo -n "$PHOENIX_ENDPOINT" | gcloud secrets versions add phoenix-collector-endpoint --data-file=- --project="$PROJECT_ID"
echo "  ✅ Phoenix credentials stored"

# 7. Google Custom Search setup instructions
echo ""
echo "🔍 Google Custom Search setup (manual steps):"
echo "   1. Go to https://console.cloud.google.com/apis/credentials?project=$PROJECT_ID"
echo "   2. Create an API Key → restrict it to 'Custom Search API'"
echo "   3. Go to https://programmablesearchengine.google.com → Create a search engine"
echo "      - Search the entire web: ON"
echo "      - Copy the Search engine ID (cx)"
echo "   4. Run these commands with your values:"
echo "      echo -n 'YOUR_API_KEY' | gcloud secrets versions add google-search-api-key --data-file=- --project=$PROJECT_ID"
echo "      echo -n 'YOUR_ENGINE_ID' | gcloud secrets versions add google-search-engine-id --data-file=- --project=$PROJECT_ID"

# 8. Grant Cloud Run SA access to secrets
echo ""
echo "🔑 Granting Cloud Run service account access to secrets..."
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
SA="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

for secret in phoenix-api-key phoenix-collector-endpoint google-search-api-key google-search-engine-id; do
  gcloud secrets add-iam-policy-binding "$secret" \
    --member="$SA" \
    --role="roles/secretmanager.secretAccessor" \
    --project="$PROJECT_ID" >/dev/null
done
echo "  ✅ Secret access granted"

echo ""
echo "✅ GCP setup complete!"
echo ""
echo "Next steps:"
echo "  1. Complete Custom Search setup (see instructions above)"
echo "  2. Verify Vertex AI access: gcloud ai models list --region=$REGION --project=$PROJECT_ID"
echo "  3. Copy agent/.env.example → agent/.env and fill in your values"
echo "  4. cd agent && uv sync && uv run uvicorn main:app --reload"
echo ""
echo "Project: $PROJECT_ID"
echo "Region:  $REGION"
