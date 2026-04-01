.PHONY: up down logs build test dev clean restart status

# Start all services in detached mode
up:
	docker compose up -d

# Stop all services
down:
	docker compose down

# Follow logs from all services
logs:
	docker compose logs -f

# Build (or rebuild) all images
build:
	docker compose build

# Run all UAT suites
test:
	cd mk12-uat && npm test

# Start all services locally without Docker
dev:
	bash scripts/dev.sh

# Stop services and remove volumes (full reset)
clean:
	docker compose down -v

# Restart all services
restart:
	docker compose restart

# Show status of all services
status:
	docker compose ps
