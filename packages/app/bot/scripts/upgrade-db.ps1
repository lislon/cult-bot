# .\packages\bot\scripts\upgrade-db.ps1
#$plan=hobby-dev 0$
#$plan="hobby-basic" 9$
$plan="hobby-basic"
$app="cult-hub-bot-uat"

$ErrorActionPreference = "Stop"
# Part1
#heroku pg:backups:capture --app $app
#heroku addons:create heroku-postgresql:$plan --app $app
#heroku pg:wait --app $app

# Created postgresql-flexible-85900 as HEROKU_POSTGRESQL_SILVER_URL
# $app = "?"
$newDb="HEROKU_POSTGRESQL_PUCE_URL"

heroku ps:scale web=0 --app $app
heroku maintenance:on --app $app
heroku pg:copy DATABASE_URL $newDb --confirm $app --app $app
heroku pg:promote $newDb --app $app
heroku addons:detach $newDb --app $app
heroku ps:scale web=1 --app $app
heroku maintenance:off --app $app
heroku pg:info --app $app
heroku pg:credentials:url --app $app DATABASE

$alternateUrlForExistingDb="???"
##heroku addons:destroy HEROKU_POSTGRESQL_WHITE_URL --confirm $app --app $app
