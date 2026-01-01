require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { nanoid } = require("nanoid");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ---------- Cloudinary Config ---------- */
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

/* ---------- MongoDB ---------- */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

/* ---------- Schema ---------- */
const mediaSchema = new mongoose.Schema({
  token: String,
  mediaUrl: String,
  viewed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: 3600 },
});

const Media = mongoose.model("Media", mediaSchema);

/* ---------- Multer Memory Storage ---------- */
const storage = multer.memoryStorage();
const upload = multer({ storage });

/* ---------- Upload Route ---------- */
app.post("/upload", (req, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err)
      return res.status(400).json({ success: false, error: err.message });
    if (!req.file)
      return res.status(400).json({ success: false, message: "No file uploaded" });

    try {
      const streamUpload = (buffer) => {
        return new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { resource_type: "auto" },
            (error, result) => {
              if (result) resolve(result);
              else reject(error);
            }
          );
          stream.end(buffer);
        });
      };

      const result = await streamUpload(req.file.buffer);
      const token = nanoid(8);

      await Media.create({
        token,
        mediaUrl: result.secure_url,
      });

      res.json({
        success: true,
        link: `${process.env.BASE_URL}/view/${token}`,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

/* ---------- View Route (Self-Destruct) ---------- */
app.get("/view/:token", async (req, res) => {
  const media = await Media.findOne({ token: req.params.token });

  if (!media || media.viewed) {
    return res.sendFile(__dirname + "/public/expired.html");
  }

  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Secure View</title>
<style>
  body {
    margin:0;
    background:#000;
    color:#fff;
    font-family:Arial, sans-serif;
    display:flex;
    align-items:center;
    justify-content:center;
    height:100vh;
    overflow:hidden;
  }
  .container {
    position:relative;
    max-width:90%;
    width:400px;
  }
  img {
    width:100%;
    border-radius:10px;
    display:block;
    transition: opacity 1s ease;
  }
  .countdown {
    position:absolute;
    top:10px;
    right:10px;
    background:rgba(0,0,0,0.6);
    padding:8px 12px;
    border-radius:8px;
    font-size:18px;
    font-weight:bold;
    color:#ff4d4d;
  }
  .expired-overlay {
    position:absolute;
    top:0; left:0;
    width:100%;
    height:100%;
    background:rgba(0,0,0,0.85);
    display:flex;
    flex-direction:column;
    justify-content:center;
    align-items:center;
    color:#ff4d4d;
    font-size:20px;
    text-align:center;
    border-radius:10px;
    opacity:0;
    transition: opacity 1s ease;
  }
</style>
</head>
<body>
  <div class="container">
    <img id="media" src="${media.mediaUrl}" />
    <div class="countdown" id="count">5</div>
    <div class="expired-overlay" id="expired">
      <div>❌ Link Expired</div>
      <div>This media was designed to be viewed only once.</div>
    </div>
  </div>

<script>
  const img = document.getElementById("media");
let time = 5;
const countEl = document.getElementById("count");

// Timer tabhi start hoga jab image fully load ho
img.onload = () => {
  const timer = setInterval(() => {
    time--;
    countEl.innerText = time;

    if (time <= 0) {
      clearInterval(timer);
      fetch("/expire/${media.token}", { method: "POST" })
        .then(() => {
          document.body.innerHTML =
            "<h2 style='color:red'>❌ Link Expired</h2>";
        });
    }
  }, 1000);
};

</script>

</body>
</html>
  `);
});



app.post("/expire/:token", async (req, res) => {
  await Media.updateOne(
    { token: req.params.token },
    { viewed: true }
  );
  res.json({ success: true });
});

/* ---------- Server ---------- */
const PORT = process.env.PORT || 5000;
app.use(express.static("public"));
app.listen(PORT, '0.0.0.0', () => console.log("Server running on port", PORT));

