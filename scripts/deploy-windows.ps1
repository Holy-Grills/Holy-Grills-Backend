$ErrorActionPreference = "Stop"

Write-Host "Starting Holy Grills backend deployment..."

if (-not (Test-Path ".env")) {
  throw "Missing .env file in deployment directory. Create .env before deploying."
}

Write-Host "Installing dependencies with npm ci..."
npm ci

Write-Host "Generating Prisma client..."
npx prisma generate

Write-Host "Building backend..."
npm run build

$pm2Check = pm2 describe holy-grills-backend 2>$null

if ($LASTEXITCODE -eq 0) {
  Write-Host "Restarting existing PM2 process..."
  pm2 restart holy-grills-backend --update-env
} else {
  Write-Host "Starting new PM2 process..."
  pm2 start dist/server.js --name holy-grills-backend --update-env
}

Write-Host "Saving PM2 process list..."
pm2 save

Write-Host "Deployment complete."
pm2 status

