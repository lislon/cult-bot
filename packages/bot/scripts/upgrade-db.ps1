#$plan=hobby-dev 0$
#$plan="hobby-basic" 9$
$plan="hobby-dev"
$app="cult-hub-bot-dev"

$ErrorActionPreference = "Stop"
heroku pg:info --app $app
heroku addons:create heroku-postgresql:$plan --app $app
heroku pg:wait --app $app
# Created postgresql-flexible-85900 as HEROKU_POSTGRESQL_SILVER_URL
# $app = "?"
$newDb="HEROKU_POSTGRESQL_ONYX_URL"
$oldDb="HEROKU_POSTGRESQL_SILVER_URL"

heroku pg:backups:capture --app $app
heroku ps:scale web=0
heroku maintenance:on
heroku pg:copy DATABASE_URL $newDb --confirm $app --app $app
heroku pg:promote $newDb --app $app
heroku addons:detach $newDb --app $app
heroku ps:scale web=1 --app $app
heroku maintenance:off --app $app
heroku pg:info --app $app
heroku addons:destroy $oldDb --confirm $app --app $app
