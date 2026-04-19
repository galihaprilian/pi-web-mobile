PORT ?= 5173
PREVIEW_PORT ?= 4173
HOST ?= 0.0.0.0
TAILSCALE_HOST ?= work01.tucuxi-dace.ts.net

PID_DIR ?= .run
DEV_PID_FILE ?= $(PID_DIR)/vite-dev.pid
DEV_LOG_FILE ?= $(PID_DIR)/vite-dev.log
PREVIEW_PID_FILE ?= $(PID_DIR)/vite-preview.pid
PREVIEW_LOG_FILE ?= $(PID_DIR)/vite-preview.log

.PHONY: help install dev dev-network start mobile start-bg restart preview-bg restart-preview stop stop-dev stop-preview logs logs-dev logs-preview status build preview clean urls preview-urls

help:
	@echo "Targets:"
	@echo "  make install      Install dependencies"
	@echo "  make dev          Start Vite on localhost"
	@echo "  make dev-network  Start Vite on all interfaces for LAN/Tailscale access"
	@echo "  make start        Alias for dev-network"
	@echo "  make mobile       Start dev server and print Tailscale URL for mobile"
	@echo "  make start-bg     Start dev server in background"
	@echo "  make preview-bg   Start preview server in background"
	@echo "  make restart      Restart background dev server"
	@echo "  make restart-preview Restart background preview server"
	@echo "  make stop         Stop all background servers"
	@echo "  make stop-dev     Stop background dev server"
	@echo "  make stop-preview Stop background preview server"
	@echo "  make logs         Tail all logs"
	@echo "  make logs-dev     Tail dev server log"
	@echo "  make logs-preview Tail preview server log"
	@echo "  make status       Show background server status"
	@echo "  make build        Build production bundle"
	@echo "  make preview      Preview production build on all interfaces"
	@echo "  make clean        Remove dist"
	@echo "  make urls         Show dev URLs"
	@echo "  make preview-urls Show preview URLs"
	@echo ""
	@echo "Variables:"
	@echo "  PORT=$(PORT)"
	@echo "  HOST=$(HOST)"
	@echo "  PREVIEW_PORT=$(PREVIEW_PORT)"
	@echo "  TAILSCALE_HOST=$(TAILSCALE_HOST)"
	@echo "  DEV_PID_FILE=$(DEV_PID_FILE)"
	@echo "  DEV_LOG_FILE=$(DEV_LOG_FILE)"
	@echo "  PREVIEW_PID_FILE=$(PREVIEW_PID_FILE)"
	@echo "  PREVIEW_LOG_FILE=$(PREVIEW_LOG_FILE)"

install:
	npm install

dev:
	npm run dev -- --host localhost --port $(PORT)

dev-network:
	@echo "Starting dev server for network access..."
	@echo "Local/LAN    : http://localhost:$(PORT)"
	@echo "Tailscale    : http://$(TAILSCALE_HOST):$(PORT)"
	npm run dev -- --host $(HOST) --port $(PORT)

start: dev-network

mobile:
	@echo "Open on mobile: http://$(TAILSCALE_HOST):$(PORT)"
	@$(MAKE) --no-print-directory dev-network

start-bg:
	@mkdir -p $(PID_DIR)
	@if [ -f $(DEV_PID_FILE) ] && kill -0 $$(cat $(DEV_PID_FILE)) 2>/dev/null; then \
		echo "Dev server already running with PID $$(cat $(DEV_PID_FILE))"; \
		echo "URL: http://$(TAILSCALE_HOST):$(PORT)"; \
	else \
		echo "Starting dev server in background..."; \
		nohup npm run dev -- --host $(HOST) --port $(PORT) > $(DEV_LOG_FILE) 2>&1 & echo $$! > $(DEV_PID_FILE); \
		sleep 2; \
		echo "Dev server started with PID $$(cat $(DEV_PID_FILE))"; \
		echo "Log : $(DEV_LOG_FILE)"; \
		echo "URL : http://$(TAILSCALE_HOST):$(PORT)"; \
	fi

restart: stop-dev start-bg

build:
	npm run build

preview:
	@echo "Starting preview server for network access..."
	@echo "Local/LAN    : http://localhost:$(PREVIEW_PORT)"
	@echo "Tailscale    : http://$(TAILSCALE_HOST):$(PREVIEW_PORT)"
	npm run preview -- --host $(HOST) --port $(PREVIEW_PORT)

preview-bg:
	@mkdir -p $(PID_DIR)
	@if [ -f $(PREVIEW_PID_FILE) ] && kill -0 $$(cat $(PREVIEW_PID_FILE)) 2>/dev/null; then \
		echo "Preview server already running with PID $$(cat $(PREVIEW_PID_FILE))"; \
		echo "URL: http://$(TAILSCALE_HOST):$(PREVIEW_PORT)"; \
	else \
		echo "Starting preview server in background..."; \
		nohup npm run preview -- --host $(HOST) --port $(PREVIEW_PORT) > $(PREVIEW_LOG_FILE) 2>&1 & echo $$! > $(PREVIEW_PID_FILE); \
		sleep 2; \
		echo "Preview server started with PID $$(cat $(PREVIEW_PID_FILE))"; \
		echo "Log : $(PREVIEW_LOG_FILE)"; \
		echo "URL : http://$(TAILSCALE_HOST):$(PREVIEW_PORT)"; \
	fi

restart-preview: stop-preview preview-bg

stop: stop-dev stop-preview

stop-dev:
	@if [ -f $(DEV_PID_FILE) ]; then \
		PID=$$(cat $(DEV_PID_FILE)); \
		if kill -0 $$PID 2>/dev/null; then \
			kill $$PID && echo "Stopped dev server (PID $$PID)"; \
		else \
			echo "Dev server PID file exists but process is not running"; \
		fi; \
		rm -f $(DEV_PID_FILE); \
	else \
		echo "Dev server is not running"; \
	fi

stop-preview:
	@if [ -f $(PREVIEW_PID_FILE) ]; then \
		PID=$$(cat $(PREVIEW_PID_FILE)); \
		if kill -0 $$PID 2>/dev/null; then \
			kill $$PID && echo "Stopped preview server (PID $$PID)"; \
		else \
			echo "Preview server PID file exists but process is not running"; \
		fi; \
		rm -f $(PREVIEW_PID_FILE); \
	else \
		echo "Preview server is not running"; \
	fi

logs: logs-dev

logs-dev:
	@mkdir -p $(PID_DIR)
	@touch $(DEV_LOG_FILE)
	tail -f $(DEV_LOG_FILE)

logs-preview:
	@mkdir -p $(PID_DIR)
	@touch $(PREVIEW_LOG_FILE)
	tail -f $(PREVIEW_LOG_FILE)

status:
	@mkdir -p $(PID_DIR)
	@if [ -f $(DEV_PID_FILE) ] && kill -0 $$(cat $(DEV_PID_FILE)) 2>/dev/null; then \
		echo "Dev     : RUNNING (PID $$(cat $(DEV_PID_FILE))) http://$(TAILSCALE_HOST):$(PORT)"; \
	else \
		echo "Dev     : STOPPED"; \
	fi
	@if [ -f $(PREVIEW_PID_FILE) ] && kill -0 $$(cat $(PREVIEW_PID_FILE)) 2>/dev/null; then \
		echo "Preview : RUNNING (PID $$(cat $(PREVIEW_PID_FILE))) http://$(TAILSCALE_HOST):$(PREVIEW_PORT)"; \
	else \
		echo "Preview : STOPPED"; \
	fi

clean:
	rm -rf dist $(PID_DIR)

urls:
	@echo "Dev local    : http://localhost:$(PORT)"
	@echo "Dev tailscale: http://$(TAILSCALE_HOST):$(PORT)"

preview-urls:
	@echo "Preview local    : http://localhost:$(PREVIEW_PORT)"
	@echo "Preview tailscale: http://$(TAILSCALE_HOST):$(PREVIEW_PORT)"
