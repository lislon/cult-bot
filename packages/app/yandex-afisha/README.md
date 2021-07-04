# Afisha Parser

## Install on heroku

```
$app = "cult-hub-yandex-afisha-dev"

heroku create $app
heroku addons:create -a $app heroku-postgresql:hobby-dev
heroku pg:credentials:url -a $app DATABASE
heroku labs:enable runtime-dyno-metadata -a $app
heroku buildpacks:add heroku/nodejs -a $app
heroku buildpacks:add "https://github.com/blockhq/heroku-buildpack-yarn-workspaces#master" -a $app
heroku addons:create heroku-redis:hobby-dev -a $app
heroku addons:create scheduler -a $app
heroku addons:create mailgun:starter --region=eu -a $app
```

Only for build env:
```
heroku config:set NPM_CONFIG_PRODUCTION=true YARN_PRODUCTION=true  -a $app
```

Add env settings:
```
PROCFILE=packages/app/yandex-afisha/Procfile
DATABASE_SSL=yes
JSON_SNAPSHOT_DIR=/tmp/afisha
NODE_ENV=production

heroku config:set NODE_ENV=production -a $app
heroku config:set JSON_SNAPSHOT_DIR=/tmp/afisha -a $app
heroku config:set DATABASE_SSL=yes -a $app

```


Add cron jobs:

12:00 AM UTC = 15:00 MSK
06:00 AM UTC = 09:00 MSK
```
#Monday
[ "$(date +%u)" = 1 ] && yarn cron:parse-base
#Thuesday
[ "$(date +%u)" = 4 ] && yarn cron:parse-diff
```

## Start

```
parse:orig
```

### Run remote

```
$app = "cult-hub-yandex-afisha-dev"
heroku run DEBUG=\* yarn cron:parse-diff --app=$app
heroku run DEBUG=\* yarn cron:parse-diff -n 2021-05-01 --app=$app
heroku run DEBUG=\* yarn cron:parse-diff -d 2021-05-01 2021-05-02 --app=$app
```