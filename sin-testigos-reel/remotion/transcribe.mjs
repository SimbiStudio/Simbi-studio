import path from "path";
import fs from "fs";
import {downloadWhisperModel, installWhisperCpp, transcribe, toCaptions} from "@remotion/install-whisper-cpp";
const to = path.join(process.cwd(), "whisper.cpp");
await installWhisperCpp({to, version: "1.5.5"});
await downloadWhisperModel({model: "medium", folder: to});
const out = await transcribe({model: "medium", whisperPath: to, whisperCppVersion: "1.5.5",
  inputPath: process.argv[2], tokenLevelTimestamps: true, language: "es"});
const {captions} = toCaptions({whisperCppOutput: out});
fs.writeFileSync(process.argv[3], JSON.stringify(captions, null, 2));
console.log(captions.map(c => `${c.startMs}-${c.endMs}:${c.text}`).join("\n"));
