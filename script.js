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
// 3. CLOUD & LOCAL SYNC (PERSISTENCE)
// ==========================================
function syncDataToCloud() {
    if (!currentUser.uid) return;

    // 1. Instantly save locally (prevents data loss if network drops)
    localStorage.setItem(`contripe_tracker_${currentUser.uid}`, JSON.stringify(trackerTransactions));
    localStorage.setItem(`contripe_contri_${currentUser.uid}`, JSON.stringify(contriExpenses));

    // 2. Save permanently to Firebase
    db.collection("users").doc(currentUser.uid).set({
        trackerTransactions: trackerTransactions,
        contriExpenses: contriExpenses
    }, { merge: true }).catch((e) => console.error("Firebase Sync Error:", e));
}

function checkUserAndNavigate(user) {
    const localUpi = localStorage.getItem(`contripe_upi_${user.uid}`);
    const localDp = localStorage.getItem(`contripe_dp_${user.uid}`);

    // 1. Instantly load local arrays so UI doesn't wait for Firebase
    const localTracker = localStorage.getItem(`contripe_tracker_${user.uid}`);
    const localContri = localStorage.getItem(`contripe_contri_${user.uid}`);
    if (localTracker) trackerTransactions = JSON.parse(localTracker);
    if (localContri) contriExpenses = JSON.parse(localContri);

    db.collection("users").doc(user.uid).get()
        .then((doc) => {
            if (doc.exists) {
                if (doc.data().upi) currentUser.upi = doc.data().upi;
                if (doc.data().name) currentUser.name = doc.data().name || currentUser.name;
                if (doc.data().dp) applyProfilePicture(doc.data().dp);

                // 2. Cloud data acts as the ultimate truth. Override local if it exists.
                if (doc.data().trackerTransactions) {
                    trackerTransactions = doc.data().trackerTransactions;
                    localStorage.setItem(`contripe_tracker_${user.uid}`, JSON.stringify(trackerTransactions));
                }
                if (doc.data().contriExpenses) {
                    contriExpenses = doc.data().contriExpenses;
                    localStorage.setItem(`contripe_contri_${user.uid}`, JSON.stringify(contriExpenses));
                }

                updateTrackerUI();
                updateContriUI();
                updateDashboardCard();

                if (currentUser.upi) {
                    routeAfterAuth();
                } else {
                    navigateTo('profileScreen');
                }
            } else if (localUpi) {
                currentUser.upi = localUpi;
                if (localDp) applyProfilePicture(localDp);
                routeAfterAuth();
            } else {
                const pn = document.getElementById('profileName');
                if (pn) pn.value = currentUser.name;
                navigateTo('profileScreen');
            }
        })
        .catch((e) => {
            console.error("Firestore Read Error:", e);
            
            // If Firebase fails, we still have the local data loaded! Update UI safely.
            updateTrackerUI();
            updateContriUI();
            updateDashboardCard();

            if (localUpi) {
                currentUser.upi = localUpi;
                if (localDp) applyProfilePicture(localDp);
                routeAfterAuth();
            } else {
                navigateTo('profileScreen');
            }
        });
}

// ==========================================
// 4. AUTH CONTROLLER
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
    const containerId = isEdit ? 'editDpContainer' : 'dpContainer';
    const iconId = isEdit ? 'editDpIcon' : 'dpIcon';
    const el = document.getElementById(containerId);
    if (el) {
        el.style.backgroundImage = `url(${url})`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
    }
    const icon = document.getElementById(iconId);
    if (icon) icon.style.display = 'none';
    currentUser.dpUrl = url;
}

function routeAfterAuth() {
    updateSidebarUser();
    const hasSeenTour = localStorage.getItem(`contripe_tour_${currentUser.uid}`);
    if (!hasSeenTour) {
        const nameEl = document.getElementById('welcomeName');
        if (nameEl) nameEl.textContent = currentUser.name.split(' ')[0] || "User";
        currentSlideIndex = 0;
        updateSlider();
        navigateTo('onboardingScreen');
    } else {
        navigateTo('dashboardScreen');
    }
}

function handleEmailLogin() {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    if (!email || !pass) return alert("Please enter email and password.");
    auth.signInWithEmailAndPassword(email, pass).catch(e => alert(e.message));
}

function handleSignup() {
    const email = document.getElementById('signupEmail').value;
    const pass = document.getElementById('signupPassword').value;
    const name = document.getElementById('signupName').value;
    if (!email || !pass || !name) return alert("Please fill all fields.");
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
    if (!email) return alert("Please enter your email first!");
    auth.sendPasswordResetEmail(email)
        .then(() => alert("Reset link sent to " + email))
        .catch(e => alert(e.message));
}

function handleLogout() {
    auth.signOut().then(() => {
        currentUser = { name: "User", upi: "", uid: null, dpUrl: null };
        trackerTransactions = [];
        contriExpenses = [];
        const dpC = document.getElementById('dpContainer');
        if (dpC) { dpC.style.backgroundImage = 'none'; }
        const dpI = document.getElementById('dpIcon');
        if (dpI) dpI.style.display = 'block';
        closeSidebar();
    });
}

// ==========================================
// 5. ONBOARDING TOUR
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

    if (btn) btn.textContent = currentSlideIndex === 2 ? "Let's Go 🚀" : "Next →";
}

function finishTour() {
    localStorage.setItem(`contripe_tour_${currentUser.uid}`, 'true');
    navigateTo('dashboardScreen');
}

// ==========================================
// 6. SIDEBAR
// ==========================================
function openSidebar() {
    document.getElementById('sidebarMenu').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('active');
}

function closeSidebar() {
    document.getElementById('sidebarMenu').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
}

function updateSidebarUser() {
    const nameEl = document.getElementById('sidebarName');
    const upiEl = document.getElementById('sidebarUpi');
    const avatarEl = document.getElementById('sidebarAvatar');
    if (nameEl) nameEl.textContent = currentUser.name;
    if (upiEl) upiEl.textContent = currentUser.upi || 'Not set';
    if (avatarEl) avatarEl.textContent = currentUser.name.charAt(0).toUpperCase();
}

// ==========================================
// 7. PROFILE
// ==========================================
function handleImageSelect(event, isEditScreen) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) { applyProfilePicture(e.target.result, isEditScreen); };
        reader.readAsDataURL(file);
    }
}

const dpC = document.getElementById('dpContainer');
if (dpC) dpC.addEventListener('click', () => document.getElementById('dpInput').click());
const dpI2 = document.getElementById('dpInput');
if (dpI2) dpI2.addEventListener('change', (e) => handleImageSelect(e, false));

const edpC = document.getElementById('editDpContainer');
if (edpC) edpC.addEventListener('click', () => document.getElementById('editDpInput').click());
const edpI = document.getElementById('editDpInput');
if (edpI) edpI.addEventListener('change', (e) => handleImageSelect(e, true));

function openEditProfile() {
    closeSidebar();
    const en = document.getElementById('editName');
    const eu = document.getElementById('editUpi');
    if (en) en.value = currentUser.name;
    if (eu) eu.value = currentUser.upi;
    if (currentUser.dpUrl) applyProfilePicture(currentUser.dpUrl, true);
    navigateTo('editProfileScreen');
}

function saveProfileData(nameInputId, upiInputId, btnId, isNewProfile = false) {
    const upi = document.getElementById(upiInputId).value;
    const name = document.getElementById(nameInputId).value || currentUser.name;

    if (!upi.includes('@')) return alert("Enter a valid UPI ID (e.g. name@bank)");
    if (!currentUser.uid) return alert("Session lost! Please refresh.");

    const btn = document.getElementById(btnId);
    const ogText = btn.innerHTML;
    btn.innerHTML = '<span>Saving...</span>';
    btn.disabled = true;

    currentUser.upi = upi;
    currentUser.name = name;

    localStorage.setItem(`contripe_upi_${currentUser.uid}`, upi);
    if (currentUser.dpUrl) localStorage.setItem(`contripe_dp_${currentUser.uid}`, currentUser.dpUrl);

    let isSaved = false;
    const timer = setTimeout(() => {
        if (!isSaved) {
            btn.innerHTML = ogText; btn.disabled = false;
            updateSidebarUser();
            if (isNewProfile) routeAfterAuth(); else navigateTo('dashboardScreen');
        }
    }, 3000);

    db.collection("users").doc(currentUser.uid).set({
        name: currentUser.name, upi: currentUser.upi, dp: currentUser.dpUrl || null
    }, { merge: true }).then(() => {
        isSaved = true; clearTimeout(timer);
        btn.innerHTML = ogText; btn.disabled = false;
        updateSidebarUser();
        if (isNewProfile) routeAfterAuth(); else navigateTo('dashboardScreen');
    }).catch(() => {
        isSaved = true; clearTimeout(timer);
        btn.innerHTML = ogText; btn.disabled = false;
        updateSidebarUser();
        if (isNewProfile) routeAfterAuth(); else navigateTo('dashboardScreen');
    });
}

const spb = document.getElementById('saveProfileBtn');
if (spb) spb.addEventListener('click', () => saveProfileData('profileName', 'profileUpi', 'saveProfileBtn', true));
const upb = document.getElementById('updateProfileBtn');
if (upb) upb.addEventListener('click', () => saveProfileData('editName', 'editUpi', 'updateProfileBtn', false));

// ==========================================
// 8. NAVIGATION & DASHBOARD
// ==========================================
function navigateTo(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) target.classList.add('active');

    if (screenId === 'dashboardScreen') {
        const dn = document.getElementById('dashName');
        if (dn) dn.textContent = currentUser.name.split(' ')[0] || "User";
        const dcn = document.getElementById('dashCardName');
        if (dcn) dcn.textContent = currentUser.name.toUpperCase();
        const da = document.getElementById('dashAvatar');
        if (da) da.textContent = currentUser.name.charAt(0).toUpperCase();
        updateDashboardCard();
    }

    if (screenId === 'trackerScreen') {
        const mf = document.getElementById('trackerMonthFilter');
        if (mf && !mf.value) mf.value = new Date().toISOString().slice(0, 7);
        updateTrackerUI();
    }
}

function updateDashboardCard() {
    let totalInc = 0, totalExp = 0;
    trackerTransactions.forEach(tx => {
        if (tx.type === 'credit') totalInc += tx.amount;
        else totalExp += tx.amount;
    });
    const net = totalInc - totalExp;

    const di = document.getElementById('dashIncome');
    const de = document.getElementById('dashExpense');
    const dnb = document.getElementById('dashNetBalance');

    if (di) di.textContent = `₹${totalInc.toFixed(2)}`;
    if (de) de.textContent = `₹${totalExp.toFixed(2)}`;
    if (dnb) {
        dnb.textContent = `₹${net.toFixed(2)}`;
        dnb.className = 'balance-amount ' + (net > 0 ? 'text-green' : net < 0 ? 'text-red' : '');
    }
}

// ==========================================
// 9. CONTRI LOGIC
// ==========================================
const addBtn = document.getElementById('addBtn');
if (addBtn) addBtn.addEventListener('click', () => {
    const name = document.getElementById('expenseName').value || "Expense";
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    if (amount > 0) {
        contriExpenses.push({ name, amount });
        document.getElementById('expenseName').value = '';
        document.getElementById('expenseAmount').value = '';
        updateContriUI();
        syncDataToCloud();
    }
});

const resetBtn = document.getElementById('resetBtn');
if (resetBtn) resetBtn.addEventListener('click', () => {
    if (contriExpenses.length === 0) return;
    if (confirm("Reset all trip expenses?")) {
        contriExpenses = [];
        document.getElementById('friendCount').value = 1;
        updateContriUI();
        syncDataToCloud();
    }
});

const friendCountInput = document.getElementById('friendCount');
if (friendCountInput) friendCountInput.addEventListener('input', updateContriUI);

function removeContriExpense(index) {
    contriExpenses.splice(index, 1);
    updateContriUI();
    syncDataToCloud();
}

function updateContriUI() {
    const list = document.getElementById('expenseList');
    if (!list) return;
    list.innerHTML = '';
    let total = 0;

    contriExpenses.forEach((exp, index) => {
        total += exp.amount;
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${exp.name}</span>
            <div class="expense-amount-wrap">
                <strong>₹${exp.amount.toFixed(2)}</strong>
                <span class="delete-icon" onclick="removeContriExpense(${index})">✕</span>
            </div>
        `;
        list.appendChild(li);
    });

    const ta = document.getElementById('totalAmount');
    if (ta) ta.textContent = `₹${total.toFixed(2)}`;

    let friends = parseInt(document.getElementById('friendCount').value) || 1;
    let perPerson = isFinite(total / friends) ? total / friends : 0;

    const ppa = document.getElementById('perPersonAmount');
    if (ppa) ppa.textContent = `₹${perPerson.toFixed(2)}`;
}

const payBox = document.getElementById('payBox');
if (payBox) payBox.addEventListener('click', () => {
    const friends = parseInt(document.getElementById('friendCount').value) || 1;
    const total = contriExpenses.reduce((s, e) => s + e.amount, 0);
    const perPerson = (total / friends).toFixed(2);

    if (perPerson <= 0) return alert("Add some expenses first!");

    const rnd = document.getElementById('receiverNameDisplay');
    const mad = document.getElementById('modalAmountDisplay');
    if (rnd) rnd.textContent = currentUser.name;
    if (mad) mad.textContent = `₹${perPerson}`;

    const upiStr = `upi://pay?pa=${currentUser.upi}&pn=${encodeURIComponent(currentUser.name)}&am=${perPerson}&cu=INR`;
    const qrEl = document.getElementById('qrcode');
    if (qrEl) {
        qrEl.innerHTML = '';
        qrCodeInstance = new QRCode(qrEl, {
            text: upiStr, width: 180, height: 180,
            colorDark: "#000000", colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    }

    document.getElementById('qrModal').style.display = 'flex';
});

// ==========================================
// 10. TRACKER LOGIC
// ==========================================
const addTrackerBtn = document.getElementById('addTrackerBtn');
if (addTrackerBtn) addTrackerBtn.addEventListener('click', () => {
    const type = activeTrackerType || 'debit';
    const name = document.getElementById('trackerName').value || (type === 'credit' ? 'Income' : 'Expense');
    const category = type === 'debit' ? document.getElementById('trackerCategory').value : 'Income';
    const amount = parseFloat(document.getElementById('trackerAmount').value);

    if (amount > 0) {
        trackerTransactions.push({
            id: Date.now(), type, name, category, amount,
            date: new Date().toISOString()
        });
        document.getElementById('trackerName').value = '';
        document.getElementById('trackerAmount').value = '';
        updateTrackerUI();
        updateDashboardCard();
        syncDataToCloud();
    }
});

const resetTrackerBtn = document.getElementById('resetTrackerBtn');
if (resetTrackerBtn) resetTrackerBtn.addEventListener('click', () => {
    if (trackerTransactions.length === 0) return;
    if (confirm("Delete all tracker records?")) {
        trackerTransactions = [];
        updateTrackerUI();
        updateDashboardCard();
        syncDataToCloud();
    }
});

function removeTrackerItem(id) {
    trackerTransactions = trackerTransactions.filter(t => t.id !== id);
    updateTrackerUI();
    updateDashboardCard();
    syncDataToCloud();
}

function updateTrackerUI() {
    const list = document.getElementById('trackerList');
    const monthFilter = document.getElementById('trackerMonthFilter');
    if (!list || !monthFilter) return;
    list.innerHTML = '';

    const month = monthFilter.value;
    let chartData = { Food: 0, Travel: 0, Stay: 0, Misc: 0 };

    const filtered = trackerTransactions
        .filter(t => t.date.startsWith(month))
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    filtered.forEach(tx => {
        if (tx.type !== 'credit' && chartData[tx.category] !== undefined) {
            chartData[tx.category] += tx.amount;
        }
        const li = document.createElement('li');
        li.className = 'ledger-item';
        const isCredit = tx.type === 'credit';
        const sign = isCredit ? '+' : '−';
        const cls = isCredit ? 'text-green' : 'text-red';
        const dateStr = new Date(tx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        li.innerHTML = `
            <div class="ledger-info">
                <strong>${tx.name}</strong>
                <span>${dateStr} · ${tx.category}</span>
            </div>
            <div class="expense-amount-wrap">
                <strong class="${cls}">${sign}₹${tx.amount.toFixed(2)}</strong>
                <span class="delete-icon" onclick="removeTrackerItem(${tx.id})">✕</span>
            </div>
        `;
        list.appendChild(li);
    });

    const hasChart = Object.values(chartData).some(v => v > 0);
    const chartWrapper = document.getElementById('chartWrapper');
    if (chartWrapper) chartWrapper.style.display = hasChart ? 'block' : 'none';
    if (hasChart) updateExpenseChart(chartData);
}

function updateExpenseChart(data) {
    const ctx = document.getElementById('expenseChart');
    if (!ctx) return;
    if (expenseChart) expenseChart.destroy();

    Chart.defaults.color = '#6b6b7a';
    Chart.defaults.font.family = "'DM Sans', sans-serif";

    expenseChart = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(data).filter(k => data[k] > 0),
            datasets: [{
                data: Object.values(data).filter(v => v > 0),
                backgroundColor: ['#6c63ff', '#ff4b6e', '#00e5a0', '#ff9a3d'],
                borderWidth: 0,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { padding: 16, usePointStyle: true, pointStyle: 'circle' }
                }
            }
        }
    });
}
