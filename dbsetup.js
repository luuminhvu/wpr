// dbsetup.js
const mysql = require('mysql2/promise');

const databaseName = 'test';

const connection = mysql.createConnection({
    user: 'root',
    password: '123456',
    host: 'localhost',
    port: 3306
});

async function setupDatabase() {
    try {
        const conn = await connection;
        await conn.connect();

        console.log('Connected to MySQL');
        await conn.query(`CREATE DATABASE IF NOT EXISTS ${databaseName}`);
        console.log(`Database ${databaseName} created or already exists`);
        await conn.query(`USE ${databaseName}`);
        console.log(`Using database ${databaseName}`);
        const createUsersTable = `CREATE TABLE IF NOT EXISTS users (
            id INT PRIMARY KEY AUTO_INCREMENT,
            fullname VARCHAR(50) NOT NULL,
            password VARCHAR(100) NOT NULL,
            email VARCHAR(100) NOT NULL UNIQUE,
            inbox TEXT,
            outbox TEXT
        )`;
        await conn.query(createUsersTable);
        console.log('Users table created or already exists');
        const insertUser = `
            INSERT IGNORE INTO users (fullname, email, password) VALUES
            ('User 1', 'a@a.com', '123'),
            ('User 2', 'b@b.com', '123'),
            ('User 3', 'c@c.com', '123'),
            ('User 4', 'd@d.com', '123'),
            ('User 5', 'e@e.com', '123')
        `;
        await conn.query(insertUser);
        console.log('Default users inserted or already exist');
        const createEmailsTable = `CREATE TABLE IF NOT EXISTS emails (
            id INT PRIMARY KEY AUTO_INCREMENT,
            sender_id INT NOT NULL,
            recipient_id INT NOT NULL,
            subject VARCHAR(255),
            body TEXT,
            file VARCHAR(255),
            create_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            receiver_deleted BOOLEAN DEFAULT false,
            sender_deleted BOOLEAN DEFAULT false,
            FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
        )`;
        await conn.query(createEmailsTable);
        console.log('Emails table created or already exists');
        const insertEmails = `
            INSERT IGNORE INTO emails (sender_id, recipient_id, subject, body) VALUES
            (1, 2, 'Hello Vu2309', 'Your account is created successfully!!!'),
            (1, 3, 'Hello Haid', 'How are you?'),
            (4, 1, 'Service Rating', 'Good service'),
            (2, 3, 'Hi Vinhhv', 'This is a message from Vu to Vinhhv'),
            (5, 1, 'Initial Contact', 'Message from e@e.com to a@a.com'),
            (4, 5, 'Follow-up Contact', 'Message from d@d.com to e@e.com'),
            (2, 4, 'Where are you from?', 'I am from Vietnam'),
            (5, 3, 'What is your name?', 'My name is Vu')
        `;
        await conn.query(insertEmails);
        console.log('Default emails inserted or already exist');

        conn.end();
    } catch (err) {
        console.error("Error setting up the database:", err);
        process.exit(1);
    }
}

module.exports = setupDatabase;
