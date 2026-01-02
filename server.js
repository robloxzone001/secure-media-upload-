require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const crypto = require("crypto");
const path = require("path");

const app = express();

/* ---------- Middlewares ---------- */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname + "/public")); // frontend files

/* ---------- Root Route ---------- */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html")); // render frontend on root
});


// expired page
app.get("/expired", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "expired.html"));
});


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

/* ---------- Token Generator ---------- */
function generateToken(length = 8) {
  return crypto.randomBytes(16).toString("hex").slice(0, length);
}

/* ---------- Multer ---------- */
const storage = multer.memoryStorage();
const upload = multer({ storage });

/* ---------- Upload Route ---------- */
app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file)
    return res.status(400).json({ success: false, message: "No file uploaded" });

  try {
    const uploadStream = () =>
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { resource_type: "auto" },
          (err, result) => (err ? reject(err) : resolve(result))
        );
        stream.end(req.file.buffer);
      });

    const result = await uploadStream();
    const token = generateToken(8);

    await Media.create({ token, mediaUrl: result.secure_url });

    res.json({
      success: true,
      link: `${process.env.BASE_URL}/view/${token}`, // single slash
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ---------- View Route ---------- */
app.get("/view/:token", async (req, res) => {
  const media = await Media.findOne({ token: req.params.token });
  if (!media || media.viewed) return res.sendFile(path.join(__dirname, "public/expired.html"));

  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Secure View</title>
<style>
body{margin:0;background:#000;color:#fff;display:flex;justify-content:center;align-items:center;height:100vh}
img{max-width:90%;border-radius:10px}
</style>
</head>
<body>
<img id="media" src="${media.mediaUrl}" />
<script>
let t=5;
const img=document.getElementById("media");
img.onload=()=>{
  const timer=setInterval(()=>{
    t--;
    if(t<=0){
      clearInterval(timer);
      fetch("/expire/${media.token}",{method:"POST"})
        .then(()=>document.body.innerHTML="<h2 style='color:red'>❌ Link Expired</h2>");
    }
  },1000);
};
</script>
</body>
</html>
`);
});

/* ---------- Expire Route ---------- */
app.post("/expire/:token", async (req, res) => {
  await Media.updateOne({ token: req.params.token }, { viewed: true });
  res.json({ success: true });
});

/* ---------- Server ---------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`Server running on port ${PORT} 🚀`)
);
