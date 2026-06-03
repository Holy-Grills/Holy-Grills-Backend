$ErrorActionPreference = "Stop"

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Label,

    [Parameter(Mandatory = $true)]
    [scriptblock]$Command
  )

  Write-Host $Label
  & $Command

  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE"
  }
}

Write-Host "Starting Holy Grills backend deployment..."

if (-not (Test-Path ".env")) {
  throw "Missing .env file in deployment directory. Create .env before deploying."
}

Invoke-Checked "Installing dependencies with npm ci..." {
  npm ci --include=dev
}

Invoke-Checked "Generating Prisma client..." {
  npm run prisma:generate
}

Invoke-Checked "Building backend..." {
  npm run build
}

$pm2Check = pm2 describe holy-grills-backend 2>$null

if ($LASTEXITCODE -eq 0) {
  Invoke-Checked "Restarting existing PM2 process..." {
    pm2 restart holy-grills-backend --update-env
  }
} else {
  Invoke-Checked "Starting new PM2 process..." {
    pm2 start dist/server.js --name holy-grills-backend --update-env
  }
}

Invoke-Checked "Saving PM2 process list..." {
  pm2 save
}

Write-Host "Deployment complete."
pm2 status
