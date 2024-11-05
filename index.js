const express = require('express');
const app = express();
const mysql = require('mysql2');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const fs = require('fs');

app.set('view engine', 'ejs');
app.use(express.urlencoded({extended: true}));
app.use(cookieParser());
const uplpoad = multer({dest: 'uploads/' });
const connection = mysql.createConnection({
    user: 'wpr',
    password: 'fit2024',
    host: 'localhost',
    port: 3306
});

app.get('/', (req, res) => {
    if(req.cookies.login ==='true') {
        res.redirect('/inbox/1')
    } else {
        res.render('sign_in_page');
    }
});

app.post('/', async (req, res) => {
    let email = req.body.email;
    let password = req.body.password;
    let params = {
        'email': email,
        'password': password
    }
    let extractUserInfo = `SELECT email, password FROM users WHERE email = ?`;
    let formErr = '';
    if ((email == undefined || email === '') || (password === undefined || password === '')) {
        formErr = 'You must fill in both email and password!!!';
    } else {
        try {
            let [row] = await connection.promise().query(extractUserInfo, [email]);
            if (row.length > 0) {
                if (row[0]['password'] === password) {
                    res.cookie('email', email);
                    res.cookie('login', 'true');
                    res.redirect('/inbox/1');
                    return;
                } else {
                    formErr = 'Wrong Password!!!';
                }
            } else {
                formErr = 'Your username does not exist!!!';
            }
        } catch (error) {
            console.log(error);
            res.status(500).send('Something went wrong in server!!! Try again later.');
            return;
        }
    }
    res.render('sign_in_page', {
        err: formErr,
        params: params
    })
})


app.get('/signup', (req, res) => {
    res.render('sign_up_page');
})

app.post('/signup', async (req, res) => {
    let email = req.body.email;
    let password = req.body.password;
    let repassword = req.body.repassword;
    let fullname = req.body.fullname;
    let checkDuplicateEmail = `SELECT email FROM users WHERE email = ?`;
    let insertUser = `INSERT INTO users (fullname, password, email, inbox, outbox) VALUES (?, ?, ?, ?, ?)`;
    let validInfo = true;
    let statusInfo = '';
    let params = {
        'email': email,
        'password': password,
        'repassword': repassword,
        'fullname': fullname,   
    }
    let forErr = {
        'email': undefined,
        'password': undefined,
        'repassword': undefined,
        'fullname': undefined,
        'email-existed': undefined,
        'short-password': undefined,
        'password-not-match': undefined,
    };
    for (let param in params) {
        if(params[params] === undefined || params[param] === '') {
            formErr[param] = 'You must fill in this fields!!!'
        }
    }
    let [row] = await connection.promise().query(checkDuplicateEmail, [email]);
    if (Object.keys(row).length !== 0) {
        formErr['email-existed'] = 'The email address is already used!!!'
    }
    if(password.length < 6) {
        formErr['short-password'] = 'Password is too short!!!';
    }
    if(password !== repassword) {
        formErr['password-not-match'] = 'The password you re-entered not match!!!';
    }
    for(let err in formErr) {
        if(formErr[err] !== undefined) {
            validInfo = false;
        }   
    }
    if (validInfo === true) {
        let [row] = await connection.promise().query(insertUser, [fullname, password, email, '[]', '[]']);
        statusInfo = '<div class="success"><p>Sign up successfully!!!</p><a href="/">Sign in now</a></div>';
    }
    res.render('sign_up_page', {
        err: formErr,
        params: req.body,
        status: statusInfo
    });
});

app.get('/logout', (req, res) => {
    res.cookie('login', 'false');
    res.redirect('/');
});

app.get('/inbox/:page', async (req, res) => {
    if(req.cookies.login !== 'true') {
        res.status(403).render('sign_in_page', {
            noaccess: '<div class="noaccess"><p>You Must Log in to Use Email</p></div>'
        })
    } else {
        let email = req.cookies.email;
        let extractUserInfo = `SELECT email, fullname, inbox, outbox FROM users WHERE email = '${email}'`;
        let extractInbox = `SELECT id, sender_id, subject, date_format(created_at, "%d/%m/%Y %H:%i") AS created_at FROM emails WHERE id = ?`;
        let [row] = await connection.promise().query(extractUserInfo);
        let inboxes = JSON.parse(row[0]['inbox']);
        if(inboxes == undefined) {
           inboxes = [];
    }

    let inboxesList = [[]];
        for (let i = inboxes.length - 1; i >= 0; i--) {
            let [ib] = await connection.promise().query(extractInbox, inboxes[i]);
            let [sender] = await connection.promise().query(`SELECT fullname FROM users WHERE id = '${ib[0]['sender_id']}'`);
            let mail = {
                'id': ib[0]['id'],
                'sender': sender[0]['fullname'],
                'subject': ib[0]['subject']=== '' ? "(No Subject)" : ib[0]['subject'],
                'time': ib[0]['created_at']
            }
            addToPage(mail);
            function addToPage(anEmail) {
                if (inboxesList[inboxesList.length - 1].length < 5) {
                    inboxesList[inboxesList.length - 1].push(anEmail);
                } else {
                    inboxesList.push([]);
                    inboxesList[inboxesList.length - 1].push(anEmail)
        
                }
            }
            }
            res.render('inbox_page', {
                userInfo: row[0],
                emailList: inboxesList[req.params.page - 1],
                pages: inboxesList.length,
                currentPage: req.params.page
            });
    }
});

app.get('/outbox/:page', async (req, res) => {
    if(req.cookies.login !== 'true') {
        res.status(403).render('sign_in_page', {
            noaccess: '<div class="noaccess"><p>You Must Log in to Use Email</p></div>'
        })
    }
    else {
        let email = req.cookies.email;
        let extractUserInfo = `SELECT email, fullname, inbox, outbox FROM users WHERE email = '${email}'`;
        let extractInbox = `SELECT id, recipient_id, subject, date_format(created_at, "%d/%m/%Y %H:%i") AS created_at FROM emails WHERE id = ?`;
        let [row] = await connection.promise().query(extractUserInfo);
        let inboxes = JSON.parse(row[0]['outbox']);
        if(inboxes == undefined) {
            inboxes = [];
        }
        let inboxesList = [[]];
        for (let i = inboxes.length - 1; i >= 0; i--) {
            let [ib] = await connection.promise().query(extractInbox, inboxes[i]);
            let [recipient] = await connection.promise().query(`SELECT fullname FROM users WHERE id = '${ib[0]['recipient_id']}'`);
            let mail = {
               'id': ib[0]['id'],
               'recipient': recipient[0]['fullname'],
               'subject': ib[0]['subject']=== '' ? "(No Subject)" : ib[0]['subject'],
               'time': ib[0]['created_at']
            }
            addToPage(mail);
            function addToPage(anEmail) {
                if (inboxesList[inboxesList.length - 1].length < 5) {
                    inboxesList[inboxesList.length - 1].push(anEmail);
                } else {
                    inboxesList.push([]);
                    inboxesList[inboxesList.length - 1].push(anEmail)
        
                }
            }
            }
            res.render('outbox_page', {
                userInfo: row[0],
                emailList: inboxesList[req.params.page - 1],
                pages: inboxesList.length,
                currentPage: req.params.page
            });
    }
})

app.post('/delete', async (req, res) => {
    let source = req.body.source;
    let userEmail = req.body.userEmail;
    let emailToDelete = JSON.parse(req.body.emailToDelete);
    let extractEmailInbox = `SELECT inbox FROM users WHERE email = ?`
    let extractEmailOutbox = `SELECT outbox FROM users WHERE email = ?`
    let updateInboxAfterDelete = `UPDATE users
    SET inbox = ?
    WHERE email = ?`
    let updateOutboxAfterDelete = `UPDATE users
    SET outbox = ?
    WHERE email = ?`
    if (source == 'inbox') {
        let [emailList] = await connection.promise().query(extractEmailInbox, [userEmail]);
        let emailArr = JSON.parse(emailList[0][source]);
        for(let i = 0; i < emailToDelete.length; i++) {
            if (emailArr.indexOf(parseInt(emailToDelete[i])) > -1) {
                emailArr.splice(emailArr.indexOf(parseInt(emailToDelete[i])), 1)
            }
        }
        await connection.promise().query(updateInboxAfterDelete, [JSON.stringify(emailArr), userEmail]);
        res.send("The email(s) was deleted successfully!!!")
    } else {
        let [emailList] = await connection.promise().query(extractEmailOutbox, [userEmail]);
        let emailArr = JSON.parse(emailList[0][source]);
        for(let i = 0; i < emailToDelete.length; i++) {
            if (emailArr.indexOf(parseInt(emailToDelete[i])) > -1) {
                emailArr.splice(emailArr.indexOf(parseInt(emailToDelete[i])), 1)
            }
        }
        await connection.promise().query(updateOutboxAfterDelete, [JSON.stringify(emailArr), userEmail]);
        res.send("The email(s) was deleted successfully!!!")
    }
})

app.get('/compose', async (req, res) => {
    if(req.cookies.login !== 'true') {
        res.status(403).render('sign_in_page', {
            noaccess: '<div class="noaccess"><p>You Must Log in to Use Email</p></div>'
        })
    } else {
        let email = req.cookies.email;
        let extractUserInfo = `SELECT id, email, fullname, inbox, outbox FROM users WHERE email = '${email}'`;
        let extractRecipentInfo = `SELECT id, email FROM users`;
        let [user] = await connection.promise().query(extractUserInfo);
        let [recipients] = await connection.promise().query(extractRecipentInfo);
        res.render('compose_page', {
            userInfo: user[0],
            recipients: recipients
        })
    }
})

app.post('/compose', upload.single('file'), async ( req, res) => {
    let sender = req.body.sender;
    let recipient = req.body.recipient;
    let subject = req.body.subject;
    let body = req.body.body;
    let filePath = '';
    let err = '';
    let status = '';
    let params = {
        'subject': subject,
        'body': body
    };
    if (recipient == 0) {
        err = 'Please select an email to send';
    } else {
        let createNewMail = `INSERT INTO emails (sender_id, recipient_id, subject, body, file) VALUES (?, ?, ?, ?, ?)`
       if (subject === undefined || subject === '') {
           subject = '(no subject)';
       }
       if (body === undefined) {
           body = '';
       }
       if(req.file) {
            fs.rename(req.file.path, 'uploads/' + req.file.originalname, (err) => {
                if (err) {
                console.error('Error renaming file:', err);
                res.sendStatus(500);
                return;
                }
            })
            filePath = `uploads/${req.file.originalname}`;
        }   
        let [email] = await connection.promise().query(createNewMail, [parseInt(sender), parseInt(recipient), subject, body, filePath])
        //Update sender's outbox
        let [senderOutbox] = await connection.promise().query(`SELECT outbox FROM users WHERE id = ${parseInt(sender)}`);
        let outbox = JSON.parse(senderOutbox[0]['outbox']);
        outbox.push(email.insertId);
        await connection.promise().query(`UPDATE users SET outbox = '${JSON.stringify(outbox)}' WHERE id = ${parseInt(sender)}`)
        //Update recipient's inbox
        let [recipientInbox] = await connection.promise().query(`SELECT inbox FROM users WHERE id = ${parseInt(recipient)}`);
        let inbox = JSON.parse(recipientInbox[0]['inbox']);
        inbox.push(email.insertId);
        await connection.promise().query(`UPDATE users SET inbox = '${JSON.stringify(inbox)}' WHERE id = ${parseInt(recipient)}`);
        status = `<div class="success"><p>Email sent successfully!!!</p></div>`;
    }
    //get basic info for redirect
    let useremail = req.cookies.email;
    let extractUserInfo = `SELECT id, email, fullname, inbox, outbox FROM users WHERE email = '${useremail}'`;
    let extractRecipentInfo = `SELECT id, email FROM users`;
    let [user] = await connection.promise().query(extractUserInfo);
    let [recipients] = await connection.promise().query(extractRecipentInfo);
    res.render('compose_page', {
        userInfo: user[0],
        recipients: recipients,
        status: status,
        err: err,
        params: params
    });
    return
})

app.get('/details/:id', async (req, res) => {
    if(req.cookies.login !== 'true') {
        res.status(403).render('sign_in_page', {
            noaccess: '<div class="noaccess"><p>You Must Log in to Use Email</p></div>'
        })
        return
    }
    let useremail = req.cookies.email;
    let extractUserInfo = `SELECT id, email, fullname FROM users WHERE email = ?`;
    let extractUserInfoById = `SELECT id, email, fullname FROM users WHERE id = ?`;
    let extractEmailContent = `SELECT * FROM emails WHERE id = '${req.params.id}'`;
    let [user] = await connection.promise().query(extractUserInfo, [useremail]);
    let [content] = await connection.promise().query(extractEmailContent);
    let [senderInfo] = await connection.promise().query(extractUserInfoById, [content[0]['sender_id']]);
    let [recipientInfo] = await connection.promise().query(extractUserInfoById, [content[0]['recipient_id']]);
    let contactData = {
        'sender_email': senderInfo[0].email,
        'sender_fullname': senderInfo[0].fullname,
        'recipient_email': recipientInfo[0].email,
        'recipient_fullname': recipientInfo[0].fullname
    }
    res.render('details_page', {
        userInfo: user[0], 
        content: content[0],
        contactData: contactData
    })
})

app.get('/download/', (req, res) => {
    let filePath = req.query.filePath;
    res.download(filePath, (err) => {
        if (err) {
          console.error('Error downloading file:', err);
          res.sendStatus(404);
        }
      });
})

app.use(express.static('views'));
app.listen(8000)