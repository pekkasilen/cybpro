const express = require("express");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");
const port = 8000;
const path = __dirname+'/app/build/';
app.use(express.static(path));
app.use(express.json());
app.use(cors());

//some constants
const register = `INSERT INTO account (name,password,balance) VALUES (?,?,?)`;
const login = `SELECT * FROM account WHERE name=?`
const getAll = `SELECT * FROM account`;
const deposit = `UPDATE account SET balance=? WHERE id=?`
const serverSecret = "hulabaloo";


const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database(':memory:',(err)=>{
    db.run(`CREATE TABLE account (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, password TEXT, balance INTEGER)`)
});

/*const db = new sqlite3.Database('./dataa.db', (err)=>{
    console.log(err)
    if(!err){
        try{
            db.run(`CREATE TABLE account (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, password TEXT, balance INTEGER)`)
        } catch{
            console.log("error on creating table")
        }
    }
})*/



app.listen(port,()=> {
    console.log(`listening port: ${port}`)
})

const bcrypt = require('bcrypt');

const generateAccessToken = (username) => {
    return jwt.sign(username, serverSecret);
}

app.post("/register", async (req,res)=>{
    console.log("registering:", req.body)
    db.run(register, [req.body.username, await bcrypt.hash(req.body.password,5),req.body.balance], (err,rows)=>{
        if(err){
            console.log(err.message);
        } else{
            console.log("register successful");
            res.status(200).send("register successful");
        }
        
    })
})

app.post("/login", async (req,res)=>{
    console.log("Loggin in: ",req.body.username);
    db.get(login, [req.body.username], async (err,row)=>{
        //let loginPassword = await bcrypt.hash(req.body.password,5);
        console.log("comparing: ",await bcrypt.compare(req.body.password, row.password))
        if(await bcrypt.compare(req.body.password, row.password)){
            console.log(row.name,"has logged in");
            res.send(generateAccessToken(req.body.username))
        } else{
            res.status(401).send("unauthorized");
        }
        
    })
})

app.get("/userdetails", async (req,res)=> {
    let userQueryingForBalance = req.body.username;
    let q = "SELECT * FROM account WHERE name=\""+req.body.username;
    console.log("q",q)
    db.all(q, (err,row)=>{
        if(!err){
            console.log(row)
            res.send(row);
        } else {
            console.log(err)
            res.send(err);
        }
    })
})

app.get("/balance", async (req,res)=>{
    let userQueryingForBalance = jwt.verify(req.headers["authorization"].split(" ")[1], serverSecret);
    db.get(login, [userQueryingForBalance], async (err,row)=>{
        if(err){
            res.send("Database error")
        } else{
            console.log(row);
            res.send(""+row.balance);
        }
    })
})

app.post("/deposit", async (req,res)=>{
    let receiver = jwt.verify(req.headers["authorization"].split(" ")[1], serverSecret);
    db.get(login, [receiver], async (err,row)=>{
        if(err){
            res.send("Database error")
        } else{
            //tähän nyt se deposit-osa
            db.run(deposit, [(parseInt(req.body.amount)+row.balance), row.id]);
            res.send(""+row.balance);
        }
    })
})

app.post("/withdraw", async (req,res)=>{
    let receiver = jwt.verify(req.headers["authorization"].split(" ")[1], serverSecret);
    db.get(login, [receiver], async (err,row)=>{
        if(err){
            res.send("Database error")
        } else{
            //tähän nyt se deposit-osa
            db.run(deposit, [row.balance-(parseInt(req.body.amount)), row.id]);
            res.send(""+row.balance);
        }
    })
})

app.post("/transfer", async (req,res)=>{
    let sender = jwt.verify(req.headers["authorization"].split(" ")[1], serverSecret);
    let receiver = req.body.receiver;
    db.get(login, [sender], async (err,rowSend)=>{
        if(err){
            res.send("Database error")
        } else{
            db.get(login,[receiver], async (err, rowReceive)=>{
                db.run(deposit, [rowSend.balance-(parseInt(req.body.amount)), rowSend.id]);
                db.run(deposit, [rowReceive.balance+(parseInt(req.body.amount)), rowReceive.id]);
            })
            res.status(200).send("transferred");
        }
    })
})



app.get("/getall", (req,res)=>{
    console.log("getting all")
    db.all(`SELECT * FROM account`, (err,rows)=>{
        console.log(rows);
        res.send(rows)
    })
})
