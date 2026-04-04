// --- APP ROUTING & STATE ---
let currentUser = { name: "", upi: "" };
let contriExpenses = [];
let trackerData = { "Food": 0, "Travel": 0, "Stay": 0, "Misc": 0 };
let expenseChart; 

// Switch between screens
function navigateTo(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');

    // If navigating to dashboard, update the greeting
    if (screenId === 'dashboardScreen') {
        document.getElementById('dashName').textContent = currentUser.name.split(' ')[0] || "User";
    }
    
    // If navigating to tracker, initialize the chart
    if (screenId === 'trackerScreen') {
        initChart();
    }
}

function logout() {
    currentUser = { name: "", upi: "" };
    navigateTo('loginScreen');
}

// --- AUTH LOGIC ---
function handleSignup() {
    const name = document.getElementById('signupName').value.trim();
    
    // Auto-fill the profile setup screen with the name they just entered
    if(name) {
        document.getElementById('profileName').value = name;
    }
    
    // Direct them to setup their UPI ID next
    navigateTo('profileScreen');
}

// --- PROFILE SETUP ---
document.getElementById('saveProfileBtn').addEventListener('click', () => {
    const name = document.getElementById('profileName').value;
    const upi = document.getElementById('profileUpi').value;

    if (!upi.includes('@')) {
        alert("Please enter a valid UPI ID (e.g., name@bank)");
        return;
    }

    currentUser.name = name;
    currentUser.upi = upi;
    navigateTo('dashboardScreen');
});

// --- TRIP CONTRI LOGIC ---
document.getElementById('addBtn').addEventListener('click', () => {
    const name = document.getElementById('expenseName').value || "Expense";
    const amount = parseFloat(document.getElementById('expenseAmount').value);

    if (amount > 0) {
        contriExpenses.push({ name, amount });
        document.getElementById('expenseName').value = '';
        document.getElementById('expenseAmount').value = '';
        updateContriUI();
    }
});

document.getElementById('friendCount').addEventListener('input', updateContriUI);

function updateContriUI() {
    const list = document.getElementById('expenseList');
    list.innerHTML = '';
    
    let total = 0;
    contriExpenses.forEach(exp => {
        total += exp.amount;
        const li = document.createElement('li');
        li.innerHTML = `<span>${exp.name}</span> <strong>₹${exp.amount.toFixed(2)}</strong>`;
        list.appendChild(li);
    });

    document.getElementById('totalAmount').textContent = `₹${total.toFixed(2)}`;

    let friends = parseInt(document.getElementById('friendCount').value) || 1;
    let perPerson = total / friends;
    
    document.getElementById('perPersonAmount').textContent = `₹${perPerson.toFixed(2)}`;
}

// Open QR Modal
document.getElementById('payBox').addEventListener('click', () => {
    let friends = parseInt(document.getElementById('friendCount').value) || 1;
    const total = contriExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    let perPerson = (total / friends).toFixed(2);

    if (perPerson <= 0) return alert("Add expenses first!");

    document.getElementById('receiverNameDisplay').textContent = currentUser.name;
    document.getElementById('modalAmountDisplay').textContent = `₹${perPerson}`;

    const upiString = `upi://pay?pa=${currentUser.upi}&pn=${currentUser.name}&am=${perPerson}&cu=INR`;
    document.getElementById('qrImage').src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiString)}`;
    
    document.getElementById('qrModal').style.display = 'flex';
});

// --- EXPENSE TRACKER & CHART.JS LOGIC ---
document.getElementById('addTrackerBtn').addEventListener('click', () => {
    const category = document.getElementById('trackerCategory').value;
    const amount = parseFloat(document.getElementById('trackerAmount').value);

    if (amount > 0) {
        trackerData[category] += amount;
        document.getElementById('trackerAmount').value = '';
        updateChart();
    }
});

function initChart() {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    
    if (expenseChart) expenseChart.destroy();

    expenseChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(trackerData),
            datasets: [{
                data: Object.values(trackerData),
                backgroundColor: ['#ff6b6b', '#4ecdc4', '#ffe66d', '#1a535c'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

function updateChart() {
    expenseChart.data.datasets[0].data = Object.values(trackerData);
    expenseChart.update();
}