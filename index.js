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

async function run() {
    try {
        await client.connect();
        // console.log('db connected')
        const toolsCollection = client.db('tools-manufacturer').collection('tools');
        const userCollection = client.db('tools-manufacturer').collection('users');

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