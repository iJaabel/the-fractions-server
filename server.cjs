const express = require("express")
const mongoose = require("mongoose")
const app = express()
const bodyParser = require("body-parser")
const cors = require("cors")
const Schema = mongoose.Schema
const nodemailer = require("nodemailer")
const crypto = require("crypto")
const bcrypt = require("bcryptjs")
const fs = require("fs")
const path = require("path")
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
  if (!req.body.email || !req.body.password || !req.body || !req.body.name) {
    throw new Error("Missing name, email or password")
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
      email: hashedEmail,
      password: hashedPassword,
      verificationToken: verificationToken,
    })

    await account.save()

    await sendVerificationEmail({ ...req }, res)

    return res.status(201).json({
      success: true,
      message: "Account created",
    })
  }
})

const sendVerificationEmail = async (req, res) => {
  const { verificationToken } = req.body

  const smtpConfig = {
    host: process.env.SMTPSERVER,
    port: 465, // 465 or 587 for ssl
    secure: true, //ssl
    auth: {
      user: process.env.SENDERSEMAIL,
      pass: process.env.SENDERSPASSWORD,
    },
  }

  const transporter = nodemailer.createTransport(smtpConfig)

  const mailOptions = {
    from: process.env.SENDERSEMAIL,
    to: req.body.email,
    subject: "Account verification",
    html: `<!DOCTYPE html>
<html
  xmlns="http://www.w3.org/1999/xhtml"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:o="urn:schemas-microsoft-com:office:office"
>
  <head>
    <title> </title>
    <!--[if !mso]><!-- -->
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <!--<![endif]-->
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style type="text/css">
      #outlook a {
        padding: 0;
      }

      .ReadMsgBody {
        width: 100%;
      }

      .ExternalClass {
        width: 100%;
      }

      .ExternalClass * {
        line-height: 100%;
      }

      body {
        margin: 0;
        padding: 0;
        -webkit-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
      }

      table,
      td {
        border-collapse: collapse;
        mso-table-lspace: 0pt;
        mso-table-rspace: 0pt;
      }

      img {
        border: 0;
        height: auto;
        line-height: 100%;
        outline: none;
        text-decoration: none;
        -ms-interpolation-mode: bicubic;
      }

      p {
        display: block;
        margin: 13px 0;
      }
    </style>
    <!--[if !mso]><!-->
    <style type="text/css">
      @media only screen and (max-width: 480px) {
        @-ms-viewport {
          width: 320px;
        }
        @viewport {
          width: 320px;
        }
      }
    </style>
    <!--<![endif]-->
    <!--[if mso]>
      <xml>
        <o:OfficeDocumentSettings>
          <o:AllowPNG />
          <o:PixelsPerInch>96</o:PixelsPerInch>
        </o:OfficeDocumentSettings>
      </xml>
    <![endif]-->
    <!--[if lte mso 11]>
      <style type="text/css">
        .outlook-group-fix {
          width: 100% !important;
        }
      </style>
    <![endif]-->
    <style type="text/css">
      @media only screen and (min-width: 480px) {
        .mj-column-per-100 {
          width: 100% !important;
        }
      }
    </style>
    <style type="text/css"></style>
  </head>
  <body style="background-color: #f9f9f9">
    <div style="background-color: #f9f9f9">
      <!--[if mso | IE]>
      <table
         align="center" border="0" cellpadding="0" cellspacing="0" style="width:600px;" width="600"
      >
        <tr>
          <td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;">
      <![endif]-->
      <div
        style="
          background: #f9f9f9;
          background-color: #f9f9f9;
          margin: 0px auto;
          max-width: 600px;
        "
      >
        <table
          align="center"
          border="0"
          cellpadding="0"
          cellspacing="0"
          role="presentation"
          style="background: #f9f9f9; background-color: #f9f9f9; width: 100%"
        >
          <tbody>
            <tr>
              <td
                style="
                  border-bottom: #333957 solid 5px;
                  direction: ltr;
                  font-size: 0px;
                  padding: 20px 0;
                  text-align: center;
                  vertical-align: top;
                "
              >
                <!--[if mso | IE]>
                  <table
                    role="presentation"
                    border="0"
                    cellpadding="0"
                    cellspacing="0"
                  >
                    <tr></tr>
                  </table>
                <![endif]-->
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <!--[if mso | IE]>
          </td>
        </tr>
      </table>
      <table
         align="center" border="0" cellpadding="0" cellspacing="0" style="width:600px;" width="600"
      >
        <tr>
          <td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;">
      <![endif]-->
      <div
        style="
          background: #fff;
          background-color: #fff;
          margin: 0px auto;
          max-width: 600px;
        "
      >
        <table
          align="center"
          border="0"
          cellpadding="0"
          cellspacing="0"
          role="presentation"
          style="background: #fff; background-color: #fff; width: 100%"
        >
          <tbody>
            <tr>
              <td
                style="
                  border: #dddddd solid 1px;
                  border-top: 0px;
                  direction: ltr;
                  font-size: 0px;
                  padding: 20px 0;
                  text-align: center;
                  vertical-align: top;
                "
              >
                <!--[if mso | IE]>
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">    
        <tr>
            <td
               style="vertical-align:bottom;width:600px;"
            >
          <![endif]-->
                <div
                  class="mj-column-per-100 outlook-group-fix"
                  style="
                    font-size: 13px;
                    text-align: left;
                    direction: ltr;
                    display: inline-block;
                    vertical-align: bottom;
                    width: 100%;
                  "
                >
                  <table
                    border="0"
                    cellpadding="0"
                    cellspacing="0"
                    role="presentation"
                    style="vertical-align: bottom"
                    width="100%"
                  >
                    <tr>
                      <td
                        align="center"
                        style="
                          font-size: 0px;
                          padding: 10px 25px;
                          word-break: break-word;
                        "
                      >
                        <table
                          align="center"
                          border="0"
                          cellpadding="0"
                          cellspacing="0"
                          role="presentation"
                          style="border-collapse: collapse; border-spacing: 0px"
                        >
                          <tbody>
                            <tr>
                              <td style="width: 132px">
                                <a
                                  href="https://mathvisuals.netlify.app/"
                                  target="_blank"
                                >
                                  <img
                                    height="auto"
                                    src="https://i.imgur.com/mb6DJVi.png"
                                    style="
                                      border: 0;
                                      display: block;
                                      outline: none;
                                      text-decoration: none;
                                      width: 100%;
                                    "
                                    width="64"
                                  />
                                </a>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td
                        align="center"
                        style="
                          font-size: 0px;
                          padding: 10px 25px;
                          padding-bottom: 40px;
                          word-break: break-word;
                        "
                      >
                        <div
                          style="
                            font-family: 'Helvetica Neue', Arial, sans-serif;
                            font-size: 32px;
                            font-weight: bold;
                            line-height: 1;
                            text-align: center;
                            color: #555;
                          "
                        >
                          Please confirm your email
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td
                        align="center"
                        style="
                          font-size: 0px;
                          padding: 10px 25px;
                          padding-bottom: 0;
                          word-break: break-word;
                        "
                      >
                        <div
                          style="
                            font-family: 'Helvetica Neue', Arial, sans-serif;
                            font-size: 16px;
                            line-height: 22px;
                            text-align: center;
                            color: #555;
                          "
                        >
                          Hey ${req.body.name},
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td
                        align="center"
                        style="
                          font-size: 0px;
                          padding: 10px 25px;
                          word-break: break-word;
                        "
                      >
                        <div
                          style="
                            font-family: 'Helvetica Neue', Arial, sans-serif;
                            font-size: 16px;
                            line-height: 22px;
                            text-align: center;
                            color: #555;
                          "
                        >
                          We’re dedicated to keeping your account safe on Visual
                          Fraction Library. To ensure it’s you and maintain the
                          highest security standards, we need your confirmation.
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td
                        align="center"
                        style="
                          font-size: 0px;
                          padding: 10px 25px;
                          padding-bottom: 20px;
                          word-break: break-word;
                        "
                      >
                        <div
                          style="
                            font-family: 'Helvetica Neue', Arial, sans-serif;
                            font-size: 16px;
                            line-height: 22px;
                            text-align: center;
                            color: #555;
                          "
                        >
                          Please validate your email address in order to get
                          started using Visual Fraction Library.
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td
                        align="center"
                        style="
                          font-size: 0px;
                          padding: 10px 25px;
                          padding-top: 30px;
                          padding-bottom: 40px;
                          word-break: break-word;
                        "
                      >
                        <table
                          align="center"
                          border="0"
                          cellpadding="0"
                          cellspacing="0"
                          role="presentation"
                          style="border-collapse: separate; line-height: 100%"
                        >
                          <tr>
                            <td
                              align="center"
                              bgcolor="#52a4b0"
                              role="presentation"
                              style="
                                border: none;
                                border-radius: 3px;
                                color: #ffffff;
                                cursor: auto;
                                padding: 15px 25px;
                              "
                              valign="middle"
                            >
                              <a
                                href="${process.env.BASE_URL}/verify?token=${req.verificationToken}"
                                rel="noreferrer noopener"
                                target="_blank"
                                style="
                                  background: #52a4b0;
                                  color: #ffffff;
                                  font-family: 'Helvetica Neue', Arial,
                                    sans-serif;
                                  font-size: 15px;
                                  font-weight: normal;
                                  line-height: 120%;
                                  margin: 0;
                                  text-decoration: none;
                                  text-transform: none;
                                "
                              >
                                Confirm Your Email
                              </a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td
                        align="center"
                        style="
                          font-size: 0px;
                          padding: 10px 25px;
                          padding-bottom: 0;
                          word-break: break-word;
                        "
                      >
                        <div
                          style="
                            font-family: 'Helvetica Neue', Arial, sans-serif;
                            font-size: 16px;
                            line-height: 22px;
                            text-align: center;
                            color: #555;
                          "
                        >
                          Or verify using this link:
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td
                        align="center"
                        style="
                          font-size: 0px;
                          padding: 10px 25px;
                          padding-bottom: 40px;
                          word-break: break-word;
                        "
                      >
                        <div
                          style="
                            font-family: 'Helvetica Neue', Arial, sans-serif;
                            font-size: 16px;
                            line-height: 22px;
                            text-align: center;
                            color: #555;
                          "
                        >
                          <a
                            href="${process.env.BASE_URL}/verify?token=${verificationToken}"
                            style="color: #52a4b0"
                            >https://www.visualfractionlibrary.com/verify</a
                          >
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td
                        align="center"
                        style="
                          font-size: 0px;
                          padding: 10px 25px;
                          word-break: break-word;
                        "
                      >
                        <div
                          style="
                            font-family: 'Helvetica Neue', Arial, sans-serif;
                            font-size: 26px;
                            font-weight: bold;
                            line-height: 1;
                            text-align: center;
                            color: #555;
                          "
                        ></div>
                      </td>
                    </tr>
                    <tr>
                      <td
                        align="center"
                        style="
                          font-size: 0px;
                          padding: 10px 25px;
                          word-break: break-word;
                        "
                      >
                        <div
                          style="
                            font-family: 'Helvetica Neue', Arial, sans-serif;
                            font-size: 14px;
                            line-height: 22px;
                            text-align: center;
                            color: #555;
                          "
                        >
                          If you did not initiate this action, please contact us
                          immediately<br />
                          at
                          <a
                            href="mailto:support@visualfractionlibrary.com"
                            style="color: #52a4b0"
                            >support@visualfractionlibrary.com</a
                          >
                          <br />
                          Thank you for your vigilance in securing your account.
                          Your cooperation helps us create a safer environment
                          for all users. Please send and feedback or bug
                          information to the support email.
                        </div>
                      </td>
                    </tr>
                  </table>
                </div>
                <!--[if mso | IE]>
            </td>
        </tr>
                  </table>
                <![endif]-->
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <!--[if mso | IE]>
          </td>
        </tr>
      </table>
      <table
         align="center" border="0" cellpadding="0" cellspacing="0" style="width:600px;" width="600"
      >
        <tr>
          <td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;">
      <![endif]-->
      <div style="margin: 0px auto; max-width: 600px">
        <table
          align="center"
          border="0"
          cellpadding="0"
          cellspacing="0"
          role="presentation"
          style="width: 100%"
        >
          <tbody>
            <tr>
              <td
                style="
                  direction: ltr;
                  font-size: 0px;
                  padding: 20px 0;
                  text-align: center;
                  vertical-align: top;
                "
              >
                <!--[if mso | IE]>
                  <table role="presentation" border="0" cellpadding="0" cellspacing="0">    
        <tr>
            <td
               style="vertical-align:bottom;width:600px;"
            >
          <![endif]-->
                <div
                  class="mj-column-per-100 outlook-group-fix"
                  style="
                    font-size: 13px;
                    text-align: left;
                    direction: ltr;
                    display: inline-block;
                    vertical-align: bottom;
                    width: 100%;
                  "
                >
                  <table
                    border="0"
                    cellpadding="0"
                    cellspacing="0"
                    role="presentation"
                    width="100%"
                  >
                    <tbody>
                      <tr>
                        <td style="vertical-align: bottom; padding: 0">
                          <table
                            border="0"
                            cellpadding="0"
                            cellspacing="0"
                            role="presentation"
                            width="100%"
                          >
                            <tr>
                              <td
                                align="center"
                                style="
                                  font-size: 0px;
                                  padding: 0;
                                  word-break: break-word;
                                "
                              >
                                <div
                                  style="
                                    font-family: 'Helvetica Neue', Arial,
                                      sans-serif;
                                    font-size: 12px;
                                    font-weight: 300;
                                    line-height: 1;
                                    text-align: center;
                                    color: #575757;
                                  "
                                >
                                  Austin TX USA
                                </div>
                              </td>
                            </tr>
                            <tr>
                              <td
                                align="center"
                                style="
                                  font-size: 0px;
                                  padding: 10px;
                                  word-break: break-word;
                                "
                              >
                                <div
                                  style="
                                    font-family: 'Helvetica Neue', Arial,
                                      sans-serif;
                                    font-size: 12px;
                                    font-weight: 300;
                                    line-height: 1;
                                    text-align: center;
                                    color: #575757;
                                  "
                                >
                                  <a
                                    href="https://youtu.be/dQw4w9WgXcQ?si=cZ5erEtkwrGM3u65"
                                    style="color: #575757"
                                    >Unsubscribe</a
                                  >
                                  from our emails
                                </div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <!--[if mso | IE]>
            </td>
        </tr>
                  </table>
                <![endif]-->
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <!--[if mso | IE]>
          </td>
        </tr>
      </table>
      <![endif]-->
    </div>
  </body>
</html>
    `,
  }

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log("Error sending email: " + error)
    } else {
      console.log("Email sent: " + info.response)
      return res.status(200).json({ success: true, message: "Email sent" })
    }
  })
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
  if (!req.body.email || !req.body.password) {
    throw new Error("Missing email or password")
  }

  if (!emailValidation.test(req.body.email)) {
    throw new Error("Invalid email")
  }

  if (!passwordValidation.test(req.body.password)) {
    throw new Error("Invalid password")
  }

  let activeAccount = await Account.findOne({ email: req.body.email })
  !activeAccount && res.status(400).json("Wrong credentials")

  const validEmail = await bcrypt.compare(req.body.email, activeAccount.email)
  const validPassword = await bcrypt.compare(
    req.body.password,
    activeAccount.password
  )

  !validEmail || !validPassword
    ? res.status(400).json("Wrong credentials")
    : null

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

app.get("/", async (req, res) =>
  res
    .status(200)
    .sendFile(await fs.readFile(process.cwd() + "docs.html", "utf8"))
)
app.post("/signin", signin)
app.get("/verify/:token", verify)
app.post("/account/create", createAccount)
app.get("/account/:id", getAccount)
app.put("/account/:id", updateAccount)
app.delete("/account/:id", deleteAccount)

// --- SERVER ---

app.listen(port, () => {
  console.log(`Listening at ${process.env.BASE_URL || "...env not working"} `)
})
