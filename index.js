const express = require('express');
const app = express();
const mysql = require('mysql2');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const fs = require('fs');
const upload = multer({ dest: 'uploads/' });

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// const setupDatabase = require('./dbsetup');
// setupDatabase();
const connection = mysql.createConnection({
    user: 'root',
    password: '123456',
    host: 'localhost',
    port: 3306,
    database:"test"
});
const query = async (sql, params = []) => {
  return connection.promise().query(sql, params);
};

// Middleware to check login status
const checkLogin = (req, res, next) => {
  if (req.cookies.login === 'true') return next();
  res.status(403).render('sign_in_page', { noaccess: '<div class="noaccess"><p>You must log in to use this feature</p></div>' });
};

// Home Route
app.get('/', (req, res) => {
  if (req.cookies.login === 'true') {
    res.redirect('/inbox/1');
  } else {
    res.render('sign_in_page', { error: "", message: "" });
  }
});

// Login Route
app.post('/', async (req, res) => {
  const { email, password } = req.body;
  let formErr = '';

  if (!email || !password) {
    formErr = 'Both email and password are required!';
    return res.render('sign_in_page', { err: formErr, params: req.body });
  }

  try {
    const [rows] = await query('SELECT email, password FROM users WHERE email = ?', [email]);
    if (rows.length > 0) {
      if (rows[0].password === password) {
        res.cookie('email', email);
        res.cookie('login', 'true');
        return res.redirect('/inbox/1');
      } else {
        formErr = 'Incorrect password!';
      }
    } else {
      formErr = 'Email not found!';
    }
  } catch (error) {
    console.error(error);
    return res.status(500).send('Server error! Try again later.');
  }

  res.render('sign_in_page', { err: formErr, params: req.body });
});
app.post('/login',async (req, res) => {
    const email = req.body.email;
    const password = req.body.password;
    const [rows] = await query('SELECT email, password FROM users WHERE email = ?', [email]);
    if (rows.length > 0) {
        if (rows[0].password === password) {
            res.cookie('email', email);
            res.cookie('login', 'true');
            return res.redirect('/inbox/1');
        } else {
            formErr = 'Incorrect password!';
        }
    } else {
        formErr = 'Email not found!';
    }

    res.render('sign_in_page', { err: formErr, params: req.body });

})

app.get('/signup', (req, res) => {
  res.render('sign_up_page', { error: "", message: "" });
});

app.post('/signup', async (req, res) => {
  const { email, password, repassword, fullname } = req.body;
  const formErr = {
    email: !email ? 'Email is required!' : undefined,
    password: password.length < 6 ? 'Password is too short!' : undefined,
    repassword: password !== repassword ? 'Passwords do not match!' : undefined,
    fullname: !fullname ? 'Full name is required!' : undefined
  };

  try {
    const [rows] = await query('SELECT email FROM users WHERE email = ?', [email]);
    if (rows.length > 0) formErr.email = 'Email already exists!';

    if (Object.values(formErr).some(Boolean)) {
      return res.render('sign_up_page', { err: formErr, params: req.body, status: '' });
    }

    await query('INSERT INTO users (fullname, password, email, inbox, outbox) VALUES (?, ?, ?, ?, ?)', [fullname, password, email, '[]', '[]']);
    const statusInfo = '<div class="success"><p>Sign up successfully!!!</p><a href="/">Sign in now</a></div>';
    res.render('sign_up_page', { err: {}, params: {}, status: statusInfo });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error! Try again later.');
  }
});

// Logout Route
app.get('/logout', (req, res) => {
  res.clearCookie('login');
  res.redirect('/');
});

// Inbox Route
app.get('/inbox/:page', checkLogin, async (req, res) => {
    try {
      const email = req.cookies.email;
      const [user] = await query('SELECT id, email, fullname FROM users WHERE email = ?', [email]);
  
      if (!user) {
        return res.status(404).send('User not found');
      }
  
      const itemsPerPage = 5;
      const currentPage = parseInt(req.params.page) || 1;
      const offset = (currentPage - 1) * itemsPerPage;
  
      const [emailList] = await query(`
        SELECT id, sender_id, recipient_id, subject
        FROM emails
        WHERE recipient_id = ?
        LIMIT ? OFFSET ?`, [user[0].id, itemsPerPage, offset]);
  
      const [totalEmails] = await query(`SELECT COUNT(*) as count FROM emails WHERE recipient_id = ?`, [user[0].id]);
      const pages = Math.ceil(totalEmails[0].count / itemsPerPage);
  
      res.render('inbox_page', {
          
        emailList,
        pages,
        currentPage,
        userInfo: user[0]
      });
    } catch (error) {
      console.error(error);
      res.status(500).send('Server error! Try again later.');
    }
      })

  

// Outbox Route
app.get('/outbox/:page', checkLogin, async (req, res) => {
    try {
      const email = req.cookies.email;
      const [user] = await query('SELECT id, email, fullname FROM users WHERE email = ?', [email]);
      const userId = user[0].id;

      const page = parseInt(req.params.page, 10) || 1;
      const itemsPerPage = 5;
      const offset = (page - 1) * itemsPerPage;
  
      const [emailList] = await query(`
        SELECT id, recipient_id, subject
        FROM emails
        WHERE sender_id = ?
        LIMIT ? OFFSET ?`, [userId, itemsPerPage, offset]);
  
      const [totalEmails] = await query(`SELECT COUNT(*) as count FROM emails WHERE sender_id = ?`, [userId]);
      const pages = Math.ceil(totalEmails[0].count / itemsPerPage);
  
      res.render('outbox_page', {
        userInfo: user[0],
        emailList,
        pages,
        currentPage: page
      });
    } catch (error) {
      console.error(error);
      res.status(500).send('Server error! Try again later.');
    }
  });
  

// Compose Route
app.get('/compose', checkLogin, async (req, res) => {
    try {
      const email = req.cookies.email;
      const [user] = await query('SELECT id, email, fullname FROM users WHERE email = ?', [email]);
      const [recipients] = await query('SELECT id, email FROM users');
      res.render('compose_page', {
        userInfo: user[0],
        recipients,
        err: '',
        status: '',
        params: { subject: '', body: '' }
      });
    } catch (error) {
      console.error(error);
      res.status(500).send('Server error! Try again later.');
    }
  });
  

  app.post('/compose', upload.single('file'), async (req, res) => {
    console.log(req.body);
    const { sender, recipient, subject = '(no subject)', body = '' } = req.body;
    const filePath = req.file ? `uploads/${req.file.originalname}` : '';
    const err = !recipient ? 'Recipient is required!' : '';

    const [user] = await query('SELECT id, email, fullname FROM users WHERE id = ?', [sender]);
    const userInfo = user[0];

    if (err) {
        const [recipients] = await query('SELECT id, email FROM users');
        return res.render('compose_page', {
            userInfo,
            err,
            status: '',
            params: req.body,
            recipients
        });
    }

    try {
        if (filePath) fs.renameSync(req.file.path, filePath);

        const [email] = await query(
            'INSERT INTO emails (sender_id, recipient_id, subject, body, file) VALUES (?, ?, ?, ?, ?)',
            [sender, recipient, subject, body, filePath]
        );
        await updateUserInboxOutbox(sender, recipient, email.insertId);

        const [recipients] = await query('SELECT id, email FROM users');
        res.render('compose_page', {
            userInfo,
            err: '',
            status: '<div class="success">Email sent successfully!</div>',
            params: { subject: '', body: '' }, // Clear form fields after successful submission
            recipients
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error! Try again later.');
    }
});



function paginateItems(items, page, pageSize) {
  const totalPages = Math.ceil(items.length / pageSize);
  const offset = (page - 1) * pageSize;
  return { items: items.slice(offset, offset + pageSize), totalPages };
}

async function updateUserInboxOutbox(sender, recipient, emailId) {
  const [senderOutbox] = await query('SELECT outbox FROM users WHERE id = ?', [sender]);
  const [recipientInbox] = await query('SELECT inbox FROM users WHERE id = ?', [recipient]);

  const updatedSenderOutbox = JSON.parse(senderOutbox[0].outbox || '[]').concat(emailId);
  const updatedRecipientInbox = JSON.parse(recipientInbox[0].inbox || '[]').concat(emailId);

  await query('UPDATE users SET outbox = ? WHERE id = ?', [JSON.stringify(updatedSenderOutbox), sender]);
  await query('UPDATE users SET inbox = ? WHERE id = ?', [JSON.stringify(updatedRecipientInbox), recipient]);
}

app.listen(8000, () => console.log('Server running on http://localhost:8000'));

