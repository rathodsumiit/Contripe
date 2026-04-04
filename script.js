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
// 2. APP STATE & THEME INITIALIZATION
// ==========================================
let currentUser = { name: "User", upi: "", uid: null, dpUrl: null };
let contriExpenses = [];
let trackerData = { "Food": 0, "Travel": 0, "Stay": 0, "Misc": 0 };
let expenseChart; 
let qrCodeInstance = null;

// Load Theme from Memory instantly
if (localStorage.getItem('contripe_theme') === 'dark') {
    document.body.classList.add('dark-theme');
}

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

function checkUserAndNavigate(user) {
    const localUpi = localStorage.getItem(`contripe_upi_${user.uid}`);
    const localDp = localStorage.getItem(`contripe_dp_${user.uid}`);

    db.collection("users").doc(user.uid).get()
        .then((doc) => {
            if (doc.exists && doc.data().upi) {
                currentUser.upi = doc.data().upi;
                currentUser.name = doc.data().name || currentUser.name;
                if (doc.data().dp) applyProfilePicture(doc.data().dp);
                navigateTo('dashboardScreen');
            } else if (localUpi) {
                currentUser.upi = localUpi;
                if (localDp) applyProfilePicture(localDp);
                navigateTo('dashboardScreen');
            } else {
                document.getElementById('profileName').value = currentUser.name;
                navigateTo('profileScreen');
            }
        })
        .catch(() => {
            if (localUpi) {
                currentUser.upi = localUpi;
                if (localDp) applyProfilePicture(localDp);
                navigateTo('dashboardScreen');
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
// 4. SIDEBAR & THEME LOGIC
// ==========================================
function openSidebar() {
    document.getElementById('sidebarMenu').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('active');
}

function closeSidebar() {
    document.getElementById('sidebarMenu').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
}

function toggleTheme() {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('contripe_theme', isDark ? 'dark' : 'light');
    
    // Update Chart colors if it exists
    if(expenseChart) {
        Chart.defaults.color = isDark ? '#cbd5e1' : '#64748b';
        expenseChart.update();
    }
    closeSidebar();
}

// ==========================================
// 5. PROFILE SETUP & EDIT
// ==========================================

// Handle Image selection for BOTH screens
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

// Open Edit Screen
function openEditProfile() {
    closeSidebar();
    document.getElementById('editName').value = currentUser.name;
    document.getElementById('editUpi').value = currentUser.upi;
    if (currentUser.dpUrl) applyProfilePicture(currentUser.dpUrl, true);
    navigateTo('editProfileScreen');
}

// The Universal Save Function
function saveProfileData(nameInputId, upiInputId, btnId) {
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
            navigateTo('dashboardScreen');
        }
    }, 3000);

    db.collection("users").doc(currentUser.uid).set({
        name: currentUser.name,
        upi: currentUser.upi,
        dp: currentUser.dpUrl || null 
    }).then(() => {
        isSaved = true; clearTimeout(emergencyTimeout);
        btn.textContent = ogText; btn.disabled = false;
        navigateTo('dashboardScreen');
    }).catch(() => {
        isSaved = true; clearTimeout(emergencyTimeout);
        btn.textContent = ogText; btn.disabled = false;
        navigateTo('dashboardScreen'); 
    });
}

document.getElementById('saveProfileBtn').addEventListener('click', () => saveProfileData('profileName', 'profileUpi', 'saveProfileBtn'));
document.getElementById('updateProfileBtn').addEventListener('click', () => saveProfileData('editName', 'editUpi', 'updateProfileBtn'));


// ==========================================
// 6. NAVIGATION & APP LOGIC
// ==========================================
function navigateTo(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');

    if (screenId === 'dashboardScreen') {
        document.getElementById('dashName').textContent = currentUser.name.split(' ')[0] || "User";
    }
    if (screenId === 'trackerScreen') initChart();
}

// Trip Contri Logic
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
    document.getElementById('perPersonAmount').textContent = `₹${(total / friends).toFixed(2)}`;
}

// QR Code Generator
document.getElementById('payBox').addEventListener('click', () => {
    let friends = parseInt(document.getElementById('friendCount').value) || 1;
    const total = contriExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    let perPerson = (total / friends).toFixed(2);

    if (perPerson <= 0) return alert("Add expenses first!");

    document.getElementById('receiverNameDisplay').textContent = currentUser.name;
    document.getElementById('modalAmountDisplay').textContent = `₹${perPerson}`;

    const upiString = `upi://pay?pa=${currentUser.upi}&pn=${currentUser.name}&am=${perPerson}&cu=INR`;
    document.getElementById('qrcode').innerHTML = '';
    
    // Always render QR code with a white background so it scans successfully on dark mode!
    qrCodeInstance = new QRCode(document.getElementById("qrcode"), {
        text: upiString, width: 180, height: 180,
        colorDark : "#000000", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.H
    });
    
    document.getElementById('qrModal').style.display = 'flex';
});

// Tracker Logic
document.getElementById('addTrackerBtn').addEventListener('click', () => {
    const cat = document.getElementById('trackerCategory').value;
    const amt = parseFloat(document.getElementById('trackerAmount').value);
    if (amt > 0) {
        trackerData[cat] += amt;
        document.getElementById('trackerAmount').value = '';
        updateChart();
    }
});

function initChart() {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    if (expenseChart) expenseChart.destroy();
    
    Chart.defaults.color = document.body.classList.contains('dark-theme') ? '#cbd5e1' : '#64748b';

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
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
}

function updateChart() {
    expenseChart.data.datasets[0].data = Object.values(trackerData);
    expenseChart.update();
}
