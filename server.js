const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// KONFIGURACJA CORS - Pozwala na łączenie się z innej domeny (home.pl)
const io = new Server(server, {
    cors: {
        origin: "*", // Wpuszcza połączenia z każdej domeny. Jak wgrasz na home.pl, możesz tu wpisać swój adres np. "https://twojastrona.pl"
        methods: ["GET", "POST"]
    }
});

let users = {}; 
let drinkOrders = [];
let winRate = 20; 
const symbols = ['🍒', '🍋', '🍉', '🍇', '🔔', '💎', '7️⃣'];

// Usunęliśmy app.use(express.static) oraz app.get('/'), bo tym zajmuje się home.pl

io.on('connection', (socket) => {
    socket.emit('initData', { winRate, drinkOrders });

    socket.on('register', (data) => {
        const login = data.login.trim().toLowerCase();
        if (users[login]) {
            socket.emit('registerError', 'Login jest już zajęty!');
        } else {
            users[login] = { password: data.password, balance: 0 };
            socket.emit('registerSuccess', 'Zarejestrowano! Masz 0$. Zgłoś się do Baru.');
        }
    });

    socket.on('login', (data) => {
        const login = data.login.trim().toLowerCase();
        if (users[login] && users[login].password === data.password) {
            socket.emit('loginSuccess', { login: login, balance: users[login].balance });
        } else {
            socket.emit('loginError', 'Błędne dane logowania!');
        }
    });

    socket.on('requestSpin', (login) => {
        if (!users[login] || users[login].balance < 10) {
            socket.emit('spinError', 'Brak środków! Idź do Baru.');
            return;
        }

        users[login].balance -= 10;
        let res1, res2, res3;
        let winType = 'none'; 

        const roll = Math.floor(Math.random() * 100);
        if (roll < winRate) {
            const luckySymbol = symbols[Math.floor(Math.random() * symbols.length)];
            res1 = res2 = res3 = luckySymbol;
        } else {
            res1 = symbols[Math.floor(Math.random() * symbols.length)];
            res2 = symbols[Math.floor(Math.random() * symbols.length)];
            res3 = symbols[Math.floor(Math.random() * symbols.length)];
            if (res1 === res2 && res2 === res3) {
                res3 = symbols[(symbols.indexOf(res3) + 1) % symbols.length]; 
            }
        }

        if (res1 === res2 && res2 === res3) {
            if (res1 === '7️⃣') {
                winType = 'jackpot';
                const order = { id: Date.now(), user: login, time: new Date().toLocaleTimeString() };
                drinkOrders.push(order);
                io.emit('newDrinkOrder', drinkOrders); 
            } else {
                winType = 'normal';
                users[login].balance += 100;
            }
        }

        socket.emit('spinResult', { res1, res2, res3, winType, newBalance: users[login].balance });
        io.emit('balanceUpdate', { login: login, balance: users[login].balance });
    });

    socket.on('adminAddCredits', (data) => {
        const login = data.login.trim().toLowerCase();
        if (users[login]) {
            users[login].balance += data.amount;
            socket.emit('adminCreditSuccess', `Dodano ${data.amount}$ dla: ${login}`);
            io.emit('balanceUpdate', { login: login, balance: users[login].balance }); 
        } else {
            socket.emit('adminError', 'Nie znaleziono gracza!');
        }
    });

    socket.on('updateWinRate', (rate) => {
        winRate = rate;
        io.emit('winRateUpdated', winRate); 
    });

    socket.on('completeOrder', (id) => {
        drinkOrders = drinkOrders.filter(o => o.id !== id);
        io.emit('drinkOrdersUpdate', drinkOrders); 
    });
});

// Zmiana portu pod chmurę - Render/Replit wymagają process.env.PORT
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend xProjectSlot działa na porcie ${PORT}`);
});