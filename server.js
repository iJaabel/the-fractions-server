const express = require("express")
const mongoose = require("mongoose")

const app = express()
const bodyParser = require("body-parser")
const cors = require("cors")
require("dotenv/config")

const port = process.env.PORT || 8020

// --- MongoDB connection ---

// const uri = process.env.PROD_MONGODB || process.env.MONGODB_URI
// create a mongoDB new connection

const options = {}

mongoose
  .connect(uri, options)
  .then(() => console.log("Successfully connected to MongoDB."))
  .catch((e) => console.error("Connection error", e.message))

const db = mongoose.connection

db.on("error", console.error.bind(console, "MongoDB connection error:"))

// --- MIDDLEWARE ---

app.use(
  cors({
    origin: "*",
  })
)
app.use(bodyParser.json())
app.use(express.json())

// ---

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8q6kx.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})

async function run() {
  try {
    await client.connect()
    const database = client.db("the_fractions")
    const fractionsCollection = database.collection("fractions")
    const usersCollection = database.collection("users")

    app.get("/fractions", async (req, res) => {
      const cursor = fractionsCollection.find({})
      const fractions = await cursor.toArray()
      res.send(fractions)
    })

    app.get("/fractions/:id", async (req, res) => {
      const id = req.params.id
      const query = { _id: ObjectId(id) }
      const fraction = await fractionsCollection.findOne(query)
      res.send(fraction)
    })

    app.post("/fractions", async (req, res) => {
      const fraction = req.body
      const result = await fractionsCollection.insertOne(fraction)
      res.json(result)
    })

    app.put("/fractions/:id", async (req, res) => {
      const id = req.params.id
      const filter = { _id: ObjectId(id) }
      const fraction = req.body
      const option = { upsert: true }
      const updateFraction = {
        $set: {
          name: fraction.name,
          description: fraction.description,
          image: fraction.image,
          price: fraction.price,
          quantity: fraction.quantity,
        },
      }
      const result = await fractionsCollection.updateOne(
        filter,
        updateFraction,
        option
      )
      res.json(result)
    })

    app.delete("/fractions/:id", async (req, res) => {
      const id = req.params.id
      const query = { _id: ObjectId(id) }
      const result = await fractionsCollection.deleteOne(query)
      res.json(result)
    })

    app.post("/users", async (req, res) => {
      const user = req.body
      const result = await usersCollection.insertOne(user)
      res.json(result)
    })

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email
      const query = { email: email }
      const user = await usersCollection.findOne(query)
      let isAdmin = false
      if (user?.role === "admin") {
        isAdmin = true
      }
      res.json({ admin: isAdmin })
    })

    app.put("/users", async (req, res) => {
      const user = req.body
      const filter = { email: user.email }
      const options = { upsert: true }
      const updateDoc = { $set: user }
      const result = await usersCollection.updateOne(filter, updateDoc, options)
      res.json(result)
    })

    app.put("/users/admin", async (req, res) => {
      const user = req.body
      const filter = { email: user.email }
      const updateDoc = { $set: { role: "admin" } }
      const result = await usersCollection.updateOne(filter, updateDoc)
      res.json(result)
    })
  } finally {
    // await client.close();
  }
}

run().catch(console.dir)

app.get("/", (req, res) => {
  res.send("Hello World!")
})

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`)
})
