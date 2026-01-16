doctor:
	@test -f .env || (echo "Missing .env (copy from .env.TEMPLATE)" && exit 1)
	@docker compose config >/dev/null
	@echo "OK"
