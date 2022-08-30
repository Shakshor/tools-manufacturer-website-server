const express = require('express');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { application } = require('express');
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
        const paymentCollection = client.db('tools-manufacturer').collection('payments');
        const orderCollection = client.db('tools-manufacturer').collection('orders');
        const reviewCollection = client.db('tools-manufacturer').collection('reviews');


        // verify admin middleware 
        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const query = { email: requester };
            // const requesterAccount = await userCollection.findOne({ email: requester })
            const requesterAccount = await userCollection.findOne(query);
            if (requesterAccount.role === 'admin') {
                next();
            }
            else {
                return res.status(403).send({ message: 'forbidden access' })
            }
        }

        // ---------- product api ----------
        // load the product api
        app.get('/product', async (req, res) => {
            const query = {};
            const cursor = toolsCollection.find(query);
            const products = await cursor.toArray();
            res.send(products);
        });

        // load the single product data
        app.get('/product/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const product = await toolsCollection.findOne(query);
            res.send(product);
        });

        // POST product
        app.post('/product', verifyJWT, verifyAdmin, async (req, res) => {
            const product = req.body;
            const result = await toolsCollection.insertOne(product);
            res.send(result);
        })

        // DELETE  specific product
        app.delete('/product/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await toolsCollection.deleteOne(query);
            res.send(result);
        });



        // ---------- all orders api ------------
        // load all orders
        app.get('/allOrders', verifyJWT, verifyAdmin, async (req, res) => {
            const query = {};
            const cursor = orderCollection.find(query);
            const allOrders = await cursor.toArray();
            res.send(allOrders);
        });

        // update specific order from all orders
        app.put('/allOrders/:id', async (req, res) => {
            const id = req.params.id;
            const updatedStatus = req.body;
            // console.log(id, updatedStatus);
            const filter = { _id: ObjectId(id) };
            const options = { upsert: true };
            const updatedDoc = {
                $set: {
                    status: updatedStatus.update,
                }
            }
            const updatedOrder = await orderCollection.updateOne(filter, updatedDoc, options);
            const updatedPayment = await paymentCollection.updateOne(filter, updatedDoc, options);
            res.send(updatedOrder);
        });

        // DELETE  specific product
        app.delete('/allOrders/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await orderCollection.deleteOne(query);
            res.send(result);
        });



        // ------------- orders api -----------------
        // load specific user orders
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

        });

        // load specific order
        app.get('/orders/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const order = await orderCollection.findOne(query);
            res.send(order);
        });

        // POST user orders
        app.post('/orders', async (req, res) => {
            const order = req.body;
            const result = await orderCollection.insertOne(order);
            res.send(result);
        });

        // update specific order
        app.patch('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId,
                    status: payment.status,
                }
            }

            const result = await paymentCollection.insertOne(payment);
            const updatedOrder = await orderCollection.updateOne(filter, updatedDoc);
            res.send(updatedOrder);
        });

        // DELETE specific order
        app.delete('/orders/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await orderCollection.deleteOne(query);
            res.send(result);
        });




        // ----------- users api -------------
        // load all users
        app.get('/user', verifyJWT, async (req, res) => {
            // const user = req.body;
            const users = await userCollection.find().toArray();
            res.send(users);
        });

        // update user role as admin(If login user is admin,then make selected user an admin)
        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            // const options = { upsert: true };
            // options is not needed. Also do not need to insert user.
            const updateDoc = {
                $set: { role: 'admin' }
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);



        })

        // upsert user
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body; // for update doc sending
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const newToken = jwt.sign({ email: email }, process.env.DB_TOKEN_SECRET, { expiresIn: '24d' })
            res.send({ result, newToken });
        });


        // load or find user === admin ? true : false
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;

            // --- alternative process for find -----
            // const query = {email: email};
            // const user  =await userCollection.findOne(query);

            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin'; // isAdmin is a boolean value
            res.send({ admin: isAdmin });
        });




        // ----------------- review api -----------
        // load all reviews
        app.get('/review', async (req, res) => {
            const query = {};
            const cursor = reviewCollection.find(query);
            const reviews = await cursor.toArray();
            res.send(reviews);
        });

        // POST review
        app.post('/review', async (req, res) => {
            const review = req.body;
            // console.log(review);
            const result = await reviewCollection.insertOne(review);
            res.send(result);
        })




        // -------------- create payment api ---------------
        // paymentIntent POST api
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            // const {price} = req.body; // directly destructure  
            //  price from body (OR) -------
            const service = req.body;
            const price = service.price;
            // console.log(price);
            const amount = price * 100; // price must be in paisa

            // creating paymentIntent
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret })
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