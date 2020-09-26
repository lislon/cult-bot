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

### Db migrtaions

`db-migrate` uses `DATABASE_URL` env for migrations.

Fix db on remote:
```
heroku run npm run db:down
heroku run npm run db:up
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
