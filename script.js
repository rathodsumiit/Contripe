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
let currentUser = { name: "User", upi: "", uid: null };
let contriExpenses = [];
let trackerData = { "Food": 0, "Travel": 0, "Stay": 0, "Misc": 0 };
let expenseChart; 
let qrCodeInstance = null;

// ==========================================
// 3. AUTHENTICATION LOGIC (Direct Routing)
// ==========================================

// Global Listener (Keeps you logged in if you refresh, boots you to login if not)
auth.onAuthStateChanged((user) => {
    if (!user) {
        navigateTo('loginScreen');
    }
});

// Helper function to check DB and move screens instantly
function checkUserAndNavigate(user) {
    db.collection("users").doc(user.uid).get()
        .then((doc) => {
            if (doc.exists && doc.data().upi) {
                currentUser.upi = doc.data().upi;
                navigateTo('dashboardScreen');
            } else {
                document.getElementById('profileName').value = currentUser.name;
                navigateTo('profileScreen');
            }
        })
        .catch((error) => {
            console.error("DB Error:", error);
            document.getElementById('profileName').value = currentUser.name;
            navigateTo('profileScreen'); // Move forward even if DB fails
        });
}

function handleEmailLogin() {
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    if(!email || !pass) return alert("Please enter email and password.");

    auth.signInWithEmailAndPassword(email, pass)
        .then((userCredential) => {
            // SUCCESS! Force the screen to change
            currentUser.name = userCredential.user.displayName || "User";
            currentUser.uid = userCredential.user.uid;
            checkUserAndNavigate(userCredential.user);
        })
        .catch((error) => alert("Login Failed: " + error.message));
}

function handleSignup() {
    const email = document.getElementById('signupEmail').value;
    const pass = document.getElementById('signupPassword').value;
    const name = document.getElementById('signupName').value;

    if(!email || !pass || !name) return alert("Please fill all fields.");

    auth.createUserWithEmailAndPassword(email, pass)
        .then((userCredential) => {
            // Give the user a name, then instantly force the screen change
            userCredential.user.updateProfile({ displayName: name }).then(() => {
                currentUser.name = name;
                currentUser.uid = userCredential.user.uid;
                document.getElementById('profileName').value = name;
                navigateTo('profileScreen'); 
            });
        })
        .catch((error) => alert("Signup Failed: " + error.message));
}

function handleGoogleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then((result) => {
            // SUCCESS! Force the screen to change
            currentUser.name = result.user.displayName || "User";
            currentUser.uid = result.user.uid;
            checkUserAndNavigate(result.user);
        })
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
        currentUser = { name: "User", upi: "", uid: null };
        navigateTo('loginScreen');
    });
}

// ==========================================
// 4. PROFILE SETUP & FIRESTORE
// ==========================================
document.getElementById('saveProfileBtn').addEventListener('click', () => {
    const upi = document.getElementById('profileUpi').value;

    if (!upi.includes('@')) {
        alert("Please enter a valid UPI ID (e.g. name@paytm)");
        return;
    }

    currentUser.upi = upi;

    // Save their UPI ID securely to the database
    if (currentUser.uid) {
        db.collection("users").doc(currentUser.uid).set({
            name: currentUser.name,
            upi: currentUser.upi
        }).then(() => {
            navigateTo('dashboardScreen');
        });
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

// Open QR Modal
document.getElementById('payBox').addEventListener('click', () => {
    let friends = parseInt(document.getElementById('friendCount').value) || 1;
    const total = contriExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    let perPerson = (total / friends).toFixed(2);

    if (perPerson <= 0) return alert("Add expenses first!");

    document.getElementById('receiverNameDisplay').textContent = currentUser.name;
    document.getElementById('modalAmountDisplay').textContent = `₹${perPerson}`;

    // Create the UPI payment link
    const upiString = `upi://pay?pa=${currentUser.upi}&pn=${currentUser.name}&am=${perPerson}&cu=INR`;
    
    // Generate QR Code dynamically
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
