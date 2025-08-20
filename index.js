import express from "express";
import { google } from "googleapis";

const app = express();
app.use(express.json());

// --- OAUTH CLIENT ---
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.REDIRECT_URI || "https://plugins-server-xbmk.onrender.com/oauth2callback"
);

// Store tokens per user (for demo: in-memory, for production: database)
let userTokens = {};

// --- AUTH FLOW ---
app.get("/auth", (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/spreadsheets"
    ],
  });
  res.redirect(authUrl);
});

app.get("/oauth2callback", async (req, res) => {
  const { code } = req.query;
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // store user tokens (here: naive, should be per-user in DB)
  userTokens = tokens;

  res.send("✅ Google Sheets connected! You can close this window.");
});

// Middleware to apply tokens
function requireAuth(req, res, next) {
  if (!userTokens.access_token) {
    return res.status(401).send("Not logged in with Google");
  }
  oauth2Client.setCredentials(userTokens);
  next();
}

// --- LIST SHEETS ---
app.get("/sheets/list", requireAuth, async (req, res) => {
  try {
    const drive = google.drive({ version: "v3", auth: oauth2Client });
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet'",
      fields: "files(id, name, owners)",
      pageSize: 20,
    });
    res.json(response.data.files);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching sheets");
  }
});

// --- READ SHEET ---
app.get("/sheets/read", requireAuth, async (req, res) => {
  try {
    const { sheetId, range } = req.query;
    if (!sheetId) return res.status(400).send("sheetId required");

    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: range || "Sheet1!A1:D10",
    });
    res.json(response.data);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error reading sheet");
  }
});

// --- WRITE SHEET ---
app.post("/sheets/write", requireAuth, async (req, res) => {
  try {
    const { sheetId, range, values } = req.body;
    if (!sheetId || !range || !values) {
      return res.status(400).send("sheetId, range, and values are required");
    }

    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range,
      valueInputOption: "RAW",
      requestBody: { values },
    });
    res.json(response.data);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error writing sheet");
  }
});

// --- HEALTH CHECK ---
app.get("/health-check", (req, res) => res.send("OK"));

// --- THIS NEW ROUTE WILL CATCH ALL OTHER REQUESTS ---
// Place this at the end of all your specific API routes
app.use((req, res, next) => {
    res.status(404).send("API endpoint not found.");
});

// --- SERVER START ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));
