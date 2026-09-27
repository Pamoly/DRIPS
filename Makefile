# DRIPS — common tasks. `make help` lists them.
.DEFAULT_GOAL := help
.PHONY: help run dev analyze test test-journey build rules typecheck reset clean

help: ## show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

run: ## start the engine with the built UI on :8000
	python3 -m backend.app.server --port 8000

dev: ## start the engine and the Vite dev server (hot reload)
	./start.sh --dev

analyze: ## print the health of every file in the workspace
	python3 -m backend.app.server --status

build: ## type-check and build the editor UI
	cd frontend && npm run build

typecheck: ## type-check the frontend without building
	cd frontend && npm run typecheck

rules: ## regenerate docs/RULES.md from the rule catalog
	python3 scripts/generate_rule_reference.py

test: ## unit tests (no server required)
	python3 -m unittest discover -s tests

test-journey: ## end-to-end journey test against a running engine
	python3 tests/test_journey.py

reset: ## wipe the saved workspace so the samples are restored
	rm -f backend/data/workspace.json && echo "workspace reset"

clean: ## remove build output and caches
	rm -rf frontend/dist backend/data/workspace.json
	find . -name __pycache__ -type d -prune -exec rm -rf {} +
