## Debug

debug `npm dev` with `-r dotenv/config` node options. 

## Testing

1. Copy `.env.example` to  `.env` and verify you can connect to test database by this URL:
    ```
    TEST_DATABASE_URL=postgres://cult-test:cult-test@localhost:5434/cult-test
    ```
2. Run migrations for test DB `npm run db:up-test`
3. Run tests `npm run test`


## Sync

Envs:
    - `cult-hub-bot-dev`
    - `cult-hub-bot-uat`

To load latest version from excel
```
heroku run npm run db:sync
```

\<app name\>:
- cult-hub-bot-dev
- cult-hub-bot-uat
- cult-hub-bot-prod

Show all env vars:
```
heroku config -a <app name>
```

### New app :
```
heroku create <app name>
heroku addons:create -a <app name> heroku-postgresql:hobby-dev
heroku pg:credentials:url -a <app name> DATABASE
heroku labs:enable runtime-dyno-metadata -a <app name>
heroku addons:create heroku-redis:hobby-dev -a <app name>
```

Configure ENV:
```
GOOGLE_DOCS_ID = ??
TELEGRAM_TOKEN = ??
NODE_ENV = production
WEBHOOK_PORT = 443
```

This env vars will be configured automatically:
```
REDIS_URL
DATABASE_URL
```

### Backup
```
heroku pg:backup -a <app name>
```

### Rollback to previous release
```
heroku releases:rollback -a <app name> 
```

### Cron setup
```
heroku addons:create scheduler:standard -a cult-hub-bot-dev
heroku addons:open scheduler -a cult-hub-bot-dev
```
 - Add cron job `npm run cron:shuffle-events` `everyday` at `03:00 UTC`. This job will rotate random events order in cb_events to allow consistent paging.

### Db migrations

`db-migrate` uses `DATABASE_URL` env for migrations.

Fix db on remote:
```
heroku run npm run db:down
heroku run npm run db:up
``` 

Create new migraton:
```
db-migrate create <name-of-migration>
```

### Tests:

1. Run `cd .jest && composer up -v`
2. Run `npm run db:up-test`
3. Run `npm run test` or `npx jest` (will be faster)

### Restart app
```
heroku -a cult-hub-bot-dev scale web:0
heroku -a cult-hub-bot-dev scale web:1

```
### Backups

https://devcenter.heroku.com/articles/heroku-postgres-backups#scheduling-backups

```
heroku pg:credentials:url -a <app name> DATABASE
heroku pg:backups:schedule DATABASE_URL --at '02:00 Europe/Moscow' --app cult-hub-bot-dev
```