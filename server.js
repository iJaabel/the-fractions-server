const express = require("express")
const mongoose = require("mongoose")
const { Router } = require("express")
const router = Router()
const app = express()
const bodyParser = require("body-parser")
const cors = require("cors")
const Schema = mongoose.Schema
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

const Account = new Schema(
  {
    admin: { type: Boolean, default: false },
    subscription: { type: String, default: "free" },
    name: { type: String, required: true },
    email: { type: String, required: true },
    username: { type: String, required: true },
    password: { type: String, min: 6, max: 1024, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
)
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.8q6kx.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})

// --- MIDDLEWARE ---

app.use(
  cors({
    origin: "*",
  })
)
app.use(bodyParser.json())
app.use(express.json())

// --- UTILITIES ---

const handleCallback = (callback) => async (req, res, next) => {
  try {
    await callback(req, res, next)
  } catch (error) {
    next(error)
  }
}

// --- CONTROLLERS ---

const createAccount = handleCallback(async (req, res) => {
  const account = new Account(req.body)
  await account.save()
  return res.status(201).json({
    success: true,
    data: account,
  })
})

const updateAccount = handleCallback(async ({ body, params }, res) => {
  console.log("starting update \n")
  console.log("update obj: \n", body)

  const { id } = params
  const account = await Account.findByIdAndUpdate(id, body, {
    new: true,
    returnDocument: "after",
  })

  if (account) {
    console.log("success \n", account)
    return res.status(200).json({ success: true, data: account })
  }
})

const deleteAccount = handleCallback(async (req, res) => {
  const { id } = req.params
  const deleted = await Account.findByIdAndDelete(id)
  if (deleted) {
    return res
      .status(200)
      .json({ success: true, data: deleted, Message: "Account deleted" })
  }
  throw new Error("Account not found")
})

const getAccount = handleCallback(async (req, res) => {
  console.log(req.params)
  const { id } = req.params
  const account = await Account.findById(id)
  if (account) {
    return res.status(200).json({ success: true, data: account })
  }
  throw new Error("Account not found")
})

// --- ROUTES ---

router.get("/", (res, req) => res.json("base api endpoint"))
router.get("/account/:id", getAccount)
router.get("/account/:id/chatflow", getChatflowsByAccount)

router.put("/account/:id", updateAccount)
router.put("/account/:id/store/", chatStoreInAccount)

router.post("/account/create", createAccount)

router.delete("/account/:id", deleteAccount)

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`)
})
