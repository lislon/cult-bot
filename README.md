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

### Add new heroku env:
```
heroku create <app name>
heroku addons:create -a <app name> heroku-postgresql:hobby-dev
heroku pg:credentials:url -a <app name> DATABASE
heroku labs:enable runtime-dyno-metadata -a <app name>
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