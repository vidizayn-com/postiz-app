# Postiz Docker Setup Guide

This guide provides step-by-step instructions to build and run the Postiz application using Docker.

## Prerequisites

- Docker installed and running
- Docker Compose installed
- Git (to clone the repository)

## Quick Setup (Automated)

Run the automated setup script:

```bash
chmod +x setup-postiz.sh
./setup-postiz.sh
```

## Manual Setup Steps

### 1. Environment Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

**Important Environment Variables:**
- `DATABASE_URL`: Use `postgresql://postiz-local:postiz-local-pwd@postiz-postgres:5432/postiz-db-local`
- `REDIS_URL`: Use `redis://postiz-redis:6379`
- `JWT_SECRET`: Set a secure random string
- `FRONTEND_URL`: `http://localhost:4200`
- `NEXT_PUBLIC_BACKEND_URL`: `http://localhost:3000`
- `BACKEND_INTERNAL_URL`: `http://localhost:3000`
- `STORAGE_PROVIDER`: `local`
- `IS_GENERAL`: `true`

### 2. Start Infrastructure Services

Start PostgreSQL, Redis, and admin tools:

```bash
docker-compose -f docker-compose.dev.yaml up -d
```

This starts:
- PostgreSQL database (port 5432)
- Redis cache (port 6379)
- pgAdmin (port 8081)
- RedisInsight (port 5540)

### 3. Build the Application Docker Image

```bash
docker build -t localhost/postiz -f Dockerfile.dev .
```

### 4. Run the Application

```bash
docker run --rm -p 3000:3000 -p 4200:4200 \
  --network postiz-app_postiz-network \
  -e DATABASE_URL="postgresql://postiz-local:postiz-local-pwd@postiz-postgres:5432/postiz-db-local" \
  -e REDIS_URL="redis://postiz-redis:6379" \
  -e JWT_SECRET="random-jwt-secret-for-development-only" \
  -e FRONTEND_URL="http://localhost:4200" \
  -e NEXT_PUBLIC_BACKEND_URL="http://localhost:3000" \
  -e BACKEND_INTERNAL_URL="http://localhost:3000" \
  -e STORAGE_PROVIDER="local" \
  -e IS_GENERAL="true" \
  localhost/postiz
```

## Access URLs

Once running, access these services:

- **Postiz Frontend**: http://localhost:4200
- **Backend API**: http://localhost:3000
- **pgAdmin**: http://localhost:8081 (admin@admin.com / admin)
- **RedisInsight**: http://localhost:5540

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Ensure infrastructure services are running: `docker ps`
   - Check network connectivity between containers

2. **Port Already in Use**
   - Stop conflicting services or change ports in docker-compose.dev.yaml

3. **Build Failures**
   - Ensure you have enough disk space (image is ~5GB)
   - Clear Docker cache: `docker system prune -a`

### Useful Commands

```bash
# Check running containers
docker ps

# View application logs
docker logs <container-id>

# Stop all services
docker-compose -f docker-compose.dev.yaml down

# Rebuild without cache
docker build --no-cache -t localhost/postiz -f Dockerfile.dev .

# Clean up Docker resources
docker system prune -a
```

## Development Workflow

1. **Make code changes** in your local files
2. **Rebuild the Docker image** when needed
3. **Restart the application container**
4. **Test your changes** at http://localhost:4200

## Services Architecture

- **Frontend (Next.js)**: Port 4200 - User interface
- **Backend (NestJS)**: Port 3000 - API server
- **Workers**: Background job processing
- **Cron**: Scheduled tasks
- **PostgreSQL**: Database storage
- **Redis**: Caching and job queues

## Next Steps

- Configure social media API keys in `.env`
- Set up Cloudflare for file storage (optional)
- Configure email service with Resend (optional)
- Add payment processing with Stripe (optional)

For more configuration options, see: http://docs.postiz.com/configuration/reference
