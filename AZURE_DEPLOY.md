# 🚀 Azure Deployment Guide – Amy Assistant

## Architecture on Azure

```
Internet → Azure Container Apps (Amy)
                    ↓
           Azure Cosmos DB for MongoDB  (or MongoDB Atlas)
```

---

## Option A: Azure Container Apps (Recommended)

### 1. Build & push image to Azure Container Registry (ACR)

```bash
# Login
az login
az acr login --name <your-acr-name>

# Build and push
docker build -t <your-acr-name>.azurecr.io/amy-assistant:latest .
docker push <your-acr-name>.azurecr.io/amy-assistant:latest
```

### 2. Create Container App

```bash
az containerapp create \
  --name amy-assistant \
  --resource-group <your-rg> \
  --environment <your-env> \
  --image <your-acr-name>.azurecr.io/amy-assistant:latest \
  --target-port 3000 \
  --ingress external \
  --env-vars \
    NODE_ENV=production \
    PORT=3000 \
    OPENAI_API_KEY=secretref:openai-key \
    MONGO_URI=secretref:mongo-uri \
    MONGO_DB_NAME=amy_assistant \
    CALENDAR_ID=<your-calendar-id> \
    EMAIL_USER=<your-email> \
    EMAIL_PASS=secretref:email-pass
```

### 3. Add secrets

```bash
az containerapp secret set \
  --name amy-assistant \
  --resource-group <your-rg> \
  --secrets \
    openai-key=<your-openai-key> \
    mongo-uri=<your-cosmos-connection-string> \
    email-pass=<your-gmail-app-password>
```

---

## Option B: Azure Container Instances (ACI) — Simpler

```bash
az container create \
  --resource-group <your-rg> \
  --name amy-assistant \
  --image <your-acr-name>.azurecr.io/amy-assistant:latest \
  --ports 3000 \
  --environment-variables \
    NODE_ENV=production PORT=3000 \
    MONGO_DB_NAME=amy_assistant \
    CALENDAR_ID=<id> EMAIL_USER=<email> \
  --secure-environment-variables \
    OPENAI_API_KEY=<key> \
    MONGO_URI=<cosmos-connection-string> \
    EMAIL_PASS=<pass>
```

---

## MongoDB on Azure

### Azure Cosmos DB for MongoDB

1. Create resource: **Azure Cosmos DB → Azure Cosmos DB for MongoDB**
2. Copy the connection string from **Settings → Connection strings**
3. Use as `MONGO_URI` — it looks like:
   ```
   mongodb+srv://<user>:<pass>@<account>.mongocluster.cosmos.azure.com/?tls=true&...
   ```

---

## Local Development with Docker Compose

```bash
# 1. Copy env file
cp .env.example .env
# Fill in your keys

# 2. Start everything (app + MongoDB + Mongo Express UI)
docker-compose up --build

# App:           http://localhost:3000
# MongoDB UI:    http://localhost:8081  (admin / admin123)

# 3. Stop
docker-compose down
```

---

## Environment Variables Reference

| Variable        | Required | Description                          |
|----------------|----------|--------------------------------------|
| PORT            | Yes      | Server port (default: 3000)          |
| OPENAI_API_KEY  | Yes      | Your OpenAI API key                  |
| MONGO_URI       | Yes      | MongoDB connection string            |
| MONGO_DB_NAME   | No       | Database name (default: amy_assistant)|
| CALENDAR_ID     | Yes      | Google Calendar ID                   |
| EMAIL_USER      | Yes      | Gmail address for confirmations      |
| EMAIL_PASS      | Yes      | Gmail App Password                   |
