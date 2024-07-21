const express = require("express")
const mongoose = require("mongoose")
const { Router } = require("express")
const router = Router()
const app = express()
const bodyParser = require("body-parser")
const cors = require("cors")
const Schema = mongoose.Schema
const bcrypt = require("bcryptjs")
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

const Account = new Schema({
  admin: { type: Boolean, default: false },
  subscription: { type: String, default: "free" },
  name: { type: String, required: true },
  email: { type: String, required: true },
  username: { type: String, required: true },
  password: { type: String, min: 6, max: 1024, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
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
  const salt = await bcrypt.genSalt(10)
  const hashedPassword = await bcrypt.hash(req.body.password, salt)

  const account = await new Account({
    username: req.body.username,
    email: req.body.email,
    password: hashedPassword,
  })

  await account.save()
  return res.status(201).json({
    success: true,
    message: "Account created",
  })
})

const signin = async (req, res) => {
  activeAccount = await Account.findOne({ username: req.body.username })
  !activeAccount && res.status(400).json("Wrong credentials")

  const validPassword = await bcrypt.compare(
    req.body.password,
    activeAccount.password
  )
  !validPassword && res.status(400).json("Wrong credentials")

  activeAccount.password = undefined

  res.status(200).json({ success: true, data: activeAccount })
}

const verify = async (req, res) => {
  const verified = await Account.validate({
    email: req.body.email,
    password: req.body.password,
  })
  if (!verified)
    throw {
      success: false,
      message: "Wrong credentials",
    }
  return res.status(200).json({ success: true, data: verified })
}

const updateAccount = handleCallback(async ({ body, params }, res) => {
  const { id } = params

  if (req.body.id === id) {
    if (req.body.password) {
      const salt = await bcrypt.genSalt(10)
      body.password = await bcrypt.hash(body.password, salt)
    }
    const account = await Account.findByIdAndUpdate(id, { $set: req.body })
    return res.status(200).json({ success: true, message: "Account updated" })
  } else {
    throw new Error("Unauthorized")
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
router.post("/signin", signin)
router.post("/verify", verify)
router.get("/account/:id", getAccount)
router.put("/account/:id", updateAccount)
router.post("/account/create", createAccount)
router.delete("/account/:id", deleteAccount)

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`)
})
