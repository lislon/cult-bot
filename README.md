## Sync

Envs:
    - `cult-hub-bot-dev`
    - `cult-hub-bot-uat`

To load latest version from excel
```
heroku run npm run db:sync
```

Show all env vars:
```
heroku config -a cult-hub-bot-dev
```


# Database

Get URL connection for local:
```
heroku pg:credentials:url DATABASE
```