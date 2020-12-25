
## Debug

debug `npm dev` with `-r dotenv/config` node options. 

## Testing

1. Copy `.env.example` to  `.env` and verify you can connect to test database by this URL:
    ```
    TEST_DATABASE_URL=postgres://cult-test:cult-test@localhost:5434/cult-test
    ```
2. Run migrations for test DB `npm run db:up-test`
3. Run tests `npm run test`

#### Run only cucumber

Run tests `npm run test-cucumber`

Or single test `npm run test-cucumber -- --name "Regex"`


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


rdcli -h ec2-52-31-207-5.eu-west-1.compute.amazonaws.com -p 12729 -c p450a8f512bd92a3aa3836bb5ab9d8398e37fef2894a85684bb4d358b62eeca61

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

Use values for SUPPORT_FEEDBACK_CHAT_ID:

* DEV: -1001435463713
* UAT: -464597039
* PROD: -358666254

Add this variable to dev to speed up heroku build:
```
heroku config:set NPM_CONFIG_PRODUCTION=true YARN_PRODUCTION=true
```

### Backup
```
heroku pg:backups -a cult-hub-bot-<env>
heroku pg:backups:capture -a cult-hub-bot-<env>
```

### Release
```
heroku pg:backups:capture -a cult-hub-bot-<env>
```

### Rollback to previous release

#### Option A: With restoration of database (Easy, new data will be lost)

```
heroku releases:rollback -a cult-hub-bot-<env>
heroku pg:backups:restore -a cult-hub-bot-<env>
```

#### Option B: With restoration with rollback (Harder, data will be saved)
```
heroku releases:rollback -a cult-hub-bot-<env>
heroku run -- yarn db:down -a cult-hub-bot-<env>
```

heroku container:run web bash


### Cron setup
```
heroku addons:create scheduler:standard -a cult-hub-bot-dev
heroku addons:open scheduler -a cult-hub-bot-dev
```
 - Add cron job `npm run cron:refresh-events` `everyday` at `03:00 UTC`. 
   This job will rotate random events order in cb_events to allow consistent paging. Also it will update timetable for recurrent events

### Db migrations

`db-migrate` uses `DATABASE_URL` env for migrations.

Fix db on remote:
```
heroku run npm run db:down
heroku run npm run db:up
``` 

Create new migration:
```
db-migrate create <name-of-migration>
```

### Troubleshooting

```
heroku pg:diagnose -a cult-hub-bot-prod
```


### Tests:

1. Run `cd .jest && composer up -v`
2. Run `npm run db:up-test`
3. Run `npm run test` or `npx jest` (will be faster)

### Restart app
```
heroku scale web=0 -a cult-hub-bot-dev
heroku scale web=1 -a cult-hub-bot-dev

```
### Backups

https://devcenter.heroku.com/articles/heroku-postgres-backups#scheduling-backups

```
heroku pg:credentials:url -a <app name> DATABASE
heroku pg:backups:schedule DATABASE_URL --at '02:00 Europe/Moscow' --app cult-hub-bot-dev
```

## Quick run:

```
import { config } from 'dotenv'

config()
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
import { db, pgp } from '../database/db'
import { EventsSyncRepository } from '../database/db-sync-repository'
import { DbEvent } from '../interfaces/db-interfaces'


(async function run() {

    try {

    } finally {
        pgp.end()
    }


})()
```

In IDEA:

- node type:
- file: `ts-node.cmd`
- args: `--transpile-only`
- path to ts script