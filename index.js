// index.js
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || "https://plugin-excel-generator-jhd8.onrender.com";

app.use(cors());
app.use(bodyParser.json());

// Ensure downloads directory exists
const downloadsDir = path.join(process.cwd(), "downloads");
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir);
}

app.post("/excel-generator/generate", async (req, res) => {
  try {
    const { sheetsData, excelConfigs } = req.body;

    if (!sheetsData || !Array.isArray(sheetsData)) {
      return res.status(400).json({ error: "Missing or invalid sheetsData" });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Excel Generator Plugin";

    for (const sheetInfo of sheetsData) {
      const sheet = workbook.addWorksheet(sheetInfo.sheetName || "Sheet");

      for (const table of sheetInfo.tables) {
        let currentRow = sheet.getRow(
          parseInt(table.startCell.replace(/[^\d]/g, "")) || 1
        );

        // Title row
        if (table.title) {
          currentRow.getCell(1).value = table.title;
          currentRow.font = { size: excelConfigs?.tableTitleFontSize || 13 };
          currentRow.commit();
          currentRow = sheet.getRow(currentRow.number + 1);
        }

        // Header row
        if (!table.skipHeader) {
          const headerRow = sheet.getRow(currentRow.number);
          table.columns.forEach((col, idx) => {
            headerRow.getCell(idx + 1).value = col.name;
            headerRow.font = {
              size: excelConfigs?.headerFontSize || 11,
              bold: true,
            };
          });
          headerRow.commit();
          currentRow = sheet.getRow(currentRow.number + 1);
        }

        // Data rows
        for (const rowData of table.rows) {
          const row = sheet.getRow(currentRow.number);
          rowData.forEach((cell, idx) => {
            if (cell.type === "formula") {
              row.getCell(idx + 1).value = { formula: cell.value };
            } else {
              row.getCell(idx + 1).value = cell.value;
            }
            row.getCell(idx + 1).font = {
              name: excelConfigs?.fontFamily || "Calibri",
              size: excelConfigs?.fontSize || 11,
            };
          });
          row.commit();
          currentRow = sheet.getRow(currentRow.number + 1);
        }

        // Optional Auto Filter
        if (excelConfigs?.autoFilter === "true") {
          sheet.autoFilter = {
            from: { row: currentRow.number - table.rows.length - 1, column: 1 },
            to: { row: currentRow.number - 1, column: table.columns.length },
          };
        }

        // Optional Auto Fit
        if (excelConfigs?.autoFitColumnWidth === "true") {
          sheet.columns.forEach((col) => {
            let maxLength = 10;
            col.eachCell({ includeEmpty: true }, (cell) => {
              const val = cell.value ? cell.value.toString() : "";
              if (val.length > maxLength) maxLength = val.length;
            });
            col.width = maxLength + 2;
          });
        }
      }
    }

    // Save file
    const fileId = uuidv4();
    const filePath = path.join(downloadsDir, `${fileId}.xlsx`);
    await workbook.xlsx.writeFile(filePath);

    // Return download URL
    res.json({
      success: true,
      downloadURL: `${BASE_URL}/downloads/${fileId}.xlsx`,
    });

    // Auto-delete after 1 hour
    setTimeout(() => {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }, 60 * 60 * 1000);
  } catch (err) {
    console.error("Excel generation failed:", err);
    res.status(500).json({ error: "Failed to generate Excel file" });
  }
});

// Serve downloads
app.use("/downloads", express.static(downloadsDir));

app.get("/", (req, res) => {
  res.send("✅ Excel Generator Plugin Server is running!");
});

app.listen(PORT, () => {
  console.log(`🚀 Excel Generator server running at ${BASE_URL}`);
});
