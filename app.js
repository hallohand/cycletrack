// CycleTrack - Zyklus Tracker App v1.1.3 (Debug)

const STORAGE_KEY = 'cycletrack_data';

let currentData = loadData();
let currentChart = null;
let currentMonth = new Date();

function loadData() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        return JSON.parse(stored);
    }
    return {
        entries: {},
        cycleLength: 28,
        periodLength: 5,
        lutealPhase: 14
    };
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentData));
}

// Navigation
function showHome() {
    hideAllViews();
    document.getElementById('homeView').classList.remove('hidden');
    updateNav('home');
    updateDashboard();
}

function showAddEntry() {
    hideAllViews();
    document.getElementById('addEntryView').classList.remove('hidden');
    updateNav('entry');
}

function showChart() {
    hideAllViews();
    document.getElementById('chartView').classList.remove('hidden');
    updateNav('chart');
}

function showSettings() {
    hideAllViews();
    document.getElementById('settingsView').classList.remove('hidden');
    updateNav('settings');
}

function hideAllViews() {
    document.getElementById('homeView').classList.add('hidden');
    document.getElementById('addEntryView').classList.add('hidden');
    document.getElementById('chartView').classList.add('hidden');
    document.getElementById('settingsView').classList.add('hidden');
}

function updateNav(view) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    const navItems = document.querySelectorAll('.nav-item');
    if (view === 'home') navItems[0].classList.add('active');
    if (view === 'entry') navItems[1].classList.add('active');
    if (view === 'chart') navItems[2].classList.add('active');
    if (view === 'settings') navItems[3].classList.add('active');
}

// Dashboard
function updateDashboard() {
    const dashboard = document.getElementById('dashboardContent');
    if (!dashboard) return;
    
    const allEntries = Object.values(currentData.entries);
    const hasData = allEntries.length > 0;
    
    if (!hasData) {
        dashboard.innerHTML = `
            <div class="welcome-card">
                <h2>Willkommen bei CycleTrack</h2>
                <p>Beginne damit, deine ersten Zyklusdaten einzugeben.</p>
                <button class="btn" onclick="showAddEntry()">Ersten Eintrag erstellen</button>
            </div>
        `;
        return;
    }
    
    // Finde letzte Periode
    const periodEntries = allEntries.filter(e => e.period).sort((a, b) => 
        new Date(a.date) - new Date(b.date)
    );
    const lastPeriod = periodEntries.length > 0 ? periodEntries[periodEntries.length - 1] : null;
    
    // Berechne Zyklustag
    const today = new Date();
    let cycleDay = 0;
    if (lastPeriod) {
        const lastPeriodDate = new Date(lastPeriod.date);
        cycleDay = Math.floor((today - lastPeriodDate) / (1000 * 60 * 60 * 24)) + 1;
    }
    
    dashboard.innerHTML = `
        <div class="dashboard-grid">
            <div class="dashboard-card main-status">
                <div class="status-icon">🎭</div>
                <div class="status-title">CycleTrack</div>
                <div class="status-subtitle">v1.1.3 Debug Mode</div>
            </div>
            <div class="dashboard-card">
                <div class="card-label">Zyklustag</div>
                <div class="card-value">${cycleDay > 0 ? cycleDay : '-'}</div>
            </div>
            <div class="dashboard-card">
                <div class="card-label">Einträge</div>
                <div class="card-value">${allEntries.length}</div>
            </div>
        </div>
    `;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date();
    const headerDate = document.getElementById('headerDate');
    if (headerDate) {
        headerDate.textContent = today.toLocaleDateString('de-DE', { 
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        });
    }
    showHome();
});
