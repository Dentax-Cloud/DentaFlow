# DentaFlow production backups

PostgreSQL backups run on the **VPS host** (not inside the web container). Dumps are written outside Docker-managed volumes so they survive `docker compose down -v`.

## Paths

| Item | Default |
|------|---------|
| Backup directory | `/opt/DentaFlow/backups/` |
| DB container | `dentaflow-db` |
| Scripts | `/opt/DentaFlow/scripts/backup-db.sh`, `restore-db.sh` |

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

## Restore procedure (disaster recovery drill)

1. **Stop traffic** (optional but recommended):
   ```bash
   cd /opt/DentaFlow
   docker compose -f docker-compose.prod.yml stop web worker
   ```

2. **List backups**:
   ```bash
   ls -lh /opt/DentaFlow/backups/
   ```

3. **Restore** (interactive confirmation required):
   ```bash
   ./scripts/restore-db.sh dentaflow_YYYYMMDD_HHMMSS.sql.gz
   ```
   Type `RESTORE` when prompted.

4. **Restart services**:
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

5. **Smoke test**: log in, open a patient record, confirm recent data matches expectations.

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
export DENTAFLOW_BACKUP_KEEP=14
```
