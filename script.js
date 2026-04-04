// ==========================================
// 1. FIREBASE CONFIGURATION (Your Exact Keys)
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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ==========================================
// 2. APP STATE
// ==========================================
let currentUser = { name: "User", upi: "", uid: null, dpUrl: null };
let contriExpenses = [];
let trackerData = { "Food": 0, "Travel": 0, "Stay": 0, "Misc": 0 };
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

function checkUserAndNavigate(user) {
    db.collection("users").doc(user.uid).get()
        .then((doc) => {
            if (doc.exists && doc.data().upi) {
                currentUser.upi = doc.data().upi;
                if (doc.data().dp) {
                    document.getElementById('dpContainer').style.backgroundImage = `url(${doc.data().dp})`;
                    document.getElementById('dpIcon').style.display = 'none';
                    currentUser.dpUrl = doc.data().dp;
                }
                navigateTo('dashboardScreen');
            } else {
                document.getElementById('profileName').value = currentUser.name;
                navigateTo('profileScreen');
            }
        })
        .catch((error) => {
            console.error("DB Error:", error);
            document.getElementById('profileName').value = currentUser.name;
            navigateTo('profileScreen'); 
        });
}

function handleEmailLogin() {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    if(!email || !pass) return alert("Please enter email and password.");

    auth.signInWithEmailAndPassword(email, pass)
        .catch((error) => alert("Login Failed: " + error.message));
}

function handleSignup() {
    const email = document.getElementById('signupEmail').value;
    const pass = document.getElementById('signupPassword').value;
    const name = document.getElementById('signupName').value;

    if(!email || !pass || !name) return alert("Please fill all fields.");

    auth.createUserWithEmailAndPassword(email, pass)
        .then((userCredential) => {
            userCredential.user.updateProfile({ displayName: name });
        })
        .catch((error) => alert("Signup Failed: " + error.message));
}

function handleGoogleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .catch((error) => alert("Google Login Failed: " + error.message));
}

function handlePasswordReset() {
    const email = document.getElementById('loginEmail').value;
    if(!email) return alert("Please type your email address in the box first!");

    auth.sendPasswordResetEmail(email)
        .then(() => alert("Password reset link sent to your email!"))
        .catch((error) => alert("Error: " + error.message));
}

function handleLogout() {
    auth.signOut().then(() => {
        currentUser = { name: "User", upi: "", uid: null, dpUrl: null };
        document.getElementById('dpContainer').style.backgroundImage = 'none';
        document.getElementById('dpIcon').style.display = 'block';
    });
}

// ==========================================
// 4. PROFILE SETUP & DP UPLOAD
// ==========================================
document.getElementById('dpContainer').addEventListener('click', () => {
    document.getElementById('dpInput').click(); 
});

document.getElementById('dpInput').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const dpContainer = document.getElementById('dpContainer');
            dpContainer.style.backgroundImage = `url(${e.target.result})`;
            document.getElementById('dpIcon').style.display = 'none';
            currentUser.dpUrl = e.target.result; 
        }
        reader.readAsDataURL(file);
    }
});

// Save Profile (With Anti-Freeze & Emergency Bypass)
document.getElementById('saveProfileBtn').addEventListener('click', () => {
    const upi = document.getElementById('profileUpi').value;

    if (!upi.includes('@')) {
        return alert("Please enter a valid UPI ID (e.g. name@paytm)");
    }

    if (!currentUser.uid) {
        return alert("Session lost! Please refresh the page.");
    }

    const btn = document.getElementById('saveProfileBtn');
    const originalText = btn.textContent;
    btn.textContent = "Saving to Server...";
    btn.disabled = true;

    currentUser.upi = upi;

    // EMERGENCY BYPASS: If Firebase is blocked by an adblocker or slow Wi-Fi,
    // we won't let it freeze your app. After 3 seconds, we force you in!
    let isSaved = false;
    const emergencyTimeout = setTimeout(() => {
        if (!isSaved) {
            console.warn("Database connection is slow or blocked. Bypassing to Dashboard!");
            btn.textContent = originalText;
            btn.disabled = false;
            navigateTo('dashboardScreen'); // Force entry
        }
    }, 3000);

    // Try to save to Firestore
    try {
        db.collection("users").doc(currentUser.uid).set({
            name: currentUser.name || "User",
            upi: currentUser.upi,
            dp: currentUser.dpUrl || null 
        }).then(() => {
            isSaved = true;
            clearTimeout(emergencyTimeout);
            btn.textContent = originalText;
            btn.disabled = false;
            navigateTo('dashboardScreen'); // Success!
        }).catch((error) => {
            isSaved = true;
            clearTimeout(emergencyTimeout);
            btn.textContent = originalText;
            btn.disabled = false;
            console.error("Firebase Error:", error);
            // Even if it fails, let's go to the dashboard so you can test the app!
            navigateTo('dashboardScreen'); 
        });
    } catch (err) {
        // Catches deep code errors instantly
        isSaved = true;
        clearTimeout(emergencyTimeout);
        btn.textContent = originalText;
        btn.disabled = false;
        navigateTo('dashboardScreen');
    }
});

// ==========================================
// 5. NAVIGATION & DASHBOARD
// ==========================================
function navigateTo(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');

    if (screenId === 'dashboardScreen') {
        document.getElementById('dashName').textContent = currentUser.name.split(' ')[0] || "User";
    }
    if (screenId === 'trackerScreen') {
        initChart();
    }
}

// ==========================================
// 6. TRIP CONTRI LOGIC
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
        text: upiString,
        width: 180,
        height: 180,
        colorDark : "#0f172a",
        colorLight : "#f8fafc",
        correctLevel : QRCode.CorrectLevel.H
    });
    
    document.getElementById('qrModal').style.display = 'flex';
});

// ==========================================
// 7. EXPENSE TRACKER & CHART.JS
// ==========================================
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
