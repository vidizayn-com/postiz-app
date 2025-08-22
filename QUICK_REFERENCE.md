# Postiz Docker Quick Reference

## 🚀 Quick Start

```bash
# Automated setup (recommended)
./setup-postiz.sh

# Or with help
./setup-postiz.sh --help

# Cleanup everything
./setup-postiz.sh --cleanup
```

## 📋 Access URLs

- **Frontend**: http://localhost:4200
- **Backend API**: http://localhost:3000  
- **pgAdmin**: http://localhost:8081 (admin@admin.com / admin)
- **RedisInsight**: http://localhost:5540

## 🔧 Manual Commands

### Infrastructure Services
```bash
# Start infrastructure (PostgreSQL, Redis, etc.)
docker-compose -f docker-compose.dev.yaml up -d

# Stop infrastructure
docker-compose -f docker-compose.dev.yaml down

# Check running services
docker ps
```

### Application
```bash
# Build application image
docker build -t localhost/postiz -f Dockerfile.dev .

# Run application (after infrastructure is running)
docker run --rm -p 3000:3000 -p 4200:4200 \
  --network postiz-app_postiz-network \
  --env-file .env \
  localhost/postiz
```

### Development Workflow
```bash
# 1. Make code changes
# 2. Rebuild image
docker build -t localhost/postiz -f Dockerfile.dev .

# 3. Restart application
# Stop current container (Ctrl+C) and run again
```

## 🛠️ Troubleshooting

### Check Container Status
```bash
# List all containers
docker ps -a

# Check specific container logs
docker logs <container-name>

# Check infrastructure services
docker-compose -f docker-compose.dev.yaml ps
```

### Common Issues
```bash
# Port conflicts - kill processes using ports
sudo lsof -ti:3000 | xargs kill -9
sudo lsof -ti:4200 | xargs kill -9

# Clean Docker cache
docker system prune -a

# Restart Docker daemon
sudo systemctl restart docker
```

### Database Issues
```bash
# Connect to PostgreSQL directly
docker exec -it postiz-postgres psql -U postiz-local -d postiz-db-local

# Reset database
docker-compose -f docker-compose.dev.yaml down -v
docker-compose -f docker-compose.dev.yaml up -d
```

## 📁 Project Structure

```
postiz-app/
├── apps/
│   ├── backend/     # NestJS API server
│   ├── frontend/    # Next.js web app
│   ├── workers/     # Background jobs
│   ├── cron/        # Scheduled tasks
│   └── ...
├── libraries/       # Shared libraries
├── docker-compose.dev.yaml
├── Dockerfile.dev
├── .env.example
├── setup-postiz.sh  # Automated setup script
└── DOCKER_SETUP_GUIDE.md
```

## 🔑 Environment Variables

Key variables in `.env`:
```bash
DATABASE_URL="postgresql://postiz-local:postiz-local-pwd@postiz-postgres:5432/postiz-db-local"
REDIS_URL="redis://postiz-redis:6379"
JWT_SECRET="your-secret-here"
FRONTEND_URL="http://localhost:4200"
NEXT_PUBLIC_BACKEND_URL="http://localhost:3000"
STORAGE_PROVIDER="local"
IS_GENERAL="true"
```

## 🎯 Development Tips

1. **Hot Reload**: Code changes require image rebuild
2. **Logs**: Use `docker logs <container>` to debug
3. **Database**: Access via pgAdmin at port 8081
4. **Redis**: Monitor via RedisInsight at port 5540
5. **API**: Test endpoints at http://localhost:3000

## 📞 Support

- **Documentation**: http://docs.postiz.com
- **GitHub**: https://github.com/gitroomhq/postiz-app
- **Discord**: https://discord.postiz.com
