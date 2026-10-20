# =============================================================================
#  Godswar Pit - Veroeffentlichen auf GitHub Pages
# =============================================================================
#  So startest du es:
#    1. Doppelklick auf "deploy.bat"  (bzw. "publish.ps1" mit Rechtsklick
#       -> "Mit PowerShell ausfuehren")
#    2. Beantworte die zwei Fragen
#    3. Wenn sich ein Browserfenster mit GitHub oeffnet: dort einfach
#       "Authorize" anklicken
#    4. Fertig. Die Adresse des Spiels steht am Ende.
# =============================================================================

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Kopf($text) {
    Write-Host ""
    Write-Host "=== $text ===" -ForegroundColor Yellow
    Write-Host ""
}

Kopf "Godswar Pit veröffentlichen"

$user = Read-Host "Dein GitHub-Benutzername (der Name in deinem Profil, z. B. georg)"
if ([string]::IsNullOrWhiteSpace($user)) {
    Write-Host "Abgebrochen - es wurde nichts veraendert." -ForegroundColor Red
    exit 1
}
$user = $user.Trim()

$repo = Read-Host "Name des Repositorys (Enter = godswar-pit)"
if ([string]::IsNullOrWhiteSpace($repo)) { $repo = "godswar-pit" }
$repo = $repo.Trim()

$api = "https://api.github.com/repos/$user/$repo"
Write-Host ""
Write-Host "Ich pruefe, ob das Repository $user/$repo existiert ..."

$private = $false
$exists = $false
try {
    $response = Invoke-RestMethod -Uri $api -TimeoutSec 20
    $exists = $true
    $private = [bool]$response.private
    Write-Host "Repository gefunden." -ForegroundColor Green
    if ($private) {
        Write-Host ""
        Write-Host "ACHTUNG: Das Repository ist PRIVAT. GitHub Pages gibt es im" -ForegroundColor Yellow
        Write-Host "kostenlosen Account nur fuer oeffentliche Repositories." -ForegroundColor Yellow
        Write-Host "Bitte auf der Repository-Seite auf 'Settings' klicken, ganz unten" -ForegroundColor Yellow
        Write-Host "'Danger Zone' -> 'Change visibility' -> 'Make public'." -ForegroundColor Yellow
        Write-Host ""
    }
} catch {
    $exists = $false
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -eq 404) {
        Write-Host "Repository gibt es NOCH NICHT." -ForegroundColor Yellow
    } else {
        Write-Host "Verbindung zu GitHub nicht moeglich. Bitte Internet pruefen." -ForegroundColor Red
    }
}

if (-not $exists) {
    Write-Host ""
    Write-Host "Bitte jetzt im Browser oeffnen:  https://github.com/new" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Repository name :  $repo"
    Write-Host "  Description     :  Godswar Pit - an idle roguelike"
    Write-Host "  Public          :  PUBLIC ANKREUZEN  (wichtig, sonst keine Pages)"
    Write-Host "  README/gitrepo  :  KEINEN Haken setzen, keine Datei waehlen"
    Write-Host ""
    Write-Host "Dann auf 'Create repository' klicken."
    Write-Host ""
    $answer = Read-Host "Sobald das Repository angelegt ist: Enter druecken (oder 'q' zum Abbrechen)"
    if ($answer -eq "q") {
        Write-Host "Abgebrochen." -ForegroundColor Red
        exit 1
    }
    try {
        Invoke-RestMethod -Uri $api -TimeoutSec 20 | Out-Null
        Write-Host "Repository gefunden." -ForegroundColor Green
    } catch {
        Write-Host "Repository ist immer noch nicht da. Bitte erneut ausfuehren." -ForegroundColor Red
        exit 1
    }
}

Kopf "Hochladen"

$remote = "https://github.com/$user/$repo.git"
# "git remote" ohne Argument listet nur die vorhandenen Remotes und wirft
# deshalb keinen Fehler, wenn es noch keinen gibt.
$remotes = @((git remote) | Where-Object { $_ })
if ($remotes -contains "origin") {
    git remote set-url origin $remote
    Write-Host "Remote aktualisiert: $remote"
} else {
    git remote add origin $remote
    Write-Host "Remote gesetzt: $remote"
}

# Beim Push oeffnet sich ein Browserfenster, dort mit "Authorize" bestaetigen.
git config --local credential.helper manager

Write-Host "Lade jetzt den Code hoch. Es kann ein Browserfenster mit GitHub aufgehen - dort auf 'Authorize' klicken."
Write-Host ""

git push -u origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Hochladen fehlgeschlagen." -ForegroundColor Red
    Write-Host "Bitte die Fehlermeldung oben lesen und es erneut versuchen."
    exit 1
}

Kopf "Fast geschafft"

$page = "https://$user.github.io/$repo/"
Write-Host "1. Oeffne diese Seite:   https://github.com/$user/$repo/settings/pages" -ForegroundColor Cyan
Write-Host "2. Waehle bei 'Build and deployment' -> 'Source': GitHub Actions" -ForegroundColor Cyan
Write-Host "   (Falls 'GitHub Actions' noch nicht zur Auswahl steht: Seite neu laden," -ForegroundColor Cyan
Write-Host "    das Hochladen hat die Pages-Einstellung schon selbst gesetzt.)" -ForegroundColor Cyan
Write-Host "3. Klicke 'Save'." -ForegroundColor Cyan
Write-Host ""
Write-Host "Der Upload laeuft dann automatisch. Das Spiel ist danach hier online:"
Write-Host "   $page" -ForegroundColor Green
Write-Host ""
Write-Host "(Dauert beim ersten Mal 1-3 Minuten.)"
Write-Host ""
Read-Host "Enter druecken zum Beenden"
