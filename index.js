const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const sqlite3 = require('sqlite3');

//Some setup
const app = express();
const db = new sqlite3.Database('./db.sqlite');
const port = 8000;
app.use(cors());
app.use(express.json());
let currentId = 4;
//balance is represented as cents, so INTEGER value is ok. Adding couple users up front.
db.serialize(()=> {
    try{
        db.run("CREATE TABLE account (id INT, name TEXT, pw TEXT, balance INT, isbanker BOOLEAN)");
    } catch{
        console.log("error creating table")
    }
    db.run("INSERT INTO account(id,name,pw,balance,isbanker) VALUES (1,'pankkiiri','pankkiirinsalasana',0, true)")
    db.run("INSERT INTO account(id,name,pw,balance,isbanker) VALUES (2,'Aapeli','aapelinsalasana',25000, false)");
    db.run("INSERT INTO account(id,name,pw,balance,isbanker) VALUES (3,'Bertta','bertansalasana',125000,false)");
    db.run("INSERT INTO account(id,name,pw,balance,isbanker) VALUES (4,'Cecilia','ceciliansalasana',765000,false)");
})

//Serversecret for generating JWT tokens
const serverSecret = "TosiSalainenSanaTassaOnkinKukaanEiVarmastiArvaa";

//some assistant functions
const hashpass = (plain) => {
    return bcrypt.hash(plain, 5);
}

const generateAccessToken = (username) => {
    return jwt.sign(username, serverSecret);
}

const checkToken =  async (req, res) => {
    let reqToken = req.headers["authorization"].split(" ")[1];
    let usernameToVerify = await jwt.verify(reqToken, serverSecret);
    console.log("usernametoverify in checktoken:",usernameToVerify)
    let queryResult = await db.get(`SELECT * FROM account WHERE name="${usernameToVerify}"`)
    console.log("queryresult in checktoken:",queryResult)
    return queryResult;
}

const nextId = () => {
    currentId += 1;
    return currentId;
}

app.get("/showdb", (req,res)=> {
    db.all(`SELECT * FROM account`, (err,row)=> {
        console.log("showdb ",row)
    })
})

//Then the endpoints: Register, Login, getBalance, makeTransfer

app.post("/register", async (req,res)=> {
    let answer = await db.run(`INSERT INTO account(id,name,pw,balance,isbanker) VALUES (${nextId()},"${req.body.username}","${hashpass(req.body.username)}",0,false)`, (err,dbres)=>{
        console.log(dbres);
    });
    console.log("await-register: ",answer)
    
    res.status(200).send('ok');
})

app.post("/login", async (req,res) => {
    db.get(`SELECT * FROM account WHERE name="${req.body.username}"`, (err,row)=> {
        console.log("login:")
        console.log(row);
        console.log(row["name"]);
        console.log(req.body.username);
        if(row["name"]===req.body.username){
            res.status(200).send(generateAccessToken(req.body.username))
        } else {
            res.status(401).send("fucked")
        }
    })
})
//deposit should only be possible for isbanker=true - users.
app.post("/deposit", async (req,res)=> {
    console.log("deposit::")
    let accountTo = checkToken(req,res);
    console.log(accountTo);
    let amount = req.body.amount;
    let currentAmount = await db.get(`SELECT * FROM account WHERE name="${accountTo}"`)
    console.log("currentAmount: ",currentAmount["balance"])
    db.run(`UPDATE account SET balance=${currentAmount["balance"]+amount} WHERE name="${accountTo}"`,(err,row)=>{
        console.log(row);
        res.status(200).send("deposit")
    })
})

app.post("/withdraw", (req,res)=> {
    let accountFrom = checkToken(req,res);
    console.log("at: ",accountFrom);
    let amount = req.body.amount;
    let currentAmount = db.get(`SELECT * FROM account WHERE name="${accountFrom}"`)["balance"]
    db.run(`UPDATE account SET balance=${currentAmount-amount} WHERE name="${accountFrom}"`,(err,row)=>{
        console.log(row);
        res.status(200).send("withdraw")
    })
})

app.post("/transfer", (req,res)=> {
    let accountFrom = req.checkToken["name"];
    let accountTo = req.body.receiver;
    let amount = req.body.amount;
    let currentAmountSender = db.get(`SELECT * FROM account WHERE name=${accountFrom}`)["balance"]
    db.run(`UPDATE account SET balance=${currentAmountSender-amount} WHERE name=${accountFrom}`,(err,row)=>{
        console.log(row);
    })
    let currentAmountReceiver = db.get(`SELECT * FROM account WHERE name=${accountTo}`)["balance"]
    db.run(`UPDATE account SET balance=${currentAmountSender+amount} WHERE name=${accountTo}`,(err,row)=>{
        console.log(row);
    })
})

app.get("/balance", async (req,res) => {
    let accountFrom = await checkToken(req,res);
    let currentAmount = await db.get(`SELECT * FROM account WHERE name="${accountFrom}"`,(err,row)=>{
        console.log("/balance row: ",row)
    })
    console.log(currentAmount["balance"])
    res.status(200).send(currentAmount["balance"]);
})


app.listen(port,()=> {
    console.log(`listening port: ${port}`)
})


