const express = require("express")
const mongoose = require("mongoose")
const app = express()
const bodyParser = require("body-parser")
const cors = require("cors")
const Schema = mongoose.Schema
const nodemailer = require("nodemailer")
const crypto = require("crypto")
const bcrypt = require("bcryptjs")
require("dotenv").config({ path: "./.env" })

const port = process.env.PORT || 8020

// --- MongoDB connection ---

const uri = process.env.PROD_MONGODB || process.env.MONGODB_URI
// create a mongoDB new connection

const options = {}

mongoose
  .connect(uri, options)
  .then(() => console.log("Successfully connected to MongoDB."))
  .catch((e) => console.error("Connection error", e.message))

const db = mongoose.connection

db.on("error", console.error.bind(console, "MongoDB connection error:"))

const AccountDB = new Schema({
  admin: { type: Boolean, default: false },
  subscription: { type: String, default: "free" },
  verified: { type: Boolean, default: false },
  verificationToken: { type: String },
  name: { type: String, required: true },
  email: { type: String, required: true },
  username: { type: String, required: true },
  password: { type: String, min: 6, max: 1024, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

const Account = mongoose.model("Account", AccountDB)

const emailValidation =
  /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

/** Password validation
 * (?=.*\d)         should contain at least 1 digit
 * (?=(.*\W){2})    should contain at least 2 special characters
 * (?=.*[a-zA-Z])   should contain at least 1 alphabetic character
 * (?!.*\s)         should not contain any blank space
 */

const passwordValidation =
  /^(?=.*\d)(?=(.*\W){2})(?=.*[a-zA-Z])(?!.*\s).{1,15}$/

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
  if (
    !req.body.username ||
    !req.body.email ||
    !req.body.password ||
    !req.body ||
    !req.body.name
  ) {
    throw new Error("Missing username, name, email or password")
  }

  if (req.body.password.length < 6) {
    throw new Error("Password must be at least 6 characters")
  }

  if (!emailValidation.test(req.body.email)) {
    throw new Error("Invalid email")
  }

  if (!passwordValidation.test(req.body.password)) {
    throw new Error("Invalid password")
  }

  const doesAccoutExist = await Account.findOne({ email: req.body.email })
  if (doesAccoutExist) {
    throw new Error("Account already exists")
  }

  if (!doesAccoutExist) {
    const salt = await bcrypt.genSalt(10)
    const hashedEmail = await bcrypt.hash(req.body.email, salt)
    const hashedPassword = await bcrypt.hash(req.body.password, salt)
    const verificationToken = await crypto.randomBytes(20).toString("hex")

    const account = await new Account({
      name: req.body.name,
      username: req.body.username,
      email: hashedEmail,
      password: hashedPassword,
      verificationToken: verificationToken,
    })

    await account.save()

    sendVerificationEmail({ email: req.body.email, verificationToken }, res)

    return res.status(201).json({
      success: true,
      message: "Account created",
    })
  }
})

const sendVerificationEmail = async (req, res) => {
  const smtpConfig = {
    host: "smtp.zoho.com",
    port: 465,
    secure: true, //ssl
    auth: {
      user: process.env.EMAIL,
      pass: process.env.PASSWORD,
    },
  }

  const transporter = nodemailer.createTransport(smtpConfig)

  const mailOptions = {
    from: process.env.EMAIL,
    to: req.email,
    subject: "Account verification",
    text: `Click on the link below to verify your account: ${process.env.BASE_URL}/verify?token=${req.verificationToken}`,
  }

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error)
    } else {
      console.log("Email sent: " + info.response)
    }
  })
  return res.status(200).json({ success: true, message: "Email sent" })
}

const verify = async (req, res) => {
  const { token } = req.query

  if (!token) {
    throw new Error("Missing token")
  }

  const updatedAccount = await Account.findOneAndUpdate(
    { verificationToken: token },
    { verified: true, verificationToken: undefined }
  )

  if (!updatedAccount) {
    throw new Error("Invalid token")
  }

  if (!updatedAccount.verified) {
    throw new Error("Account not verified")
  }

  updatedAccount.email = undefined
  updatedAccount.password = undefined

  return res.status(200).json({ success: true, data: updatedAccount })
}

const signin = async (req, res) => {
  let activeAccount = null

  if (!req.body.username || !req.body.password) {
    throw new Error("Missing username or password")
  }

  if (!emailValidation.test(req.body.email)) {
    throw new Error("Invalid email")
  }

  if (!passwordValidation.test(req.body.password)) {
    throw new Error("Invalid password")
  }

  activeAccount = await Account.findOne({ username: req.body.username })
  !activeAccount && res.status(400).json("Wrong credentials")

  const validPassword = await bcrypt.compare(
    req.body.password,
    activeAccount.password
  )
  !validPassword && res.status(400).json("Wrong credentials")

  activeAccount.email = undefined
  activeAccount.password = undefined

  res.status(200).json({ success: true, data: activeAccount })
}

const updateAccount = handleCallback(async (req, res, next) => {
  if (req.body.id === req.params.id || req.body.isAdmin) {
    if (req.body.password) {
      const salt = await bcrypt.genSalt(10)
      req.body.password = await bcrypt.hash(req.body.password, salt)
    }

    await Account.findByIdAndUpdate(req.params.id, {
      $set: req.body,
    })

    res.status(200).json("Account has been updated")
  } else if (!req.body.isAdmin) {
    const account = await Account.findById(req.params.id)
    if (account) {
      return res.status(403).json("you can only update your account!")
    }
  }
  throw new Error("Account not found")
})

const deleteAccount = handleCallback(async (req, res) => {
  const { id } = req.params
  if (!id) throw new Error("Account not found")

  if (req.body.id === req.params.id || req.body.isAdmin) {
    const account = await Account.findById(id)
    if (!account) throw new Error("Account not found")

    const deleted = await Account.findByIdAndDelete(id)
    if (!deleted) throw new Error("Account not found")

    if (deleted) {
      deleted.password = undefined
      deleted.email = undefined
      return res
        .status(200)
        .json({ success: true, data: deleted, Message: "Account deleted" })
    }
  }
  throw new Error("Account not found")
})

const getAccount = handleCallback(async (req, res) => {
  if (!req.params.id) throw new Error("Account not found")

  if (req.body.id === req.params.id && req.body.isAdmin) {
    const account = await Account.findById(req.params.id)
    if (!account) throw new Error("Account not found")
    return res.status(200).json({ success: true, data: account })
  }
  throw new Error("Account not found")
})

// --- ROUTES ---

app.get("/", (req, res) => res.json("base api endpoint"))
app.post("/signin", signin)
app.get("/verify/:token", verify)
app.post("/account/create", createAccount)
app.get("/account/:id", getAccount)
app.put("/account/:id", updateAccount)
app.delete("/account/:id", deleteAccount)

// --- SERVER ---

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`)
})
