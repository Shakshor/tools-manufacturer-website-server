const express = require('express');
require('dotenv').config();
const cors = require('cors');
const app = express();
const port = 5000 || process.env.PORT

// middleware
app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
    res.send('Hello from tools manufacturer')
})

app.listen(port, () => {
    console.log(`listening  to tools manufacturer ${port}`);
})