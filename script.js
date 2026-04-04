// ==========================================
// 1. FIREBASE CONFIGURATION
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyASRP_nndOsHzJcrJkAuUUkrIPUvKCLAlo",
    authDomain: "contripe.firebaseapp.com",
    projectId: "contripe",
    storageBucket: "contripe.firebasestorage.app",
    messagingSenderId: "418795466058",
    appId: "1:418795466058:web:c9dfb84a04b77ebe75e5b3",
    measurementId: "G-W3EKQ9X3CN"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ==========================================
// 2. APP STATE
// ==========================================
let currentUser = { name: "User", upi: "", uid: null, dpUrl: null };
let contriExpenses = [];
let trackerTransactions = []; 
let expenseChart; 
let qrCodeInstance = null;

// ==========================================
// 3. MASTER AUTHENTICATION CONTROLLER
// ==========================================
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser.name = user.displayName || "User";
        currentUser.uid = user.uid;
        checkUserAndNavigate(user); 
    } else {
        navigateTo('loginScreen'); 
    }
});

function applyProfilePicture(url, isEdit = false) {
    if(isEdit) {
        document.getElementById('editDpContainer').style.backgroundImage = `url(${url})`;
        document.getElementById('editDpIcon').style.display = 'none';
    } else {
        document.getElementById('dpContainer').style.backgroundImage = `url(${url})`;
        document.getElementById('dpIcon').style.display = 'none';
    }
    currentUser.dpUrl = url;
}

function routeAfterAuth() {
    const hasSeenTour = localStorage.getItem(`contripe_tour_${currentUser.uid}`);
    if (!hasSeenTour) {
        document.getElementById('welcomeName').textContent = currentUser.name.split(' ')[0] || "User";
        currentSlideIndex = 0;
        updateSlider();
        navigateTo('onboardingScreen');
    } else {
        navigateTo('dashboardScreen');
    }
}

function checkUserAndNavigate(user) {
    const localUpi = localStorage.getItem(`contripe_upi_${user.uid}`);
    const localDp = localStorage.getItem(`contripe_dp_${user.uid}`);

    db.collection("users").doc(user.uid).get()
        .then((doc) => {
            if (doc.exists && doc.data().upi) {
                currentUser.upi = doc.data().upi;
                currentUser.name = doc.data().name || currentUser.name;
                if (doc.data().dp) applyProfilePicture(doc.data().dp);
                routeAfterAuth();
            } else if (localUpi) {
                currentUser.upi = localUpi;
                if (localDp) applyProfilePicture(localDp);
                routeAfterAuth();
            } else {
                document.getElementById('profileName').value = currentUser.name;
                navigateTo('profileScreen');
            }
        })
        .catch(() => {
            if (localUpi) {
                currentUser.upi = localUpi;
                if (localDp) applyProfilePicture(localDp);
                routeAfterAuth();
            } else {
                document.getElementById('profileName').value = currentUser.name;
                navigateTo('profileScreen'); 
            }
        });
}

function handleEmailLogin() {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    if(!email || !pass) return alert("Please enter email and password.");
    auth.signInWithEmailAndPassword(email, pass).catch(e => alert(e.message));
}

function handleSignup() {
    const email = document.getElementById('signupEmail').value;
    const pass = document.getElementById('signupPassword').value;
    const name = document.getElementById('signupName').value;
    if(!email || !pass || !name) return alert("Please fill all fields.");

    auth.createUserWithEmailAndPassword(email, pass)
        .then(res => res.user.updateProfile({ displayName: name }))
        .catch(e => alert(e.message));
}

function handleGoogleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(e => alert(e.message));
}

function handlePasswordReset() {
    const email = document.getElementById('loginEmail').value;
    if(!email) return alert("Please enter email first!");
    auth.sendPasswordResetEmail(email).then(() => alert("Reset link sent!")).catch(e => alert(e.message));
}

function handleLogout() {
    auth.signOut().then(() => {
        currentUser = { name: "User", upi: "", uid: null, dpUrl: null };
        document.getElementById('dpContainer').style.backgroundImage = 'none';
        document.getElementById('dpIcon').style.display = 'block';
        closeSidebar();
    });
}

// ==========================================
// 4. ANIMATED APP TOUR LOGIC
// ==========================================
let currentSlideIndex = 0;

function nextSlide() {
    if (currentSlideIndex < 2) {
        currentSlideIndex++;
        updateSlider();
    } else {
        finishTour();
    }
}

function updateSlider() {
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.dot');
    const btn = document.getElementById('nextSlideBtn');

    slides.forEach(s => s.style.transform = `translateX(-${currentSlideIndex * 100}%)`);
    dots.forEach((d, i) => d.classList.toggle('active', i === currentSlideIndex));

    if (currentSlideIndex === 2) {
        btn.textContent = "Let's Go! 🚀";
    } else {
        btn.textContent = "Next ➔";
    }
}

function finishTour() {
    localStorage.setItem(`contripe_tour_${currentUser.uid}`, 'true');
    navigateTo('dashboardScreen');
}

// ==========================================
// 5. SIDEBAR LOGIC
// ==========================================
function openSidebar() {
    document.getElementById('sidebarMenu').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('active');
}

function closeSidebar() {
    document.getElementById('sidebarMenu').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
}

// ==========================================
// 6. PROFILE SETUP & EDIT
// ==========================================
function handleImageSelect(event, isEditScreen) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) { applyProfilePicture(e.target.result, isEditScreen); }
        reader.readAsDataURL(file);
    }
}

document.getElementById('dpContainer').addEventListener('click', () => document.getElementById('dpInput').click());
document.getElementById('dpInput').addEventListener('change', (e) => handleImageSelect(e, false));

document.getElementById('editDpContainer').addEventListener('click', () => document.getElementById('editDpInput').click());
document.getElementById('editDpInput').addEventListener('change', (e) => handleImageSelect(e, true));

function openEditProfile() {
    closeSidebar();
    document.getElementById('editName').value = currentUser.name;
    document.getElementById('editUpi').value = currentUser.upi;
    if (currentUser.dpUrl) applyProfilePicture(currentUser.dpUrl, true);
    navigateTo('editProfileScreen');
}

function saveProfileData(nameInputId, upiInputId, btnId, isNewProfile = false) {
    const upi = document.getElementById(upiInputId).value;
    const name = document.getElementById(nameInputId).value || currentUser.name;

    if (!upi.includes('@')) return alert("Enter a valid UPI ID");
    if (!currentUser.uid) return alert("Session lost! Refresh page.");

    const btn = document.getElementById(btnId);
    const ogText = btn.textContent;
    btn.textContent = "Saving..."; btn.disabled = true;

    currentUser.upi = upi;
    currentUser.name = name;

    localStorage.setItem(`contripe_upi_${currentUser.uid}`, upi);
    if(currentUser.dpUrl) localStorage.setItem(`contripe_dp_${currentUser.uid}`, currentUser.dpUrl);

    let isSaved = false;
    const emergencyTimeout = setTimeout(() => {
        if (!isSaved) {
            btn.textContent = ogText; btn.disabled = false;
            if(isNewProfile) routeAfterAuth(); else navigateTo('dashboardScreen');
        }
    }, 3000);

    db.collection("users").doc(currentUser.uid).set({
        name: currentUser.name,
        upi: currentUser.upi,
        dp: currentUser.dpUrl || null 
    }).then(() => {
        isSaved = true; clearTimeout(emergencyTimeout);
        btn.textContent = ogText; btn.disabled = false;
        if(isNewProfile) routeAfterAuth(); else navigateTo('dashboardScreen');
    }).catch(() => {
        isSaved = true; clearTimeout(emergencyTimeout);
        btn.textContent = ogText; btn.disabled = false;
        if(isNewProfile) routeAfterAuth(); else navigateTo('dashboardScreen'); 
    });
}

document.getElementById('saveProfileBtn').addEventListener('click', () => saveProfileData('profileName', 'profileUpi', 'saveProfileBtn', true));
document.getElementById('updateProfileBtn').addEventListener('click', () => saveProfileData('editName', 'editUpi', 'updateProfileBtn', false));


// ==========================================
// 7. NAVIGATION & CORE APP LOGIC
// ==========================================
function navigateTo(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');

    if (screenId === 'dashboardScreen') {
        document.getElementById('dashName').textContent = currentUser.name.split(' ')[0] || "User";
        document.getElementById('dashCardName').textContent = currentUser.name;
        updateDashboardCard(); // Refresh card data when hitting dashboard
    }
    
    if (screenId === 'trackerScreen') {
        if(!document.getElementById('trackerMonthFilter').value) {
            document.getElementById('trackerMonthFilter').value = new Date().toISOString().slice(0, 7);
        }
        updateTrackerUI();
    }
}

// ==========================================
// NEW: Update Dashboard ContriPe Card
// ==========================================
function updateDashboardCard() {
    let totalInc = 0;
    let totalExp = 0;

    // Calculate totals across ALL transactions
    trackerTransactions.forEach(tx => {
        if (tx.type === 'credit') {
            totalInc += tx.amount;
        } else {
            totalExp += tx.amount;
        }
    });

    const netBalance = totalInc - totalExp;

    // Update Card UI
    document.getElementById('dashIncome').textContent = `₹${totalInc.toFixed(2)}`;
    document.getElementById('dashExpense').textContent = `₹${totalExp.toFixed(2)}`;
    
    const balanceElem = document.getElementById('dashNetBalance');
    balanceElem.textContent = `₹${netBalance.toFixed(2)}`;
    
    // Dynamic Glow and Color for Balance
    if (netBalance > 0) {
        balanceElem.className = "text-green";
        balanceElem.style.textShadow = "0 0 20px rgba(0, 230, 118, 0.3)";
    } else if (netBalance < 0) {
        balanceElem.className = "text-red";
        balanceElem.style.textShadow = "0 0 20px rgba(255, 75, 43, 0.3)";
    } else {
        balanceElem.className = "";
        balanceElem.style.color = "#ffffff";
        balanceElem.style.textShadow = "none";
    }
}

// ==========================================
// Trip Contri Logic
// ==========================================
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

document.getElementById('resetBtn').addEventListener('click', () => {
    if (contriExpenses.length === 0) return; 
    if (confirm("Are you sure you want to reset all trip expenses?")) {
        contriExpenses = [];
        document.getElementById('friendCount').value = 1; 
        updateContriUI();
    }
});

document.getElementById('friendCount').addEventListener('input', updateContriUI);

function removeContriExpense(index) {
    contriExpenses.splice(index, 1);
    updateContriUI(); 
}

function updateContriUI() {
    const list = document.getElementById('expenseList');
    list.innerHTML = '';
    let total = 0;
    
    contriExpenses.forEach((exp, index) => {
        total += exp.amount;
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${exp.name}</span> 
            <div class="expense-amount-wrap">
                <strong>₹${exp.amount.toFixed(2)}</strong>
                <span class="delete-icon" onclick="removeContriExpense(${index})">&times;</span>
            </div>
        `;
        list.appendChild(li);
    });
    
    document.getElementById('totalAmount').textContent = `₹${total.toFixed(2)}`;
    
    let friends = parseInt(document.getElementById('friendCount').value) || 1;
    let perPerson = total / friends;
    
    if (isNaN(perPerson) || !isFinite(perPerson)) perPerson = 0;
    
    document.getElementById('perPersonAmount').textContent = `₹${perPerson.toFixed(2)}`;
}

document.getElementById('payBox').addEventListener('click', () => {
    let friends = parseInt(document.getElementById('friendCount').value) || 1;
    const total = contriExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    let perPerson = (total / friends).toFixed(2);

    if (perPerson <= 0) return alert("Add expenses first!");

    document.getElementById('receiverNameDisplay').textContent = currentUser.name;
    document.getElementById('modalAmountDisplay').textContent = `₹${perPerson}`;

    const upiString = `upi://pay?pa=${currentUser.upi}&pn=${currentUser.name}&am=${perPerson}&cu=INR`;
    document.getElementById('qrcode').innerHTML = '';
    qrCodeInstance = new QRCode(document.getElementById("qrcode"), {
        text: upiString, width: 180, height: 180,
        colorDark : "#000000", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.H
    });
    
    document.getElementById('qrModal').style.display = 'flex';
});

// ==========================================
// Personal Tracker Ledger Logic
// ==========================================
function toggleTrackerCategory() {
    const type = document.getElementById('trackerType').value;
    document.getElementById('trackerCategory').style.display = type === 'debit' ? 'block' : 'none';
}

document.getElementById('addTrackerBtn').addEventListener('click', () => {
    const type = document.getElementById('trackerType').value;
    const name = document.getElementById('trackerName').value || (type === 'credit' ? 'Income' : 'Expense');
    const category = type === 'debit' ? document.getElementById('trackerCategory').value : 'Income';
    const amount = parseFloat(document.getElementById('trackerAmount').value);

    if (amount > 0) {
        trackerTransactions.push({
            id: Date.now(),
            type: type,
            name: name,
            category: category,
            amount: amount,
            date: new Date().toISOString()
        });
        
        document.getElementById('trackerName').value = '';
        document.getElementById('trackerAmount').value = '';
        updateTrackerUI();
        updateDashboardCard(); // Keep dashboard in sync
    }
});

document.getElementById('resetTrackerBtn').addEventListener('click', () => {
    if (trackerTransactions.length === 0) return;
    if (confirm("Are you sure you want to delete all tracker records?")) {
        trackerTransactions = [];
        updateTrackerUI();
        updateDashboardCard();
    }
});

function removeTrackerItem(id) {
    trackerTransactions = trackerTransactions.filter(t => t.id !== id);
    updateTrackerUI();
    updateDashboardCard();
}

function updateTrackerUI() {
    const list = document.getElementById('trackerList');
    const monthFilter = document.getElementById('trackerMonthFilter').value; 
    list.innerHTML = '';
    
    let chartData = { "Food": 0, "Travel": 0, "Stay": 0, "Misc": 0 };

    const filteredTx = trackerTransactions.filter(t => t.date.startsWith(monthFilter));
    filteredTx.sort((a, b) => new Date(b.date) - new Date(a.date));

    filteredTx.forEach(tx => {
        if (tx.type !== 'credit') {
            if(chartData[tx.category] !== undefined) chartData[tx.category] += tx.amount;
        }

        const li = document.createElement('li');
        li.className = 'ledger-item';
        
        const isCredit = tx.type === 'credit';
        const sign = isCredit ? '+' : '-';
        const colorClass = isCredit ? 'text-green' : 'text-red';
        const dateStr = new Date(tx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

        li.innerHTML = `
            <div class="ledger-info">
                <strong>${tx.name}</strong>
                <span>${dateStr} • ${tx.category}</span>
            </div>
            <div class="expense-amount-wrap">
                <strong class="${colorClass}">${sign}₹${tx.amount.toFixed(2)}</strong>
                <span class="delete-icon" onclick="removeTrackerItem(${tx.id})">&times;</span>
            </div>
        `;
        list.appendChild(li);
    });

    const hasChartData = Object.values(chartData).some(val => val > 0);
    const chartContainer = document.getElementById('chartWrapper');
    
    if (hasChartData) {
        chartContainer.style.display = 'block';
        updateExpenseChart(chartData);
    } else {
        chartContainer.style.display = 'none';
    }
}

function updateExpenseChart(data) {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    if (expenseChart) expenseChart.destroy();
    
    Chart.defaults.color = '#8e8e96';

    expenseChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(data).filter(k => data[k] > 0),
            datasets: [{
                data: Object.values(data).filter(v => v > 0),
                backgroundColor: ['#ff4b2b', '#ff416c', '#33333b', '#a52a2a'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
}
