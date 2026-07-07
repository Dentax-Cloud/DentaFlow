# DentaFlow production backups

PostgreSQL backups run on the **VPS host** (not inside the web container). Dumps are written outside Docker-managed volumes so they survive `docker compose down -v`.

Backups are created with `pg_dump --clean --if-exists` so a restore can drop and recreate objects safely. Restores use `psql -v ON_ERROR_STOP=1` and **halt on the first error** instead of continuing with ambiguous partial results.

## Paths

| Item | Default |
|------|---------|
| Backup directory | `/opt/DentaFlow/backups/` |
| DB container | `dentaflow-db` |
| Scripts | `/opt/DentaFlow/scripts/backup-db.sh`, `restore-db.sh` |
| Test restore DB | `dentaflow_restore_test` |

## Manual backup

```bash
cd /opt/DentaFlow
chmod +x scripts/backup-db.sh scripts/restore-db.sh
./scripts/backup-db.sh
```

Confirm a new `dentaflow_YYYYMMDD_HHMMSS.sql.gz` file appears in `/opt/DentaFlow/backups/`.

## Automated daily backup (2:00 AM server time)

Add to root's crontab (`sudo crontab -e`):

```cron
0 2 * * * /opt/DentaFlow/scripts/backup-db.sh >> /var/log/dentaflow-backup.log 2>&1
```

Verify cron is active:

```bash
sudo crontab -l | grep backup-db
```

## Restore drill (RECOMMENDED — safe test mode)

Use `--test` to restore into a **temporary database** (`dentaflow_restore_test`). This never touches the live `dentaflow` database.

```bash
cd /opt/DentaFlow
./scripts/backup-db.sh
./scripts/restore-db.sh dentaflow_YYYYMMDD_HHMMSS.sql.gz --test
```

A successful drill:

- Completes with **zero psql errors** (script exits non-zero on first failure)
- Reports matching row counts for key tables (`Tenant`, `Patient`, `auth_users`, `Appointment`, `Invoice`)

Inspect the temp database if needed:

```bash
docker exec -it dentaflow-db psql -U dentaflow -d dentaflow_restore_test
```

Drop the temp database when finished:

```bash
docker exec dentaflow-db psql -U dentaflow -d postgres -c 'DROP DATABASE "dentaflow_restore_test";'
```

## Live restore (HIGH RISK — maintenance window only)

Only after `--test` passes cleanly:

1. **Stop traffic**:
   ```bash
   docker compose -f docker-compose.prod.yml stop web worker
   ```

2. **Restore into live database** (requires typing `RESTORE LIVE`):
   ```bash
   ./scripts/restore-db.sh dentaflow_YYYYMMDD_HHMMSS.sql.gz --live
   ```

3. **Restart services**:
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

4. **Smoke test**: log in, open a patient record, confirm data matches expectations.

## Health check after restore

```bash
curl -fsS https://dentax.cloud/api/health
# {"status":"ok","checks":{"database":"ok"}}
```

## Retention

`backup-db.sh` keeps the **14 most recent** gzip dumps and deletes older files automatically.

## Environment overrides

```bash
export DENTAFLOW_BACKUP_DIR=/opt/DentaFlow/backups
export DENTAFLOW_DB_CONTAINER=dentaflow-db
export POSTGRES_USER=dentaflow
export POSTGRES_DB=dentaflow
export DENTAFLOW_TEST_DB=dentaflow_restore_test
export DENTAFLOW_BACKUP_KEEP=14
```
