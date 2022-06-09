const express = require('express');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const cors = require('cors');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

// middleware
app.use(cors())
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nn2tw.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// verify token middleware
let verifyJWT = (req, res, next) => {
    // console.log('abc');
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.DB_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        // console.log(decoded);
        next();
    });
}



async function run() {
    try {
        await client.connect();
        // console.log('db connected')
        const toolsCollection = client.db('tools-manufacturer').collection('tools');
        const userCollection = client.db('tools-manufacturer').collection('users');
        const orderCollection = client.db('tools-manufacturer').collection('orders');

        // load the product api
        app.get('/product', async (req, res) => {
            const query = {};
            const cursor = toolsCollection.find(query);
            const products = await cursor.toArray();
            res.send(products);
        })

        // load the single product data
        app.get('/product/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const product = await toolsCollection.findOne(query);
            res.send(product);
        })

        // load my orders
        app.get('/orders', verifyJWT, async (req, res) => {
            const user = req.query.user;
            // decoded email from verifyJWT function
            const decodedEmail = req.decoded.email;
            if (user === decodedEmail) {
                const query = { user: user };
                const orders = await orderCollection.find(query).toArray();
                return res.send(orders);
            }
            else {
                return res.status(403).send({ message: 'forbidden access' })
            }

        })

        // load all users
        app.get('/user', verifyJWT, async (req, res) => {
            // const user = req.body;
            const users = await userCollection.find().toArray();
            res.send(users);
        })

        // load or find user === admin ? true : false
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;

            // --- alternative process -----
            // const query = {email: email};
            // const user  =await userCollection.findOne(query);

            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin });
        })


        // update user role as admin
        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const query = { email: requester };
            // const requesterAccount = await userCollection.findOne({ email: requester })
            const requesterAccount = await userCollection.findOne(query);
            if (requesterAccount === 'admin') {
                const filter = { email: email };
                // const options = { upsert: true };
                // options is not needed. Also do not need to insert user.
                const updateDoc = {
                    $set: { role: 'admin' }
                };
                const result = await userCollection.updateOne(filter, updateDoc);
                return res.send(result);
            }
            else {
                return res.status(403).send({ message: 'forbidden access' })
            }

        })



        // update user
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body; // for update doc sending
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.DB_TOKEN_SECRET, { expiresIn: '24h' })
            res.send({ result, token });
        })


        // POST product
        app.post('/product', async (req, res) => {
            const product = req.body;
            const result = await toolsCollection.insertOne(product);
            res.send(result);
        })

        // POST user orders
        app.post('/orders', async (req, res) => {
            const order = req.body;
            const result = await orderCollection.insertOne(order);
            res.send(result);
        })

        // DELETE specific order
        app.delete('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await orderCollection.deleteOne(query);
            res.send(result);
        })

    }
    finally {

    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello from tools manufacturer')
})

app.listen(port, () => {
    console.log(`listening  to tools manufacturer ${port}`);
})