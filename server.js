const https = require('https');
const http = require('http');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const mysql = require('mysql')
const myconn = require('express-myconnection')
const routes = require('./routes')
const app = express()
require('dotenv').config();

app.set('port', process.env.PORT || 9500)

const dboptions ={
     host: 'localhost'
    ,port: 3306
    ,user: 'root'
    ,password: ''
    ,database: 'GUINWIN'
}
 
// middlewares -------------------------------------------
app.use(myconn(mysql, dboptions, 'single'))
app.use(express.json())
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
  });

// routes ------------------------------------------------
app.get('/', (req, res)=>{
    res.send('Welcome to my API')
})

app.use(cors()); 
app.use('/api', routes)

const privateKey = fs.readFileSync('private-key.pem', 'utf8');
const certificate = fs.readFileSync('certificate.pem', 'utf8');
const credentials = {
    key: privateKey,
    cert: certificate,
    passphrase: '1234' // Agrega la contraseña aquí
};
const httpsServer = https.createServer(credentials, app);
//const httpsServer = http.createServer(app);

// sever running -----------------------------------------
httpsServer.listen(process.env.PORT , ()=>{
    console.log('server running on port', process.env.PORT)
})
