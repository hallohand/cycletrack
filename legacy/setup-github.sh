#!/bin/bash
# NancyCycle GitHub Setup Helper

echo "🌸 NancyCycle GitHub Setup"
echo "=========================="
echo ""

# Prüfe ob Git installiert ist
if ! command -v git &> /dev/null; then
    echo "❌ Git ist nicht installiert. Installiere..."
    sudo apt-get update && sudo apt-get install -y git
fi

# Git konfigurieren (nur falls nicht vorhanden)
if [ -z "$(git config --global user.email)" ]; then
    echo "📧 Bitte gib deine E-Mail-Adresse für Git ein:"
    read git_email
    git config --global user.email "$git_email"
fi

if [ -z "$(git config --global user.name)" ]; then
    echo "👤 Bitte gib deinen Namen für Git ein:"
    read git_name
    git config --global user.name "$git_name"
fi

# In das Projektverzeichnis wechseln
cd /root/.openclaw/workspace/nancycycle

# Git initialisieren
echo "📁 Initialisiere Git..."
git init

# Alle Dateien hinzufügen
git add .

# Ersten Commit erstellen
git commit -m "Initial commit: NancyCycle Zyklus-Tracker"

echo ""
echo "✅ Lokal erledigt!"
echo ""
echo "🔐 Nächster Schritt: GitHub Token erstellen"
echo ""
echo "1. Gehe zu: https://github.com/settings/tokens/new"
echo "2. Gib einen Namen ein (z.B. 'NancyCycle')"
echo "3. Wähle 'repo' aus (für private Repositories)"
echo "4. Klicke 'Generate token'"
echo "5. Kopiere den Token (wird nur einmal angezeigt!)"
echo ""
echo "6. Dann führe diese Befehle aus:"
echo ""
echo "   git remote add origin https://github.com/DEIN_USERNAME/nancycycle.git"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "Beim 'git push' wirst du nach Username und Password gefragt."
echo "Als Password nutzt du das Token!"
echo ""
echo "Danach aktiviere GitHub Pages unter:"
echo "https://github.com/DEIN_USERNAME/nancycycle/settings/pages"
echo ""
read -p "Enter drücken zum Beenden..."